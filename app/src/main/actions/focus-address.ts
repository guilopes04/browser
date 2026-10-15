// ⌘L: a paleta abre no modo endereço, com a URL da aba selecionada; ↵ navega na aba. Na Nova aba
// (sem URL) a página já tem o campo de busca e é ele que ganha o foco.
import type { MainContext } from '../context'
import { closePalette } from './close-palette'
import { openPalette } from './open-palette'

export function focusAddress(ctx: MainContext): void {
  const tab = ctx.store.getActiveTab()
  if (tab && tab.url !== '') {
    openPalette(ctx, 'address')
    return
  }
  closePalette(ctx, false)
  ctx.shell.webContents.focus()
  ctx.broadcaster.send('address:focus', {})
}
