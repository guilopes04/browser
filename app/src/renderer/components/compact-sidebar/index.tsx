// Sidebar compacta de 76 px (ModoCompacto.dc.html): só ícones, com o nome da aba numa dica.
import { useEffect } from 'preact/hooks'
import { SPACE_TOKENS } from '@shared/tokens'
import { getTileColor } from '@shared/tile-appearance'
import { api } from '../../api'
import { openFavorite } from '../../actions'
import { getFavoriteLetter } from '../../favorite-letter'
import { activeTab, currentSpace, currentTabs, snapshot } from '../../state'
import { hideTip, resetTip, showTip } from '../../tip'
import { PlusIcon, SidebarIcon } from '../icons'
import { Tile } from '../tile'
import { CompactTab } from './compact-tab'

export function CompactSidebar() {
  const snap = snapshot.value
  const space = currentSpace.value
  const tabs = currentTabs.value
  const activeId = activeTab.value?.id

  // ao sair do modo compacto a dica some junto
  useEffect(() => resetTip, [])

  if (!snap || !space) return null

  const essentials = space.favorites
    .filter(favorite => favorite.essential)
    .slice(0, 4)
  const index = snap.spaces.findIndex(other => other.id === space.id)
  const next = snap.spaces[(index + 1) % snap.spaces.length]
  const switchLabel =
    next.id === space.id ? `Espaço ${space.name}` : `Ir para ${next.name}`
  const switchKeys =
    next.id === space.id
      ? undefined
      : `⌃${((index + 1) % snap.spaces.length) + 1}`

  return (
    <nav class="compact" aria-label="Abas (compacto)">
      <div class="compact-lights" aria-hidden="true" />

      <button
        type="button"
        class="compact-space"
        aria-label={`Espaço atual: ${space.name}. Trocar de espaço`}
        onClick={() => api.send('space:switch', { spaceId: next.id })}
        onMouseEnter={event =>
          showTip(event.currentTarget, switchLabel, switchKeys)
        }
        onMouseLeave={hideTip}
      >
        <span
          class="compact-space-tile"
          aria-hidden="true"
          style={{ background: SPACE_TOKENS[space.color].light.accent }}
        >
          {getFavoriteLetter(space.name)}
        </span>
      </button>

      <div class="compact-hairline" />

      {essentials.map(favorite => (
        <button
          key={favorite.id}
          type="button"
          class="compact-item"
          aria-label={`${favorite.title} (favorito)`}
          onClick={() => openFavorite(favorite)}
          onMouseEnter={event => showTip(event.currentTarget, favorite.title)}
          onMouseLeave={hideTip}
        >
          <Tile
            size={20}
            letter={
              favorite.letter ?? getFavoriteLetter(favorite.title, favorite.url)
            }
            color={favorite.tile || getTileColor(favorite.title)}
            favicon={favorite.favicon}
          />
        </button>
      ))}
      {essentials.length > 0 && <div class="compact-hairline" />}

      <div class="compact-scroll">
        {tabs.map((tab, position) => (
          <CompactTab
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            index={position}
            total={tabs.length}
            spaces={snap.spaces}
          />
        ))}
        <button
          type="button"
          class="compact-item compact-new"
          aria-label="Nova aba (⌘T)"
          onClick={() => api.send('tab:create', {})}
          onMouseEnter={event => showTip(event.currentTarget, 'Nova aba', '⌘T')}
          onMouseLeave={hideTip}
        >
          <PlusIcon />
        </button>
      </div>

      <button
        type="button"
        class="compact-item compact-toggle"
        aria-label="Mostrar sidebar completa (⌘S)"
        onClick={() => api.send('sidebar:toggle', {})}
        onMouseEnter={event =>
          showTip(event.currentTarget, 'Mostrar sidebar completa', '⌘S')
        }
        onMouseLeave={hideTip}
      >
        <SidebarIcon />
      </button>
    </nav>
  )
}
