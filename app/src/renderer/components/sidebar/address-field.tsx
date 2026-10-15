import { describeAddress } from '@shared/address-display'
import { api } from '../../api'
import { activeTab } from '../../state'
import { InsecureMark } from '../guard/insecure-mark'
import { ShieldIcon } from '../icons'

// até o bloqueador existir, a contagem é sempre 0; com 0 o escudo fica escondido (Sidebar.dc.html)
const BLOCKED_COUNT = 0
const PLACEHOLDER = 'Buscar ou digitar endereço'

// o campo é só o endereço da aba: clicar nele (ou ⌘L) abre a paleta no modo endereço. O host
// mostra o domínio registrável em destaque e sempre inteiro: o que não cabe é o começo (os
// subdomínios), cortado com "…", nunca o fim
export function AddressField() {
  const tab = activeTab.value
  const isNewTab = !tab || tab.url === ''
  const address = describeAddress(tab?.url ?? '')

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
        aria-label={
          isNewTab
            ? 'Endereço (⌘L)'
            : `Endereço: ${address.host}${address.insecure ? ', conexão não segura' : ''} (⌘L)`
        }
        onClick={() => api.send('palette:open', { mode: 'address' })}
      >
        {isNewTab ? (
          <span class="address-path">{PLACEHOLDER}</span>
        ) : (
          <>
            {address.insecure && <InsecureMark />}
            {/* direction: rtl faz o "…" cair no começo; o miolo volta a ser lido da esquerda */}
            <span class="address-host" title={address.host}>
              <bdi dir="ltr">
                <span class="address-sub">{address.subdomain}</span>
                <span class="address-domain">{address.domain}</span>
              </bdi>
            </span>
            <span class="address-path">{address.path}</span>
          </>
        )}
      </button>
    </div>
  )
}
