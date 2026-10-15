// Executa o item escolhido na paleta com os comandos que a shell já tem. O main fecha a paleta
// ao trocar de aba ou rodar o comando; o palette:close final cobre o resto e é inofensivo.
import type { PaletteItem } from '@shared/types'
import { api } from '../../api'
import { openFavoriteByUrl, openUrl } from '../../actions'
import { paletteMode } from '../../palette-state'
import { activeTab, snapshot } from '../../state'

export function runPaletteItem(item: PaletteItem): void {
  const currentSpaceId = snapshot.value?.window.spaceId ?? ''
  // no modo endereço (⌘L), o que não é de outro espaço navega a aba em que a pessoa está
  const here = paletteMode.value === 'address' ? activeTab.value : null
  const goHere = (url: string) => {
    if (here) api.send('tab:navigate', { tabId: here.id, input: url })
    return here !== null
  }

  switch (item.kind) {
    case 'tab':
      api.send('tab:activate', { tabId: item.tabId })
      break
    case 'favorite':
      if (item.spaceId === currentSpaceId && goHere(item.url)) break
      openFavoriteByUrl(item.url, item.spaceId)
      break
    case 'history':
      if (item.spaceId === currentSpaceId && goHere(item.url)) break
      openUrl(item.url, item.spaceId)
      break
    case 'action':
      api.send('command:run', { command: item.command })
      break
    case 'web-search':
      if (goHere(item.url)) break
      openUrl(item.url, currentSpaceId)
      break
    // "Abrir ... em nova aba" (⌘↵)
    case 'open-url':
      openUrl(item.url, currentSpaceId)
      break
  }
  api.send('palette:close', {})
}

// ↵ no modo endereço sem linha escolhida: o texto digitado navega a aba ativa
export function navigateTypedText(text: string): void {
  const tab = activeTab.value
  if (tab && text.trim())
    api.send('tab:navigate', { tabId: tab.id, input: text })
  api.send('palette:close', {})
}
