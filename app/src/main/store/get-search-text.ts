// Texto normalizado de uma entrada do histórico, calculado uma vez e guardado nela. Sem isso, cada
// tecla na paleta normalizaria todos os títulos e endereços de novo (27 ms com 20 mil entradas).
import { normalizeForMatch } from '@shared/match-palette'
import type { HistoryEntry, NormalizedText } from '@shared/types'

export function getSearchText(entry: HistoryEntry): NormalizedText {
  entry.search ??= normalizeForMatch(entry.title, entry.url)
  return entry.search
}
