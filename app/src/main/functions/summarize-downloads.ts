// Progresso somado dos downloads em andamento. Pura.

export interface DownloadProgress {
  received: number
  // 0 = o servidor não informou o tamanho
  total: number
}

export function summarizeDownloads(items: DownloadProgress[]): {
  active: number
  percent: number | null
} {
  let received = 0
  let total = 0
  for (const item of items) {
    // sem tamanho conhecido não há como medir: esse download não entra na conta
    if (item.total <= 0) continue
    received += Math.min(item.received, item.total)
    total += item.total
  }
  return {
    active: items.length,
    percent: total > 0 ? Math.floor((received / total) * 100) : null
  }
}
