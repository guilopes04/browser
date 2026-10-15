import { describeAddress, splitDomainTail } from '@shared/address-display'
import { api } from '../../api'
import { activeTab } from '../../state'
import { InsecureIcon } from '../guard/icons'
import { ShieldIcon } from '../icons'

// até o bloqueador existir, a contagem é sempre 0; com 0 o escudo fica escondido (Sidebar.dc.html)
const BLOCKED_COUNT = 0
const PLACEHOLDER = 'Buscar ou digitar endereço'
const INSECURE_TITLE = 'A conexão com este site não é criptografada'

// o campo é só o endereço da aba: clicar nele (ou ⌘L) abre a paleta no modo endereço. O domínio
// registrável vem sempre inteiro; o que falta de espaço sai nesta ordem: caminho, subdomínios
// (cortados no começo, com "…"), o texto "Não seguro" (fica o cadeado) e, só se o domínio sozinho
// não couber, o meio dele. A ordem de cima para baixo no DOM é a da prioridade (o CSS a inverte
// na tela, sidebar.css); o aria-label do botão leva o endereço inteiro
export function AddressField() {
  const tab = activeTab.value
  const isNewTab = !tab || tab.url === ''
  const address = describeAddress(tab?.url ?? '')
  const domain = splitDomainTail(address.domain)

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
            {address.insecure && (
              <span class="insecure" title={INSECURE_TITLE}>
                <InsecureIcon size={12} />
              </span>
            )}
            <span class="address-host" title={address.host}>
              <span class="address-domain">
                <span class="address-domain-head">{domain.head}</span>
                <span class="address-domain-tail">{domain.tail}</span>
              </span>
              {address.subdomain && (
                <span class="address-sub">
                  {/* direction: rtl faz o "…" cair no começo; o miolo volta a ser lido da esquerda */}
                  <bdi dir="ltr">{address.subdomain}</bdi>
                </span>
              )}
              {address.insecure && (
                <span class="insecure-text" title={INSECURE_TITLE}>
                  Não seguro
                </span>
              )}
            </span>
            <span class="address-path">{address.path}</span>
          </>
        )}
      </button>
    </div>
  )
}
