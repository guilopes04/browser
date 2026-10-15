// Página de erro de carregamento (Erro.dc.html). Desenhada pela shell no lugar da página, como a
// Nova aba: a view da aba fica escondida enquanto a aba tiver erro.
import { useEffect } from 'preact/hooks'
import { describeLoadError } from '@shared/describe-load-error'
import type { Tab } from '@shared/types'
import { getHostname } from '@shared/url-parts'
import { api } from '../../api'
import { NetworkOffIcon, ProblemIcon } from '../icons'

interface ErrorPageProps {
  tab: Tab
}

export function ErrorPage({ tab }: ErrorPageProps) {
  const { error } = tab
  const text = error
    ? describeLoadError(error.code, getHostname(tab.url) || tab.url)
    : null
  const offline = text?.offline === true

  // sem conexão: a página recarrega sozinha quando o Mac volta a ficar online
  useEffect(() => {
    if (!offline) return
    const reload = () => api.send('tab:reload', {})
    window.addEventListener('online', reload)
    return () => window.removeEventListener('online', reload)
  }, [offline, tab.id])

  if (!error || !text) return null

  return (
    <div class="error-page">
      <div class="error-column">
        <span class="error-icon">
          {text.kind === 'network' ? <NetworkOffIcon /> : <ProblemIcon />}
        </span>
        <h1 class="error-title">{text.title}</h1>
        <p class="error-body">{text.body}</p>
        <div class="error-actions">
          <button
            type="button"
            class="error-retry"
            onClick={() => api.send('tab:reload', {})}
          >
            Tentar de novo
            <span class="error-retry-keys">⌘R</span>
          </button>
          {offline && (
            <button
              type="button"
              class="error-secondary"
              onClick={() => api.send('system:open-network-settings', {})}
            >
              Abrir ajustes de rede do Mac
            </button>
          )}
        </div>
        <p class="error-code">Código do erro: {error.description}</p>
      </div>
    </div>
  )
}
