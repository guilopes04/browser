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

export function isInsecureUrl(url: string): boolean {
  return parse(url)?.protocol === 'http:'
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

  const hostname = displayHostname(parsed.hostname.replace(/^www\./, ''))
  const { subdomain, domain } = splitHost(hostname)
  const port = parsed.port ? `:${parsed.port}` : ''
  const rest = parsed.pathname + parsed.search + parsed.hash
  return {
    kind: 'web',
    insecure: parsed.protocol === 'http:',
    subdomain,
    domain: domain + port,
    // o caminho é para ler: acentos aparecem decodificados
    path: rest === '/' ? '' : displayUrl(rest),
    host: hostname + port
  }
}
