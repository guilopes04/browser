import { splitUrl } from '@shared/url-parts'
import { api } from '../../api'
import { activeTab } from '../../state'
import { ShieldIcon } from '../icons'

// até o bloqueador existir, a contagem é sempre 0; com 0 o escudo fica escondido (Sidebar.dc.html)
const BLOCKED_COUNT = 0
const PLACEHOLDER = 'Buscar ou digitar endereço'

// o campo é só o endereço da aba: clicar nele (ou ⌘L) abre a paleta no modo endereço
export function AddressField() {
  const tab = activeTab.value
  const isNewTab = !tab || tab.url === ''
  const { domain, path } = splitUrl(tab?.url ?? '')

  return (
    <div class="address">
      {!isNewTab && BLOCKED_COUNT > 0 && (
        <button
          type="button"
          class="shield-btn"
          aria-label={`Site e bloqueios: ${BLOCKED_COUNT} itens bloqueados nesta página`}
        >
          <ShieldIcon size={13} />
          {BLOCKED_COUNT}
        </button>
      )}
      <button
        type="button"
        class="address-btn"
        aria-label="Endereço (⌘L)"
        onClick={() => api.send('palette:open', { mode: 'address' })}
      >
        {isNewTab ? (
          <span class="address-path">{PLACEHOLDER}</span>
        ) : (
          <>
            <span class="address-domain">{domain}</span>
            <span class="address-path">{path}</span>
          </>
        )}
      </button>
    </div>
  )
}
