// Página pública não alcança a rede local. Um site da internet (iniciador público) que peça algo
// em localhost, num IP de rede privada, em um nome .local ou num nome que a DNS aponta para a rede
// local (rebinding) tem o pedido cancelado na sessão do espaço. Páginas da própria rede local
// (localhost:3000 chamando localhost:8080, um painel interno) e o que o usuário digita na barra
// de endereço (sem iniciador) passam.
//
// A zona do iniciador é a da conexão que carregou o documento, lembrada por origem:
// - nome público que a DNS vira para 127.0.0.1 depois do carregamento (rebinding) continua
//   "público" e o destino, que resolve para a rede local, é cancelado;
// - a zona de uma origem nunca passa de pública a privada na sessão. Sem isto, a página criava um
//   <iframe> da própria origem depois de a DNS virar: o documento "carregava" do loopback, a origem
//   do atacante virava privada e ele alcançava a rede local inteira. Um pedido cancelado também não
//   grava zona nenhuma;
// - o endereço IP que respondeu de verdade (onHeadersReceived) só pode rebaixar a origem a pública:
//   se a DNS disse "privado" para a nossa consulta e o Chromium conectou num IP público, vale o IP;
// - origem sem registro (a lista é limitada, ou o documento veio de fora) conta como pública quando
//   é um nome de DNS: resolver o nome agora devolveria o que o atacante quiser.
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

// a resposta de um pedido (onHeadersReceived)
export interface GuardResponse {
  url: string
  resourceType: string
  // endereço IP que respondeu de verdade; ausente em respostas do cache
  ip?: string
}

export interface LocalNetworkGuard {
  shouldBlock(request: GuardRequest): Promise<boolean>
  // o IP real da conexão de um documento: só rebaixa a origem a pública
  observeResponse(response: GuardResponse): void
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

function isDocument(resourceType: string): boolean {
  return resourceType === 'mainFrame' || resourceType === 'subFrame'
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

  // zona pelo texto do host: literais e nomes de rede local. Nome de DNS não tem zona pelo texto
  const zoneOfText = (host: string): Zone | null => {
    if (isPrivateHost(host)) return 'private'
    return isIpLiteral(host) ? 'public' : null
  }

  // zona de um documento que vai carregar: pelo texto ou pela resolução (privada só se todos os
  // endereços forem de rede local). Nome que não resolve não diz nada: null
  const zoneOfHost = async (host: string): Promise<Zone | null> => {
    const byText = zoneOfText(host)
    if (byText) return byText
    const addresses = await lookup(host)
    if (addresses.length === 0) return null
    return addresses.every(isPrivateAddress) ? 'private' : 'public'
  }

  // uma origem pública continua pública até o app reiniciar; privada pode ser rebaixada a pública
  const recordZone = (origin: string, zone: Zone) => {
    if (zone === 'private' && zones.get(origin) === 'public') return
    remember(zones, origin, zone, MAX_ZONES)
  }

  const destinationIsPrivate = async (host: string): Promise<boolean> => {
    if (isPrivateHost(host)) return true
    if (isIpLiteral(host)) return false
    return (await lookup(host)).some(isPrivateAddress)
  }

  const initiatorZone = (request: GuardRequest): Zone | null => {
    let origin = originOf(request.initiatorOrigin ?? '')
    // origem opaca (iframe com sandbox, data:): vale a página de topo da aba
    if (!origin && request.initiatorOrigin === 'null' && request.topUrl)
      origin = originOf(request.topUrl)
    if (!origin) return null
    const known = zones.get(origin)
    if (known) {
      // quem está pedindo agora é o que menos deve sair da lista
      remember(zones, origin, known, MAX_ZONES)
      return known
    }
    const host = getNetworkHost(origin)
    if (!host) return null
    // sem registro: nome de DNS conta como público (ver o cabeçalho)
    return zoneOfText(host) ?? 'public'
  }

  const isBlocked = async (
    request: GuardRequest,
    destHost: string
  ): Promise<boolean> => {
    // sem iniciador: o próprio navegador (endereço digitado, restauração da sessão)
    if (request.initiatorOrigin === undefined) return false
    const zone = initiatorZone(request)
    if (zone === null || zone === 'private') return false
    return destinationIsPrivate(destHost)
  }

  return {
    async shouldBlock(request) {
      const destHost = getNetworkHost(request.url)
      if (!destHost) return false
      const block = await isBlocked(request, destHost)
      // o documento que está para carregar grava a zona da conexão dele, mas só se o pedido
      // segue: um iframe cancelado não carrega nada e não pode mexer na zona de ninguém
      const destOrigin = originOf(request.url)
      if (!block && destOrigin && isDocument(request.resourceType)) {
        const zone = await zoneOfHost(destHost)
        if (zone) recordZone(destOrigin, zone)
      }
      return block
    },

    observeResponse({ url, resourceType, ip }) {
      if (!ip || !isDocument(resourceType)) return
      const host = getNetworkHost(url)
      const origin = originOf(url)
      // literais e nomes de rede local têm zona pelo texto; atrás de um proxy o IP é o dele
      if (!host || !origin || zoneOfText(host)) return
      // só rebaixa: um IP privado não prova que a página é da rede local
      if (!isPrivateAddress(ip)) recordZone(origin, 'public')
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
  // o IP que respondeu de verdade ao documento (a nossa consulta de DNS pode ter dado outra
  // resposta que a do Chromium). Os cabeçalhos chegam antes de o documento executar qualquer
  // coisa; onResponseStarted não dispara no Electron 44, e onCompleted vem tarde demais. O campo
  // `ip` existe em tempo de execução mas não nos tipos. O pedido nunca é cancelado por aqui: atrás
  // de um proxy o IP é o do proxy
  ses.webRequest.onHeadersReceived(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      try {
        guard.observeResponse({
          url: details.url,
          resourceType: details.resourceType,
          ip: (details as { ip?: string }).ip
        })
      } finally {
        callback({})
      }
    }
  )
}
