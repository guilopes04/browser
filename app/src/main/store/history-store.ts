// Histórico por espaço: memória + userData/history.jsonl (até 20 mil entradas no total; cada
// espaço tem o seu, como cookies e logins). O arquivo só cresce por append (uma linha por visita
// ou título) com debounce, e síncrono na saída; quando sobra muita linha antiga, é reescrito por
// inteiro. A leitura (cerca de 15 ms com 20 mil linhas) espera a abertura passar, mas sempre
// acontece antes da primeira gravação: um append em arquivo ainda não lido o criaria por cima do
// formato antigo, que então nunca seria migrado.
import { appendFileSync } from 'node:fs'
import { limitTitle, limitUrl } from '@shared/limit-stored-text'
import type { HistoryEntry, SpaceId } from '@shared/types'
import { isHistoryUrl } from './is-history-url'
import { loadHistory } from './load-history'
import { markLegacyMigrated } from './migrate-legacy-history'
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
  setHistoryTitle,
  trimHistory,
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
    const { histories, lines, legacy } = loadHistory(this.path, this.userData)
    this.histories = histories
    // mais as linhas que já esperam no buffer (o que aconteceu antes da leitura)
    this.lines = lines + this.buffer.length

    for (const op of this.early) {
      if (op.kind === 'visit') addHistoryEntry(this.space(op.spaceId), op)
      else setHistoryTitle(this.space(op.spaceId), op.url, op.title)
    }
    this.early = []
    trimHistory(this.histories)

    if (!legacy) return
    try {
      this.rewrite()
      markLegacyMigrated(legacy.files)
    } catch (error) {
      console.error(
        '[History][ensureLoaded] falha ao migrar o histórico',
        error
      )
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
    // uma URL de megabytes não entra inteira na memória nem no arquivo
    const visit = {
      url: limitUrl(url),
      title: limitTitle(title),
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
    title = limitTitle(title)
    if (this.loaded) {
      if (!setHistoryTitle(this.space(spaceId), url, title)) return
    } else this.early.push({ kind: 'title', spaceId, url, title })
    this.enqueue(serializeTitle(spaceId, url, title))
  }

  private enqueue(line: string): void {
    this.buffer.push(line)
    this.lines++
    this.timer ??= setTimeout(() => this.saveNow(), DEBOUNCE_MS)
  }

  // reescreve o arquivo com o que está na memória (já inclui o que estava no buffer)
  private rewrite(): void {
    writeAtomic(this.path, serializeAll(this.histories))
    this.buffer = []
    this.lines = countEntries(this.histories)
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
      else appendFileSync(this.path, this.buffer.join(''))
    } catch (error) {
      console.error('[History][saveNow] falha ao gravar o histórico', error)
    }
    this.buffer = []
  }

  private needsCompaction(): boolean {
    return (
      this.loaded && this.lines > countEntries(this.histories) + COMPACT_SLACK
    )
  }
}
