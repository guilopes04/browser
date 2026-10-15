// Texto do campo de busca da Nova aba. Fica fora do componente porque as teclas digitadas logo
// depois do ⌘T chegam do main (keys:early) antes de o campo existir, e podem chegar antes do
// snapshot que traz a própria aba: o texto espera aqui, pelo id da aba, e o campo o mostra ao
// nascer.
import { signal } from '@preact/signals'
import { applyEarlyKeyToText, type EarlyKey } from '@shared/early-key'
import type { TabId } from '@shared/types'
import { api } from './api'

interface Draft {
  tabId: TabId
  text: string
}

// um rascunho só: o da Nova aba mais recente. Trocar de Nova aba começa o campo vazio
export const newTabDraft = signal<Draft | null>(null)

export function getNewTabText(tabId: TabId): string {
  const draft = newTabDraft.value
  return draft?.tabId === tabId ? draft.text : ''
}

export function setNewTabText(tabId: TabId, text: string): void {
  newTabDraft.value = { tabId, text }
}

// ↵: o main resolve URL ou busca. O texto sai do rascunho, não do campo (que pode nem existir). O
// rascunho fica até a aba trocar de página, e então a Nova aba some com ele
export function submitNewTab(tabId: TabId): void {
  const text = getNewTabText(tabId)
  if (text.trim() === '') return
  api.send('tab:navigate', { tabId, input: text })
}

// tecla repassada pelo main enquanto a Nova aba abria
export function handleNewTabKey(tabId: TabId, early: EarlyKey): void {
  if (early.key === 'Enter') {
    // ⌘↵ e ⌥↵ são da paleta
    if (!early.meta && !early.alt) submitNewTab(tabId)
    return
  }
  const text = applyEarlyKeyToText(getNewTabText(tabId), early)
  if (text !== null) setNewTabText(tabId, text)
}
