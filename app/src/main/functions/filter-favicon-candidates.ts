// O favicon é baixado pelo main (sem a trava de rede local do renderer): uma página da internet
// não pode apontar o ícone para localhost, um IP de rede privada ou um nome .local. Páginas da
// própria rede local podem ter o ícone onde quiserem. Puro.
import { getNetworkHost, isPrivateHost } from '@shared/private-network'

export function filterFaviconCandidates(
  pageUrl: string,
  candidates: string[]
): string[] {
  const pageHost = getNetworkHost(pageUrl)
  if (pageHost !== null && isPrivateHost(pageHost)) return candidates
  return candidates.filter(candidate => {
    const host = getNetworkHost(candidate)
    return host === null || !isPrivateHost(host)
  })
}
