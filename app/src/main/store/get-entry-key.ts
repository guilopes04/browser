// Chave de endereço de uma entrada do histórico (ver toUrlKey), calculada uma vez e guardada nela.
import type { HistoryEntry } from '@shared/types'
import { toUrlKey } from '@shared/url-key'

export function getEntryKey(entry: HistoryEntry): string {
  entry.key ??= toUrlKey(entry.url)
  return entry.key
}
