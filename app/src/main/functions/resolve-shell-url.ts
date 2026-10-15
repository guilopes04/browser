// Endereço da shell. Empacotado, é sempre o protocolo do app (app://shell); a variável
// ELECTRON_RENDERER_URL (servidor do electron-vite) só vale no desenvolvimento e só como
// http://localhost:<porta>. Qualquer outra coisa ali, ou um app empacotado com a variável
// definida por quem o lança, volta para app://shell. Puro.
export const SHELL_URL = 'app://shell/index.html'

function isDevServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'http:' &&
      parsed.hostname === 'localhost' &&
      /^\d{1,5}$/.test(parsed.port) &&
      Number(parsed.port) > 0 &&
      Number(parsed.port) < 65536 &&
      parsed.username === '' &&
      parsed.password === ''
    )
  } catch {
    return false
  }
}

export function resolveShellUrl(
  rendererUrl: string | undefined,
  packaged: boolean
): string {
  if (!packaged && rendererUrl && isDevServerUrl(rendererUrl))
    return rendererUrl
  return SHELL_URL
}
