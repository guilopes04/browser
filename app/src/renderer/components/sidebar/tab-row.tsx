import type { Tab } from '@shared/types'
import { api } from '../../api'
import { snapshot } from '../../state'
import { getTabTile } from '../../tab-tile'
import { CloseIcon, MoonIcon, SpeakerIcon, SpeakerMutedIcon } from '../icons'
import { DialogBlockedIcon } from '../guard/icons'
import { Tile } from '../tile'

interface TabRowProps {
  tab: Tab
  active: boolean
}

export function TabRow({ tab, active }: TabRowProps) {
  const { label, letter, color } = getTabTile(tab, snapshot.value?.spaces ?? [])
  // um só ícone no slot: a lua da aba suspensa vale mais que o alto-falante (a aba suspensa
  // não toca nada, e o silenciamento volta a aparecer quando ela acordar)
  const showAudio = !tab.dormant && (tab.audible || tab.muted)

  return (
    <div
      class="tab-row"
      data-active={active}
      data-dormant={tab.dormant}
      onContextMenu={event => {
        event.preventDefault()
        api.send('tab:context-menu', { tabId: tab.id })
      }}
    >
      <button
        type="button"
        class="tab-main"
        aria-current={active ? 'page' : undefined}
        onClick={() => api.send('tab:activate', { tabId: tab.id })}
      >
        <Tile
          size={18}
          letter={letter}
          color={color}
          favicon={tab.favicon}
          opacity={tab.dormant ? 0.45 : 1}
        />
        <span class="tab-title">{label}</span>
      </button>
      {showAudio && (
        <button
          type="button"
          class="slot-btn slot-audio"
          data-muted={tab.muted}
          aria-label={tab.muted ? 'Reativar o som da aba' : 'Silenciar aba'}
          onClick={() =>
            api.send('tab:set-muted', { tabId: tab.id, muted: !tab.muted })
          }
        >
          {tab.muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
        </button>
      )}
      {tab.dialogBlocked && (
        <span
          class="slot-dialog"
          title="Esta aba tentou abrir um diálogo em segundo plano e ele foi descartado"
        >
          <DialogBlockedIcon />
        </span>
      )}
      {tab.dormant && (
        <span
          class="slot-moon"
          title={
            tab.muted
              ? 'Suspensa para liberar memória (silenciada)'
              : 'Suspensa para liberar memória'
          }
        >
          <MoonIcon />
        </span>
      )}
      {active && (
        <button
          type="button"
          class="slot-btn"
          aria-label="Fechar aba (⌘W)"
          onClick={() => api.send('tab:close', { tabId: tab.id })}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
}
