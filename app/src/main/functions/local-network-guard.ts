// Página pública não alcança a rede local. Um site da internet (iniciador público) que peça algo
// em localhost, num IP de rede privada, em um nome .local ou num nome que a DNS aponta para a rede
// local (rebinding) tem o pedido cancelado na sessão do espaço. Páginas da própria rede local
// (localhost:3000 chamando localhost:8080, um painel interno) e o que o usuário digita na barra
// de endereço (sem iniciador) passam.
//
// A zona do iniciador é a da conexão que carregou o documento, gravada quando o pedido do
// documento sai: um nome que a DNS vira para 127.0.0.1 depois do carregamento (rebinding) continua
// "público" e o destino, que resolve para a rede local, é cancelado.
import type { Session } from 'electron'
import {
  getNetworkHost,
  isIpLiteral,
  isPrivateAddress,
  isPrivateHost
} from '@shared/private-network'

export type HostResolver = (host: string) => Promise<string[]>

export interface GuardRequest {
  url: string
  resourceType: string
  // origem de quem fez o pedido (ausente: o próprio navegador, como a barra de endereço)
  initiatorOrigin?: string
  // endereço do documento de topo da aba, para quando a origem do iniciador é opaca ("null")
  topUrl?: string
}

export interface LocalNetworkGuard {
  shouldBlock(request: GuardRequest): Promise<boolean>
}

type Zone = 'private' | 'public'

const MAX_ZONES = 500
const MAX_RESOLVED = 256
// a DNS do Chromium já guarda o resultado; este prazo só poupa consultas repetidas no mesmo instante
const RESOLVED_TTL_MS = 2000

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url)
    return /^https?:$/.test(parsed.protocol) ? parsed.origin : null
  } catch {
    return null
  }
}

function remember<K, V>(map: Map<K, V>, key: K, value: V, max: number): void {
  map.delete(key)
  map.set(key, value)
  if (map.size > max) map.delete(map.keys().next().value as K)
}

export function createLocalNetworkGuard(
  resolve: HostResolver,
  now: () => number = Date.now
): LocalNetworkGuard {
  const zones = new Map<string, Zone>()
  const resolved = new Map<string, { addresses: string[]; at: number }>()

  const lookup = async (host: string): Promise<string[]> => {
    const cached = resolved.get(host)
    if (cached && now() - cached.at < RESOLVED_TTL_MS) return cached.addresses
    let addresses: string[]
    try {
      addresses = await resolve(host)
    } catch {
      addresses = []
    }
    remember(resolved, host, { addresses, at: now() }, MAX_RESOLVED)
    return addresses
  }

  // zona de um host: literais e nomes locais sem consulta; nome público pela resolução (privada só
  // se todos os endereços forem de rede local)
  const zoneOfHost = async (host: string): Promise<Zone> => {
    if (isPrivateHost(host)) return 'private'
    if (isIpLiteral(host)) return 'public'
    const addresses = await lookup(host)
    return addresses.length > 0 && addresses.every(isPrivateAddress)
      ? 'private'
      : 'public'
  }

  const destinationIsPrivate = async (host: string): Promise<boolean> => {
    if (isPrivateHost(host)) return true
    if (isIpLiteral(host)) return false
    return (await lookup(host)).some(isPrivateAddress)
  }

  const initiatorZone = async (request: GuardRequest): Promise<Zone | null> => {
    let origin = originOf(request.initiatorOrigin ?? '')
    // origem opaca (iframe com sandbox, data:): vale a página de topo da aba
    if (!origin && request.initiatorOrigin === 'null' && request.topUrl)
      origin = originOf(request.topUrl)
    if (!origin) return null
    const known = zones.get(origin)
    if (known) return known
    const host = getNetworkHost(origin)
    return host ? zoneOfHost(host) : null
  }

  return {
    async shouldBlock(request) {
      const destHost = getNetworkHost(request.url)
      const destOrigin = originOf(request.url)
      if (!destHost) return false

      // o documento que está para carregar: grava a zona da conexão dele
      if (
        destOrigin &&
        (request.resourceType === 'mainFrame' ||
          request.resourceType === 'subFrame')
      )
        remember(zones, destOrigin, await zoneOfHost(destHost), MAX_ZONES)

      // sem iniciador: o próprio navegador (endereço digitado, restauração da sessão)
      if (request.initiatorOrigin === undefined) return false
      const zone = await initiatorZone(request)
      if (zone === null || zone === 'private') return false
      return destinationIsPrivate(destHost)
    }
  }
}

export function installLocalNetworkGuard(ses: Session): void {
  const guard = createLocalNetworkGuard(async host => {
    const { endpoints } = await ses.resolveHost(host)
    return endpoints.map(endpoint => endpoint.address)
  })
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      let topUrl: string | undefined
      try {
        topUrl = details.webContents?.getURL()
      } catch {
        // a aba já foi destruída
      }
      guard
        .shouldBlock({
          url: details.url,
          resourceType: details.resourceType,
          initiatorOrigin: details.initiatorOrigin,
          topUrl
        })
        .then(
          block => callback({ cancel: block }),
          () => callback({ cancel: false })
        )
    }
  )
}
