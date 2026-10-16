// --ip-address-space-overrides=<ip>:<porta>=<espaço>[,...]: a opção de teste do Chromium que diz em
// que espaço de endereços um endereço IP e porta estão ("public", "private" ou "local", que é o
// loopback), para simular uma página pública em 127.0.0.1. O Chromium usa isso no próprio cálculo
// de rede local, que no Electron não impede nada (o CDP mostra initiatorIPAddressSpace=Public e a
// política de acesso à rede local em Allow). A guarda do app (local-network-guard.ts) respeita a
// mesma declaração: quem declarou "public" é página pública e não alcança a rede local, mesmo com o
// endereço de loopback. Puro.
//
// Só vale para endereço IP escrito na URL (o nome "localhost" conta como 127.0.0.1 e ::1).

export type OverrideSpace = 'public' | 'private'

export interface AddressSpaceOverrides {
  // o espaço declarado para o host e a porta da URL; null quando a opção não diz nada dele
  spaceOf(url: string): OverrideSpace | null
}

const DEFAULT_PORTS: Record<string, string> = {
  'http:': '80',
  'ws:': '80',
  'https:': '443',
  'wss:': '443'
}
const LOOPBACK_NAMES = ['127.0.0.1', '[::1]']

function parseSpace(text: string): OverrideSpace | null {
  const space = text.trim().toLowerCase()
  if (space === 'public') return 'public'
  // "local" é o loopback, e "private" a rede privada: as duas são rede local
  if (space === 'private' || space === 'local') return 'private'
  return null
}

// "127.0.0.1:9701" ou "[::1]:9701" -> a chave "127.0.0.1:9701"
function endpointKey(endpoint: string): string | null {
  try {
    const parsed = new URL(`http://${endpoint.trim()}`)
    if (parsed.hostname === '' || parsed.username || parsed.pathname !== '/')
      return null
    return `${parsed.hostname}:${parsed.port || DEFAULT_PORTS['http:']}`
  } catch {
    return null
  }
}

export function parseAddressSpaceOverrides(raw: string): AddressSpaceOverrides {
  const table = new Map<string, OverrideSpace>()
  for (const entry of raw.split(',')) {
    const [endpoint, space, ...rest] = entry.split('=')
    if (!endpoint || !space || rest.length > 0) continue
    const key = endpointKey(endpoint)
    const parsedSpace = parseSpace(space)
    if (key && parsedSpace) table.set(key, parsedSpace)
  }
  return {
    spaceOf(url) {
      if (table.size === 0) return null
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        return null
      }
      const port = parsed.port || DEFAULT_PORTS[parsed.protocol]
      if (!port) return null
      const hosts =
        parsed.hostname.toLowerCase() === 'localhost'
          ? LOOPBACK_NAMES
          : [parsed.hostname.toLowerCase()]
      for (const host of hosts) {
        const space = table.get(`${host}:${port}`)
        if (space) return space
      }
      return null
    }
  }
}

export const NO_OVERRIDES: AddressSpaceOverrides = { spaceOf: () => null }
