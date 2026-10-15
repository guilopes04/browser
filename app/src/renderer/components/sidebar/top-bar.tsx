import { api } from '../../api'
import { activeTab } from '../../state'
import { BackIcon, ForwardIcon, ReloadIcon, SidebarIcon } from '../icons'

// os semáforos são nativos: aqui só o espaço reservado a eles (a linha inteira arrasta a janela)
export function TopBar() {
  const tab = activeTab.value
  const canGoBack = tab?.canGoBack ?? false
  const canGoForward = tab?.canGoForward ?? false

  return (
    <div class="top-bar">
      <div class="top-bar-lights" aria-hidden="true" />
      <div class="grow" />
      <div class="top-bar-actions">
        <button
          type="button"
          class="icon-btn"
          aria-label="Ocultar sidebar (⌘S)"
          onClick={() => api.send('sidebar:toggle', {})}
        >
          <SidebarIcon />
        </button>
        <button
          type="button"
          class="icon-btn"
          data-off={!canGoBack}
          aria-label="Voltar (⌘[)"
          aria-disabled={!canGoBack}
          onClick={() => api.send('tab:back', {})}
        >
          <BackIcon />
        </button>
        <button
          type="button"
          class="icon-btn"
          data-off={!canGoForward}
          aria-label="Avançar (⌘])"
          aria-disabled={!canGoForward}
          onClick={() => api.send('tab:forward', {})}
        >
          <ForwardIcon />
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label="Recarregar (⌘R)"
          onClick={() => api.send('tab:reload', {})}
        >
          <ReloadIcon />
        </button>
      </div>
    </div>
  )
}
