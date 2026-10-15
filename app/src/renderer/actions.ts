// Comandos da shell para o main, com a pequena decisão de interface que cada um precisa.
import type { Favorite } from '@shared/types'
import { getHostname } from '@shared/url-parts'
import { toUrlKey } from '@shared/url-key'
import { api } from './api'
import { activeTab, currentTabs, snapshot } from './state'

// favorito: vai para a aba que já está no site, ou usa a Nova aba aberta, ou cria uma aba
export function openFavorite(favorite: Favorite): void {
  const host = getHostname(favorite.url)
  const existing = currentTabs.value.find(
    tab => tab.url !== '' && getHostname(tab.url) === host
  )
  if (existing) {
    api.send('tab:activate', { tabId: existing.id })
    return
  }
  const active = activeTab.value
  if (active && active.url === '') {
    api.send('tab:navigate', { tabId: active.id, input: favorite.url })
    return
  }
  api.send('tab:create', { url: favorite.url })
}

// endereço vindo da paleta: usa a Nova aba aberta do espaço, ou cria uma aba (no espaço de origem
// do item, que passa a ser o atual)
export function openUrl(url: string, spaceId: string): void {
  const active = activeTab.value
  if (spaceId === snapshot.value?.window.spaceId && active?.url === '') {
    api.send('tab:navigate', { tabId: active.id, input: url })
    return
  }
  api.send('tab:create', { spaceId, url })
}

// favorito escolhido na paleta: vai para a aba do espaço dele que já está exatamente nesse
// endereço; senão abre o favorito. (A sidebar e a Nova aba usam openFavorite, que reaproveita
// qualquer aba do mesmo site.)
export function openFavoriteByUrl(url: string, spaceId: string): void {
  const key = toUrlKey(url)
  const existing = snapshot.value?.tabs.find(
    tab =>
      tab.spaceId === spaceId && tab.url !== '' && toUrlKey(tab.url) === key
  )
  if (existing) api.send('tab:activate', { tabId: existing.id })
  else openUrl(url, spaceId)
}
