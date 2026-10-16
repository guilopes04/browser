import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { describeAddress } from '@shared/address-display'
import { api } from '../../api'
import { activeTab } from '../../state'
import { InsecureIcon } from '../guard/icons'
import { ShieldIcon } from '../icons'

// até o bloqueador existir, a contagem é sempre 0; com 0 o escudo fica escondido (Sidebar.dc.html)
const BLOCKED_COUNT = 0
const PLACEHOLDER = 'Buscar ou digitar endereço'
const INSECURE_TITLE = 'A conexão com este site não é criptografada'

// espaço que o botão não dá ao domínio: o respiro dos dois lados (6 + 6), a folga do caminho ao lado
// (6 + 2) e, com o cadeado, o ícone e o vão dele (12 + 6)
const BUTTON_PADDING = 12
const PATH_SLACK = 8
const INSECURE_ICON = 18

// o campo é só o endereço da aba: clicar nele (ou ⌘L) abre a paleta no modo endereço. O domínio
// registrável vem sempre inteiro, nunca cortado no meio (um domínio comprido cortado esconde
// letras que diferenciam o site verdadeiro do falso). O que falta de espaço sai nesta ordem:
// caminho, subdomínios (cortados no começo, com "…") e o texto "Não seguro" (fica o cadeado). Se o
// domínio sozinho não cabe numa linha, ele ocupa o campo e quebra em quantas linhas precisar, e o
// campo cresce (só o domínio e o cadeado ficam; o host inteiro está no tooltip e no aria-label).
// A ordem de cima para baixo no DOM é a da prioridade (o CSS a inverte na tela, sidebar.css)
export function AddressField() {
  const tab = activeTab.value
  const isNewTab = !tab || tab.url === ''
  const address = describeAddress(tab?.url ?? '')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [wraps, setWraps] = useState(false)

  // a sonda invisível mede o domínio numa linha só, com a mesma fonte
  useLayoutEffect(() => {
    const button = buttonRef.current
    const probe = probeRef.current
    if (!button || !probe || isNewTab) return setWraps(false)
    const room =
      button.clientWidth -
      BUTTON_PADDING -
      PATH_SLACK -
      (address.insecure ? INSECURE_ICON : 0)
    setWraps(probe.offsetWidth > room)
  }, [address.domain, address.insecure, isNewTab])

  return (
    <div class={wraps ? 'address address-wraps' : 'address'}>
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
        ref={buttonRef}
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
            <span class="address-probe" aria-hidden="true" ref={probeRef}>
              {address.domain}
            </span>
            {wraps ? (
              <span class="address-host address-host-wrap" title={address.host}>
                <span class="address-domain">{address.domain}</span>
              </span>
            ) : (
              <>
                <span class="address-host" title={address.host}>
                  <span class="address-domain">{address.domain}</span>
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
          </>
        )}
      </button>
    </div>
  )
}
