// A aba deixou o documento em que estava: carregou outro (did-navigate) ou a navegação terminou na
// página de erro (did-fail-load, que não dispara did-navigate). O que era do documento anterior
// some: o gesto do usuário e o saldo de pop-ups, o aviso "N pop-ups bloqueados · Abrir" (com as URLs
// guardadas no main), a contagem de diálogos e o "bloquear mais" (que vale "até recarregar").
// Sem isto, o aviso de uma página ficava na página de erro que a substituiu.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { resetDocumentState } from '../web-guard'
import { takeBlockedPopups } from './blocked-popups'

export function leaveDocument(ctx: MainContext, tabId: TabId): void {
  resetDocumentState(ctx.guard, tabId)
  if (ctx.guard.blockedPopups.has(tabId)) takeBlockedPopups(ctx, tabId)
  ctx.guard.dialogs.delete(tabId)
  if (ctx.store.getTab(tabId)?.dialogBlocked)
    ctx.store.patchTab(tabId, { dialogBlocked: false })
}
