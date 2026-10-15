// "Abrir" no aviso de pop-up bloqueado: o usuário quer ver o que a página tentou abrir. Cada
// endereço vira uma aba comum (sem opener); a primeira vem para a frente e as demais ficam ao fundo.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { takeBlockedPopups } from '../functions/blocked-popups'
import { createTab } from './create-tab'

export function openBlockedPopups(ctx: MainContext, tabId: TabId): void {
  const tab = ctx.store.getTab(tabId)
  if (!tab) return
  takeBlockedPopups(ctx, tabId).forEach((url, index) => {
    createTab(ctx, { spaceId: tab.spaceId, url, background: index > 0 })
  })
}

// "×" no aviso: descarta sem abrir
export function dismissBlockedPopups(ctx: MainContext, tabId: TabId): void {
  takeBlockedPopups(ctx, tabId)
}
