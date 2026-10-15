// Texto digitado -> URL ou busca. Puro.
import { isLocalFileUrl } from './is-local-file-url'

const SCHEME = /^https?:\/\//i
// servidor local: localhost, *.localhost, IP e IPv6
const LOCAL_HOST =
  /^(localhost|[^\s/?#:@]+\.localhost|\[[0-9a-f:]+\]|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#].*)?$/i
// domínios reservados ou de rede local (app.test:8080): servidores de desenvolvimento, sem TLS
const PRIVATE_DOMAIN =
  /^[^\s/?#:@]+\.(test|local|localdomain|internal|lan|home\.arpa)(:\d+)?([/?#].*)?$/i
const DOMAIN = /^[^\s/?#:@]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i

export interface ResolvedInput {
  url: string
  // só quando o texto era um domínio sem esquema: vai de https e, se o servidor não falar
  // TLS, o app tenta esta versão http
  httpFallback: string | null
  // só quando o texto era um arquivo local (file://): url vem vazia e nada é aberto
  refused?: 'local-file'
}

export function resolveTyped(input: string, searchUrl: string): ResolvedInput {
  const text = input.trim()
  const plain = (url: string): ResolvedInput => ({ url, httpFallback: null })
  if (!text) return plain('')
  // arquivo local: esta versão não abre (a página de erro explica)
  if (!/\s/.test(text) && isLocalFileUrl(text))
    return { url: '', httpFallback: null, refused: 'local-file' }
  if (text === 'about:blank') return plain(text)
  if (SCHEME.test(text)) return plain(text)
  if (LOCAL_HOST.test(text) || PRIVATE_DOMAIN.test(text))
    return plain(`http://${text}`)
  if (!/\s/.test(text) && DOMAIN.test(text))
    return { url: `https://${text}`, httpFallback: `http://${text}` }
  return plain(searchUrl.replace('%s', encodeURIComponent(text)))
}

export function resolveInput(input: string, searchUrl: string): string {
  return resolveTyped(input, searchUrl).url
}
