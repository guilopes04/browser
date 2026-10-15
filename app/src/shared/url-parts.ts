// Partes de uma URL: hostname, domínio e caminho, nome do site. Puro; usado por main e renderer.
import { displayUrl } from './display-url'

export function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function getHostname(url: string): string {
  const parsed = parseUrl(url)
  if (!parsed) return ''
  return parsed.hostname.replace(/^www\./, '')
}

// domínio em destaque e caminho em texto secundário (campo de endereço)
export function splitUrl(url: string): { domain: string; path: string } {
  const parsed = parseUrl(url)
  if (!parsed) return { domain: '', path: '' }
  if (parsed.protocol === 'about:') return { domain: parsed.href, path: '' }
  if (parsed.protocol === 'file:')
    return { domain: 'arquivo local', path: displayUrl(parsed.pathname) }
  const domain =
    parsed.hostname.replace(/^www\./, '') +
    (parsed.port ? `:${parsed.port}` : '')
  const rest = parsed.pathname + parsed.search + parsed.hash
  // o caminho é para ler: acentos aparecem decodificados
  return { domain, path: rest === '/' ? '' : displayUrl(rest) }
}

const COMPOUND_SECOND_LEVEL = new Set([
  'co',
  'com',
  'org',
  'net',
  'gov',
  'edu',
  'ac'
])

// nome do site: "developer.mozilla.org" -> "mozilla"; "github.co.uk" -> "github"
export function getSiteName(url: string): string {
  const hostname = getHostname(url)
  // IP e IPv6 não têm "nome do site"
  if (
    /^[\d.]+$/.test(hostname) ||
    hostname.includes(':') ||
    hostname.startsWith('[')
  )
    return hostname
  const labels = hostname.split('.').filter(Boolean)
  if (labels.length <= 1) return labels[0] ?? ''
  const last = labels[labels.length - 1]
  const secondLast = labels[labels.length - 2]
  if (
    labels.length >= 3 &&
    last.length === 2 &&
    COMPOUND_SECOND_LEVEL.has(secondLast)
  ) {
    return labels[labels.length - 3]
  }
  return secondLast
}
