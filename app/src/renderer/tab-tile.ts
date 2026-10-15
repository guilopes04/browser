// Aparência do tile de uma aba (letra, cor e rótulo): a mesma na sidebar aberta e na compacta.
import { getTabLabel } from '@shared/tab-label'
import {
  getFavoriteTileColor,
  getTileColor,
  getTileLetter
} from '@shared/tile-appearance'
import { NEW_TAB_TILE } from '@shared/tokens'
import type { Space, Tab } from '@shared/types'
import { getSiteName } from '@shared/url-parts'

export interface TabTile {
  label: string
  letter: string
  color: string
}

export function getTabTile(tab: Tab, spaces: Space[]): TabTile {
  const label = getTabLabel(tab.title, tab.url)
  if (tab.url === '') return { label, letter: '+', color: NEW_TAB_TILE }
  return {
    label,
    letter: getTileLetter(tab.title, tab.url),
    color:
      getFavoriteTileColor(spaces, tab.url) ??
      getTileColor(getSiteName(tab.url) || label)
  }
}
