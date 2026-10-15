// Histórico de um espaço em memória: lista da mais recente para a mais antiga e um índice pela
// chave do endereço. A mesma página aparece uma vez só, mesmo com outra âncora (ver toUrlKey).
import type { HistoryEntry, SpaceId } from '@shared/types'
import { toUrlKey } from '@shared/url-key'

// no total, somando os espaços: o histórico inteiro fica na memória (cerca de 0,4 KB por entrada,
// com o texto normalizado), então o limite não pode crescer com o número de espaços
export const MAX_HISTORY = 20_000

export interface SpaceHistory {
  list: HistoryEntry[]
  byKey: Map<string, HistoryEntry>
}

export function createSpaceHistory(): SpaceHistory {
  return { list: [], byKey: new Map() }
}

export function countEntries(histories: Map<SpaceId, SpaceHistory>): number {
  let total = 0
  for (const history of histories.values()) total += history.list.length
  return total
}

// descarta as visitas mais antigas, de qualquer espaço, até sobrar `max` no total
export function trimHistory(
  histories: Map<SpaceId, SpaceHistory>,
  max = MAX_HISTORY
): void {
  let excess = countEntries(histories) - max
  while (excess-- > 0) {
    let oldest: SpaceHistory | null = null
    for (const history of histories.values()) {
      const last = history.list[history.list.length - 1]
      if (!last) continue
      if (
        !oldest ||
        last.visitedAt < oldest.list[oldest.list.length - 1].visitedAt
      )
        oldest = history
    }
    const dropped = oldest?.list.pop()
    if (!oldest || !dropped) return
    oldest.byKey.delete(dropped.key ?? toUrlKey(dropped.url))
  }
}

// a visita vai para o começo e substitui a anterior da mesma página (fica o endereço mais novo,
// com a âncora em que a pessoa parou). Título vazio não apaga o que já se sabe
export function addHistoryEntry(
  history: SpaceHistory,
  visit: { url: string; title: string; visitedAt: number }
): void {
  const key = toUrlKey(visit.url)
  const existing = history.byKey.get(key)
  const title = visit.title || existing?.title || ''
  if (existing) history.list.splice(history.list.indexOf(existing), 1)
  const entry: HistoryEntry = {
    url: visit.url,
    title,
    visitedAt: visit.visitedAt,
    key
  }
  history.list.unshift(entry)
  history.byKey.set(key, entry)
}

// junta o histórico `source` (o formato antigo) ao `target`: a mesma página fica uma vez só, com
// a visita mais nova, e a lista continua da mais recente para a mais antiga
export function mergeSpaceHistory(
  target: SpaceHistory,
  source: SpaceHistory
): void {
  for (const entry of source.list) {
    const key = entry.key ?? toUrlKey(entry.url)
    const existing = target.byKey.get(key)
    if (!existing) {
      target.list.push(entry)
      target.byKey.set(key, entry)
      continue
    }
    const newer = entry.visitedAt > existing.visitedAt
    if (entry.title && (newer || !existing.title)) {
      existing.title = entry.title
      existing.search = undefined
    }
    if (newer) {
      existing.url = entry.url
      existing.visitedAt = entry.visitedAt
      existing.search = undefined
    }
  }
  target.list.sort((a, b) => b.visitedAt - a.visitedAt)
}

// o título chega depois da navegação: atualiza a entrada da página. Devolve se mudou
export function setHistoryTitle(
  history: SpaceHistory,
  url: string,
  title: string
): boolean {
  const entry = history.byKey.get(toUrlKey(url))
  if (!entry || !title || entry.title === title) return false
  entry.title = title
  entry.search = undefined
  return true
}
