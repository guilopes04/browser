// Cor e letra do tile de um site (favicon ausente). Puro.
import { TILE_COLORS } from './tokens'
import type { Space } from './types'
import { getHostname, getSiteName } from './url-parts'

export function hashString(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i++)
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

export function getTileColor(seed: string): string {
  return TILE_COLORS[hashString(seed) % TILE_COLORS.length]
}

// cor do favorito do mesmo site (host igual ou subdomínio dele), para a aba aberta ter o
// mesmo tile do favorito; null quando nenhum favorito combina
export function getFavoriteTileColor(
  spaces: Space[],
  url: string
): string | null {
  const host = getHostname(url)
  if (!host) return null
  for (const space of spaces) {
    for (const favorite of space.favorites) {
      const favoriteHost = getHostname(favorite.url)
      if (
        favoriteHost &&
        (host === favoriteHost || host.endsWith(`.${favoriteHost}`))
      )
        return favorite.tile
    }
  }
  return null
}

// letra do tile: 1ª letra do nome do site; sem site, do título
export function getTileLetter(title: string, url: string): string {
  const source = getSiteName(url) || title.trim()
  const first = Array.from(source)[0]
  return first ? first.toLocaleUpperCase('pt-BR') : '?'
}
