// Histórico por espaço: memória + userData/history.jsonl (até 20 mil entradas no total; cada
// espaço tem o seu, como cookies e logins). O arquivo só cresce por append (uma linha por visita
// ou título) com debounce, e síncrono na saída; quando sobra muita linha antiga, é reescrito por
// inteiro. A leitura (cerca de 15 ms com 20 mil linhas) espera a abertura passar, mas sempre
// acontece antes da primeira gravação: um append em arquivo ainda não lido o criaria por cima do
// formato antigo, que então nunca seria migrado. Dados privados: arquivo 0600, sem #fragmento
// (tokens de login), no máximo 500 entradas por host e 10 MB (as mais antigas saem).
import { statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { limitTitle, limitUrl } from '@shared/limit-stored-text'

import { sanitizeTitle } from '@shared/sanitize-title'
import { stripFragmentFromTitle } from '@shared/strip-fragment'
import type { HistoryEntry, SpaceId } from '@shared/types'
import { isHistoryUrl } from './is-history-url'
import { loadHistory } from './load-history'
import { markLegacyMigrated } from './migrate-legacy-history'
import { appendPrivate } from './private-files'
import { getHistoryPath } from './read-history-file'
import {
  serializeAll,
  serializeTitle,
  serializeVisit
} from './serialize-history'
import {
  addHistoryEntry,
  countEntries,
  createSpaceHistory,
  MAX_HISTORY_BYTES,
  setHistoryTitle,
  trimHistory,
  trimHistoryBytes,
  type SpaceHistory
} from './space-history'
import { warmSearchText } from './warm-search-text'
import { writeAtomic } from './write-atomic'

const DEBOUNCE_MS = 2000
// o arquivo é lido depois da abertura (a menos que a paleta peça antes) e o texto normalizado é
// calculado em fatias, para a primeira consulta já encontrar tudo pronto
const WARM_DELAY_MS = 3000
// compacta quando as linhas ultrapassam as entradas em mais que isto
const COMPACT_SLACK = 5000

type EarlyOp =
  | {
      kind: 'visit'
      spaceId: SpaceId
      url: string
      title: string
      visitedAt: number
    }
  | { kind: 'title'; spaceId: SpaceId; url: string; title: string }

export class HistoryStore {
  private histories = new Map<SpaceId, SpaceHistory>()
  private loaded = false
  private warmed = false
  // o que aconteceu antes de o arquivo ser lido: reaplicado por cima dele, na ordem
  private early: EarlyOp[] = []
  // linhas ainda não gravadas
  private buffer: string[] = []
  private lines = 0
  // tamanho estimado do arquivo no disco (o lido mais o que já foi anexado)
  private bytes = 0
  private timer: NodeJS.Timeout | null = null

  private readonly path: string
  private readonly userData: string

  constructor(userData: string) {
    this.userData = userData
    this.path = getHistoryPath(userData)
    const timer = setTimeout(() => this.warm(), WARM_DELAY_MS)
    timer.unref()
  }

  private space(spaceId: SpaceId): SpaceHistory {
    let history = this.histories.get(spaceId)
    if (!history) {
      history = createSpaceHistory()
      this.histories.set(spaceId, history)
    }
    return history
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    const { histories, lines, legacy, needsRewrite } = loadHistory(
      this.path,
      this.userData
    )
    this.histories = histories
    // mais as linhas que já esperam no buffer (o que aconteceu antes da leitura)
    this.lines = lines + this.buffer.length
    // o arquivo mais o que ainda espera no buffer
    let onDisk = 0
    try {
      onDisk = statSync(this.path).size
    } catch {
      // ainda não existe
    }
    this.bytes = onDisk + Buffer.byteLength(this.buffer.join(''))

    for (const op of this.early) {
      if (op.kind === 'visit') addHistoryEntry(this.space(op.spaceId), op)
      else setHistoryTitle(this.space(op.spaceId), op.url, op.title)
    }
    this.early = []
    trimHistory(this.histories)

    if (!legacy && !needsRewrite && this.bytes <= MAX_HISTORY_BYTES) return
    try {
      this.rewrite()
      if (legacy) markLegacyMigrated(legacy.files)
    } catch (error) {
      console.error('[History][ensureLoaded] falha ao reescrever o histórico', error)
    }
  }

  // lê o arquivo agora e calcula o texto normalizado de cada entrada em fatias (uma vez só)
  warm(): void {
    if (this.warmed) return
    this.warmed = true
    this.ensureLoaded()
    warmSearchText(this.histories)
  }

  // mais recente primeiro. A lista devolvida é a da memória: quem lê não altera
  getEntries(spaceId: SpaceId): readonly HistoryEntry[] {
    this.ensureLoaded()
    return this.histories.get(spaceId)?.list ?? []
  }

  record(spaceId: SpaceId, url: string, title: string, now = Date.now()): void {
    if (!isHistoryUrl(url)) return
    // uma URL de megabytes não entra inteira na memória nem no arquivo; o título da página não
    // leva controles nem marcas bidi
    const visit = {
      url: limitUrl(url),
      title: stripFragmentFromTitle(sanitizeTitle(limitTitle(title)), url),
      visitedAt: now
    }
    if (this.loaded) {
      addHistoryEntry(this.space(spaceId), visit)
      trimHistory(this.histories)
    } else this.early.push({ kind: 'visit', spaceId, ...visit })
    this.enqueue(serializeVisit(spaceId, visit))
  }

  setTitle(spaceId: SpaceId, url: string, title: string): void {
    if (!title) return
    url = limitUrl(url)
    title = stripFragmentFromTitle(sanitizeTitle(limitTitle(title)), url)
    if (!title) return
    if (this.loaded) {
      if (!setHistoryTitle(this.space(spaceId), url, title)) return
    } else this.early.push({ kind: 'title', spaceId, url, title })
    this.enqueue(serializeTitle(spaceId, url, title))
  }

  private enqueue(line: string): void {
    this.buffer.push(line)
    this.lines++
    this.bytes += Buffer.byteLength(line)
    this.timer ??= setTimeout(() => this.saveNow(), DEBOUNCE_MS)
  }

  // reescreve o arquivo com o que está na memória (já inclui o que estava no buffer)
  private rewrite(): void {
    if (this.bytes > MAX_HISTORY_BYTES) {
      // passou de 10 MB: as visitas mais antigas saem, com folga para não reescrever a cada visita
      trimHistoryBytes(this.histories, MAX_HISTORY_BYTES * 0.9)
    }
    const text = serializeAll(this.histories)
    writeAtomic(this.path, text)
    this.buffer = []
    this.lines = countEntries(this.histories)
    this.bytes = Buffer.byteLength(text)
  }

  // limpar os dados de navegação de um espaço: o histórico dele some da memória e do disco (o
  // arquivo é reescrito sem ele; os arquivos do formato antigo, já migrados, também saem)
  clearSpace(spaceId: SpaceId): void {
    this.ensureLoaded()
    this.histories.set(spaceId, createSpaceHistory())
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try {
      this.rewrite()
    } catch (error) {
      console.error('[History][clearSpace] falha ao reescrever o histórico', error)
    }
    for (const suffix of ['.json', '.json.migrado']) {
      try {
        unlinkSync(join(this.userData, `history-${spaceId}${suffix}`))
      } catch {
        // não existe
      }
    }
  }

  saveNow(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.buffer.length === 0 && !this.needsCompaction()) return
    // lê antes de gravar (e migra o formato antigo, se for o caso). A migração reescreve o arquivo
    // inteiro, e então não sobra nada no buffer
    this.ensureLoaded()
    if (this.buffer.length === 0 && !this.needsCompaction()) return
    try {
      if (this.needsCompaction()) this.rewrite()
      else appendPrivate(this.path, this.buffer.join(''))
    } catch (error) {
      console.error('[History][saveNow] falha ao gravar o histórico', error)
    }
    this.buffer = []
  }

  private needsCompaction(): boolean {
    return (
      this.loaded &&
      (this.lines > countEntries(this.histories) + COMPACT_SLACK ||
        this.bytes > MAX_HISTORY_BYTES)
    )
  }
}
