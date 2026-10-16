// O endereço como o campo da sidebar o mostra: o host dividido em subdomínios e domínio
// registrável (que sempre aparece, com peso de destaque), o caminho em texto secundário e o
// aviso de conexão sem criptografia (http). Sem isto, um host comprido do tipo
// "contas.google.com.sessao.exemplo.tk" era cortado no fim e escondia o domínio verdadeiro.
// O campo corta primeiro o caminho, depois os subdomínios e depois o texto "Não seguro" (fica o
// cadeado); o domínio nunca é cortado: se não cabe numa linha, quebra em várias (address-field.tsx).
// O host é decodificado de punycode só quando é seguro (idn-host.ts). Pura.
import { displayUrl } from './display-url'
import { displayHostname } from './idn-host'
import { splitHost } from './registrable-domain'

export type AddressKind = 'web' | 'file' | 'about' | 'other'

export interface AddressParts {
  kind: AddressKind
  // http: a conexão não é criptografada
  insecure: boolean
  // "mail." (com o ponto final) ou vazio
  subdomain: string
  // domínio registrável, com a porta ("exemplo.com.br:8080"); em arquivo e about, o rótulo
  domain: string
  path: string
  // o host completo, para tooltip e leitor de tela
  host: string
}

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

// blob:http://host/uuid é uma página da origem que o criou (o host dela, a conexão dela); o que
// vem depois de "blob:" é o endereço dessa origem. null quando não é blob ou a origem não é web
function blobOrigin(parsed: URL): URL | null {
  if (parsed.protocol !== 'blob:') return null
  const inner = parse(parsed.pathname)
  return inner && (inner.protocol === 'http:' || inner.protocol === 'https:')
    ? inner
    : null
}

export function isInsecureUrl(url: string): boolean {
  const parsed = parse(url)
  if (!parsed) return false
  return (blobOrigin(parsed) ?? parsed).protocol === 'http:'
}

const EMPTY: AddressParts = {
  kind: 'other',
  insecure: false,
  subdomain: '',
  domain: '',
  path: '',
  host: ''
}

export function describeAddress(url: string): AddressParts {
  const parsed = parse(url)
  if (!parsed) return EMPTY
  if (parsed.protocol === 'about:')
    return { ...EMPTY, kind: 'about', domain: parsed.href, host: parsed.href }
  if (parsed.protocol === 'file:')
    return {
      ...EMPTY,
      kind: 'file',
      domain: 'arquivo local',
      path: displayUrl(parsed.pathname),
      host: 'arquivo local'
    }

  // blob: sem origem web (blob:null/...): não há host para mostrar, só o esquema
  if (parsed.protocol === 'blob:' && !blobOrigin(parsed))
    return {
      ...EMPTY,
      domain: 'blob:',
      path: displayUrl(parsed.pathname),
      host: 'blob:'
    }

  // blob: tem o host e a conexão da origem que o criou; o esquema aparece antes do caminho
  const origin = blobOrigin(parsed) ?? parsed
  const scheme = origin === parsed ? '' : 'blob:'
  const hostname = displayHostname(origin.hostname.replace(/^www\./, ''))
  const { subdomain, domain } = splitHost(hostname)
  const port = origin.port ? `:${origin.port}` : ''
  const rest = origin.pathname + parsed.search + parsed.hash
  return {
    kind: 'web',
    insecure: origin.protocol === 'http:',
    subdomain,
    domain: domain + port,
    // o caminho é para ler: acentos aparecem decodificados
    path: scheme + (rest === '/' ? '' : displayUrl(rest)),
    host: hostname + port
  }
}
