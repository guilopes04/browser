// Separa o host em subdomínios e domínio registrável ("mail.google.com" -> "mail." + "google.com"),
// para o endereço destacar o que de fato identifica o site. Sem a lista pública de sufixos
// inteira (ela passa de 9 mil entradas): vale a regra dos dois últimos rótulos, mais os sufixos
// de duas partes mais usados (com.br, co.uk, gov.br...) e as plataformas em que cada subdomínio é
// um site diferente (github.io, vercel.app...). Pura.

function pairs(second: string[], tld: string): string[] {
  return second.map(label => `${label}.${tld}`)
}

const MULTI_LABEL_SUFFIXES: ReadonlySet<string> = new Set([
  ...pairs(
    [
      'com',
      'net',
      'org',
      'gov',
      'edu',
      'mil',
      'art',
      'blog',
      'eco',
      'emp',
      'ind',
      'inf',
      'jus',
      'leg',
      'mp',
      'tv',
      'adm',
      'adv',
      'arq',
      'bio',
      'eng',
      'med',
      'pro',
      'psi',
      'rec',
      'srv',
      'tur',
      'vet'
    ],
    'br'
  ),
  ...pairs(
    ['co', 'org', 'ac', 'gov', 'me', 'ltd', 'plc', 'net', 'sch', 'nhs'],
    'uk'
  ),
  ...pairs(['com', 'net', 'org', 'edu', 'gov', 'asn', 'id'], 'au'),
  ...pairs(['co', 'net', 'org', 'govt', 'ac', 'school', 'geek'], 'nz'),
  ...pairs(['co', 'ne', 'or', 'ac', 'go', 'ad', 'ed', 'gr', 'lg'], 'jp'),
  ...pairs(['co', 'or', 'ne', 'go', 're', 'ac'], 'kr'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu', 'ac'], 'cn'),
  ...pairs(['co', 'net', 'org', 'gov', 'ac', 'res', 'edu'], 'in'),
  ...pairs(['co', 'net', 'org', 'gov', 'ac', 'web'], 'za'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu', 'mil', 'int'], 'ar'),
  ...pairs(['com', 'net', 'org', 'gob', 'edu'], 'mx'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'co'),
  ...pairs(['com', 'net', 'org', 'gob', 'edu'], 'pe'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu', 'k12', 'gen'], 'tr'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu', 'per'], 'sg'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu', 'idv'], 'hk'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu', 'idv'], 'tw'),
  ...pairs(['co', 'or', 'go', 'ac', 'web'], 'id'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'my'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'ph'),
  ...pairs(['co', 'or', 'go', 'ac', 'in'], 'th'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'vn'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'pl'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'ua'),
  ...pairs(['co', 'org', 'net', 'gov', 'ac'], 'il'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'eg'),
  ...pairs(['com', 'net', 'org', 'gov', 'edu'], 'sa'),
  ...pairs(['co', 'net', 'org', 'gov', 'ac'], 'ae'),
  ...pairs(['com', 'org', 'gov', 'edu'], 'pt'),
  ...pairs(['com', 'nom', 'org', 'gob', 'edu'], 'es'),
  ...pairs(['com', 'asso', 'gouv'], 'fr')
])

// plataformas de hospedagem: cada subdomínio é de um dono (evil.github.io não é github.io)
const HOSTING_SUFFIXES: ReadonlySet<string> = new Set([
  'github.io',
  'gitlab.io',
  'bitbucket.io',
  'herokuapp.com',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'web.app',
  'firebaseapp.com',
  'appspot.com',
  'blogspot.com',
  'wordpress.com',
  'azurewebsites.net',
  'cloudfront.net',
  'amazonaws.com',
  'onrender.com',
  'fly.dev',
  'glitch.me',
  'repl.co',
  'replit.app',
  'surge.sh',
  'ngrok.io',
  'ngrok-free.app',
  'myshopify.com',
  'wixsite.com',
  'weebly.com',
  'trycloudflare.com'
])

export interface HostParts {
  // com o ponto final ("mail."); vazio quando o host é só o domínio
  subdomain: string
  // o domínio registrável (ou o host inteiro, no caso de IP, localhost e nome de uma parte)
  domain: string
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export function splitHost(hostname: string): HostParts {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  // IP, IPv6 e nome de uma parte só (localhost, intranet) não têm subdomínio
  if (
    host === '' ||
    IPV4.test(host) ||
    host.includes(':') ||
    !host.includes('.')
  )
    return { subdomain: '', domain: host }
  const labels = host.split('.')
  const lastTwo = labels.slice(-2).join('.')
  // sufixo de duas partes: o domínio leva mais uma ("exemplo" em exemplo.com.br)
  const domainLength =
    MULTI_LABEL_SUFFIXES.has(lastTwo) || HOSTING_SUFFIXES.has(lastTwo) ? 3 : 2
  const cut = Math.max(0, labels.length - domainLength)
  return {
    subdomain: cut > 0 ? `${labels.slice(0, cut).join('.')}.` : '',
    domain: labels.slice(cut).join('.')
  }
}
