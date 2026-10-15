import { api } from '../../api'
import { activeTab } from '../../state'
import { CloseIcon } from '../icons'
import { PopupBlockedIcon } from './icons'

// "Pop-up bloqueado" na barra de endereço: a página tentou abrir uma janela sem um clique seu.
// O usuário pode abrir o que foi bloqueado ou dispensar o aviso
export function PopupNotice() {
  const tab = activeTab.value
  const count = tab?.blockedPopups ?? 0
  if (!tab || tab.url === '' || count === 0) return null
  return (
    <div
      class="popup-notice"
      role="status"
      title={`${count} ${count === 1 ? 'pop-up bloqueado' : 'pop-ups bloqueados'} nesta página`}
    >
      <PopupBlockedIcon />
      <span class="popup-notice-text">
        {count === 1 ? 'Pop-up bloqueado' : `${count} pop-ups bloqueados`}
      </span>
      <button
        type="button"
        class="popup-notice-open"
        onClick={() => api.send('popup:open-blocked', { tabId: tab.id })}
      >
        Abrir
      </button>
      <button
        type="button"
        class="popup-notice-close"
        aria-label="Dispensar o aviso de pop-up bloqueado"
        onClick={() => api.send('popup:dismiss-blocked', { tabId: tab.id })}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
