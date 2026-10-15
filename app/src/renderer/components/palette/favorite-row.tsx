import { displayUrl } from '@shared/display-url'
import { sanitizeTitle } from '@shared/sanitize-title'
import { stripScheme } from '@shared/url-key'
import { getTileColor } from '@shared/tile-appearance'
import { getFavoriteLetter } from '../../favorite-letter'
import { snapshot } from '../../state'
import { Tile } from '../tile'
import { SpaceChip } from './space-chip'
import type { PaletteRowProps } from './types'

export function FavoriteRow({ item }: PaletteRowProps) {
  if (item.kind !== 'favorite') return null
  const space = snapshot.value?.spaces.find(entry => entry.id === item.spaceId)
  const favorite = space?.favorites.find(entry => entry.id === item.favoriteId)
  return (
    <>
      <Tile
        size={24}
        letter={favorite?.letter ?? getFavoriteLetter(item.title, item.url)}
        color={favorite?.tile || getTileColor(item.title)}
        favicon={favorite?.favicon ?? null}
      />
      <span class="pal-title">{sanitizeTitle(item.title)}</span>
      <SpaceChip spaceId={item.spaceId} />
      <span class="pal-right">
        {displayUrl(stripScheme(item.url)).replace(/\/$/, '')}
      </span>
    </>
  )
}
