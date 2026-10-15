// só páginas de verdade entram no histórico: nada de about:blank, data:, blob: ou a própria interface
export function isHistoryUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
