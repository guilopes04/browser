// Endereço de arquivo local (file:// e view-source:file://). Esta versão não abre arquivos do Mac.
// Puro.

export function isLocalFileUrl(url: string): boolean {
  try {
    const { protocol, pathname } = new URL(url)
    if (protocol === 'file:') return true
    return protocol === 'view-source:' && isLocalFileUrl(pathname)
  } catch {
    return false
  }
}
