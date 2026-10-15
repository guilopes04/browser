// O esquema de um endereço que a página quer abrir fora do navegador (mailto:, tel:, x-...:).
// Puro.

// o que o próprio navegador abre: nunca passa por "abrir em outro app"
const BROWSER_SCHEMES = new Set([
  'http',
  'https',
  'file',
  'about',
  'blob',
  'data',
  'javascript',
  'app',
  'devtools',
  'chrome',
  'view-source'
])

// "mailto" em "mailto:a@b.com"; null quando não é um esquema (ou é do navegador)
export function externalSchemeOf(url: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim())
  if (!match) return null
  const scheme = match[1].toLowerCase()
  return BROWSER_SCHEMES.has(scheme) ? null : scheme
}
