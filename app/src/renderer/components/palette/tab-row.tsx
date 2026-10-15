import { displayUrl } from '@shared/display-url'
import { stripScheme } from '@shared/url-key'
import {
  getFavoriteTileColor,
  getTileColor,
  getTileLetter
} from '@shared/tile-appearance'
import { getSiteName } from '@shared/url-parts'
import { snapshot } from '../../state'
import { getTabTile } from '../../tab-tile'
import { Tile } from '../tile'
import { Kbd } from './kbd'
import { SpaceChip } from './space-chip'
import type { PaletteRowProps } from './types'

export function TabRow({ item, compact, selected }: PaletteRowProps) {
  if (item.kind !== 'tab') return null
  const snap = snapshot.value
  const tab = snap?.tabs.find(other => other.id === item.tabId)
  const spaces = snap?.spaces ?? []
  const tile = tab
    ? getTabTile(tab, spaces)
    : {
        label: item.title,
        letter: getTileLetter(item.title, item.url),
        color:
          getFavoriteTileColor(spaces, item.url) ??
          getTileColor(getSiteName(item.url) || item.title)
      }
  const spaceName = spaces.find(space => space.id === item.spaceId)?.name ?? ''

  if (compact) {
    return (
      <>
        <Tile
          size={24}
          letter={tile.letter}
          color={tile.color}
          favicon={tab?.favicon ?? null}
        />
        <span class="pal-title">{item.title}</span>
        <span class="pal-right">{spaceName}</span>
      </>
    )
  }
  return (
    <>
      <Tile
        size={24}
        letter={tile.letter}
        color={tile.color}
        favicon={tab?.favicon ?? null}
      />
      <div class="pal-two-lines">
        <span class="pal-title pal-title-strong">{item.title}</span>
        <span class="pal-sub">
          {displayUrl(stripScheme(item.url)).replace(/\/$/, '')}
        </span>
      </div>
      <SpaceChip spaceId={item.spaceId} />
      {selected && <span class="pal-hint">Ir para a aba</span>}
      {selected && <Kbd keys="↵" />}
    </>
  )
}
