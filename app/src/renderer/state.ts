// Signals que espelham o main. Sem lógica de negócio: o main é a fonte da verdade.
import { computed, signal } from '@preact/signals'
import type {
  AppSnapshot,
  OverlayReason,
  SidebarMode,
  Space,
  Tab,
  Theme
} from '@shared/types'
import { api } from './api'
import { handleNewTabKey } from './new-tab-state'
import { hidePalette, paletteVisible, showPalette } from './palette-state'

export const snapshot = signal<AppSnapshot | null>(null)

// sobe a cada ⌘L numa Nova aba; o campo de busca dela se foca
export const addressFocusRequest = signal(0)

export const theme = computed<Theme>(() => snapshot.value?.theme ?? 'light')

// o que a janela mostra: a sidebar aberta vira compacta em janela estreita
export const effectiveSidebar = computed<SidebarMode>(
  () => snapshot.value?.effectiveSidebar ?? 'open'
)

export const overlay = computed<OverlayReason[]>(
  () => snapshot.value?.overlay ?? []
)

export const currentSpace = computed<Space | null>(() => {
  const snap = snapshot.value
  if (!snap) return null
  return (
    snap.spaces.find(space => space.id === snap.window.spaceId) ??
    snap.spaces[0] ??
    null
  )
})

export const currentTabs = computed<Tab[]>(() => {
  const snap = snapshot.value
  if (!snap) return []
  return snap.tabs.filter(tab => tab.spaceId === snap.window.spaceId)
})

export const activeTab = computed<Tab | null>(() => {
  const snap = snapshot.value
  if (!snap) return null
  const id = snap.window.activeTabBySpace[snap.window.spaceId]
  return snap.tabs.find(tab => tab.id === id) ?? null
})

function applyTabPatch(tabId: string, patch: Partial<Tab>): void {
  const snap = snapshot.value
  if (!snap) return
  const index = snap.tabs.findIndex(tab => tab.id === tabId)
  if (index === -1) return
  const tabs = snap.tabs.slice()
  tabs[index] = { ...tabs[index], ...patch }
  snapshot.value = { ...snap, tabs }
}

function applySnapshot(next: AppSnapshot): void {
  snapshot.value = next
  // a shell recarregada no meio de uma paleta aberta, ou um evento perdido: o overlay manda
  const open = next.overlay.includes('palette')
  if (open && !paletteVisible.value) showPalette({ mode: 'search', text: '' })
  else if (!open && paletteVisible.value) hidePalette()
}

// assina primeiro e só depois pede o estado: nenhum evento se perde
export function startSync(): void {
  api.on('state:snapshot', applySnapshot)
  api.on('palette:show', showPalette)
  api.on('palette:hide', hidePalette)
  api.on('state:tab', ({ tabId, patch }) => applyTabPatch(tabId, patch))
  // as teclas da Nova aba chegam antes de a aba existir na shell: o ouvinte é global
  api.on('keys:early', ({ target, key }) => {
    if (target.kind === 'new-tab') handleNewTabKey(target.tabId, key)
  })
  api.on('address:focus', () => {
    addressFocusRequest.value += 1
  })
  void api.invoke('state:get', {}).then(applySnapshot)
}
