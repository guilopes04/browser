// Pop-ups que o app bloqueou: as URLs ficam no main (a shell só recebe a contagem, pelo snapshot)
// até o usuário abrir ou dispensar o aviso, ou a aba navegar.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'

// mais que isto é a mesma página insistindo
export const MAX_KEPT_POPUPS = 5

export function recordBlockedPopup(
  ctx: MainContext,
  tabId: TabId,
  url: string,
  reason = ''
): void {
  const list = ctx.guard.blockedPopups.get(tabId) ?? []
  if (!list.includes(url) && list.length < MAX_KEPT_POPUPS) list.push(url)
  ctx.guard.blockedPopups.set(tabId, list)
  ctx.store.patchTab(tabId, { blockedPopups: list.length })
  console.warn(
    `[Popups][window-open] bloqueado na aba ${tabId}${reason ? ` (${reason})` : ''}: ${url.slice(0, 120)}`
  )
}

// tira da aba os pop-ups bloqueados e devolve as URLs
export function takeBlockedPopups(ctx: MainContext, tabId: TabId): string[] {
  const urls = ctx.guard.blockedPopups.get(tabId) ?? []
  ctx.guard.blockedPopups.delete(tabId)
  ctx.store.patchTab(tabId, { blockedPopups: 0 })
  return urls
}
