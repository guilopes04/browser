// A URL pertence à shell? Compara esquema e host (o origin de app:// é opaco no WHATWG URL).
export function isShellUrl(url: string, shellUrl: string): boolean {
  try {
    const candidate = new URL(url)
    const shell = new URL(shellUrl)
    return (
      candidate.protocol === shell.protocol && candidate.host === shell.host
    )
  } catch {
    return false
  }
}
