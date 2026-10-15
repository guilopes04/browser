// Rede local x internet: endereços e nomes que só existem dentro da casa do usuário (loopback,
// redes privadas, link-local, CGNAT, multicast) e nomes de rede local (localhost, .local, nomes
// sem ponto). Puro; serve ao bloqueio de páginas públicas que tentam alcançar a rede local.

const PRIVATE_SUFFIXES = [
  'localhost',
  'local',
  'localdomain',
  'internal',
  'intranet',
  'lan',
  'home.arpa',
  'test'
]

// "127.0.0.1" -> [127, 0, 0, 1]; null quando não é um IPv4 em notação decimal pontuada
export function parseIPv4(text: string): number[] | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  const bytes: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (value > 255) return null
    bytes.push(value)
  }
  return bytes
}

// IPv6 em oito grupos de 16 bits (aceita "::" e IPv4 no final); null quando é inválido
export function parseIPv6(text: string): number[] | null {
  let source = text
  const percent = source.indexOf('%')
  if (percent !== -1) source = source.slice(0, percent)
  if (!source.includes(':')) return null

  // IPv4 no final ("::ffff:127.0.0.1") ocupa os dois últimos grupos
  const lastColon = source.lastIndexOf(':')
  const tail = source.slice(lastColon + 1)
  if (tail.includes('.')) {
    const bytes = parseIPv4(tail)
    if (!bytes) return null
    const high = ((bytes[0] << 8) | bytes[1]).toString(16)
    const low = ((bytes[2] << 8) | bytes[3]).toString(16)
    source = `${source.slice(0, lastColon + 1)}${high}:${low}`
  }

  const halves = source.split('::')
  if (halves.length > 2) return null
  const toGroups = (part: string): number[] | null => {
    if (part === '') return []
    const groups: number[] = []
    for (const group of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
      groups.push(parseInt(group, 16))
    }
    return groups
  }
  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : []
  if (!head || !rest) return null
  if (halves.length === 1) return head.length === 8 ? head : null
  const missing = 8 - head.length - rest.length
  if (missing < 1) return null
  return [...head, ...new Array<number>(missing).fill(0), ...rest]
}

function isPrivateIPv4(bytes: number[]): boolean {
  const [a, b, c] = bytes
  return (
    a === 0 || // 0.0.0.0/8 ("este computador")
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT (e redes como Tailscale)
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast, reservado e o broadcast
  )
}

function embeddedIPv4(groups: number[], from: number): number[] {
  return [
    groups[from] >> 8,
    groups[from] & 0xff,
    groups[from + 1] >> 8,
    groups[from + 1] & 0xff
  ]
}

function isPrivateIPv6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5] = groups
  const zeroPrefix = groups.slice(0, 5).every(group => group === 0)
  // ::1 e ::
  if (groups.slice(0, 7).every(group => group === 0) && groups[7] <= 1)
    return true
  // ::ffff:a.b.c.d (IPv4 mapeado) e ::a.b.c.d (compatível, obsoleto)
  if (zeroPrefix && (g5 === 0xffff || g5 === 0))
    return isPrivateIPv4(embeddedIPv4(groups, 6))
  // 64:ff9b::/96 (NAT64)
  if (
    g0 === 0x64 &&
    g1 === 0xff9b &&
    g2 === 0 &&
    g3 === 0 &&
    g4 === 0 &&
    g5 === 0
  )
    return isPrivateIPv4(embeddedIPv4(groups, 6))
  // 2002::/16 (6to4) leva um IPv4 nos bits 16 a 48
  if (g0 === 0x2002) return isPrivateIPv4(embeddedIPv4(groups, 1))
  return (
    (g0 & 0xfe00) === 0xfc00 || // fc00::/7 (ULA)
    (g0 & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
    (g0 & 0xffc0) === 0xfec0 || // fec0::/10 (site-local, obsoleto)
    (g0 & 0xff00) === 0xff00 // ff00::/8 (multicast)
  )
}

// o endereço (IPv4 ou IPv6, com ou sem colchetes) é de rede local? Texto que não é endereço: false
export function isPrivateAddress(address: string): boolean {
  const text = address.trim().replace(/^\[|\]$/g, '')
  const v4 = parseIPv4(text)
  if (v4) return isPrivateIPv4(v4)
  const v6 = parseIPv6(text)
  return v6 ? isPrivateIPv6(v6) : false
}

export function isIpLiteral(host: string): boolean {
  const text = host.replace(/^\[|\]$/g, '')
  return parseIPv4(text) !== null || parseIPv6(text) !== null
}

// minúsculas, sem colchetes do IPv6 nem ponto final de domínio absoluto
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
}

// nomes que nunca apontam para a internet pública: localhost, domínios reservados ou de rede
// local e nomes de uma palavra só (o roteador, a impressora), que só a rede local resolve
export function isPrivateHostname(host: string): boolean {
  const name = normalizeHost(host)
  if (name === '') return false
  if (!name.includes('.')) return true
  return PRIVATE_SUFFIXES.some(suffix => name.endsWith(`.${suffix}`))
}

// só olha o texto do host (sem consulta DNS): endereço de rede local ou nome de rede local
export function isPrivateHost(host: string): boolean {
  const name = normalizeHost(host)
  if (isIpLiteral(name)) return isPrivateAddress(name)
  return isPrivateHostname(name)
}

// host de um endereço http, https, ws ou wss; null para qualquer outro esquema
export function getNetworkHost(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!/^(https?|wss?):$/.test(parsed.protocol)) return null
    const host = normalizeHost(parsed.hostname)
    return host === '' ? null : host
  } catch {
    return null
  }
}
