import type { Space, Tab } from '@shared/types'
import { api } from '../../api'
import { hideTip, showTip } from '../../tip'
import { getTabShortcutLabel } from '../../tab-shortcut'
import { getTabTile } from '../../tab-tile'
import { Tile } from '../tile'

interface CompactTabProps {
  tab: Tab
  active: boolean
  index: number
  total: number
  spaces: Space[]
}

export function CompactTab({
  tab,
  active,
  index,
  total,
  spaces
}: CompactTabProps) {
  const { label, letter, color } = getTabTile(tab, spaces)
  const keys = getTabShortcutLabel(index, total)
  const state = [
    tab.dormant ? 'suspensa' : null,
    tab.muted ? 'silenciada' : tab.audible ? 'tocando' : null
  ].filter(Boolean)
  const description =
    state.length > 0 ? `${label} (${state.join(', ')})` : label

  return (
    <button
      type="button"
      class="compact-item"
      data-active={active}
      aria-label={description}
      aria-current={active ? 'page' : undefined}
      onClick={() => api.send('tab:activate', { tabId: tab.id })}
      onContextMenu={event => {
        event.preventDefault()
        api.send('tab:context-menu', { tabId: tab.id })
      }}
      onMouseEnter={event => showTip(event.currentTarget, label, keys)}
      onMouseLeave={hideTip}
    >
      <Tile
        size={20}
        letter={letter}
        color={color}
        favicon={tab.favicon}
        opacity={tab.dormant ? 0.4 : 1}
      />
    </button>
  )
}
