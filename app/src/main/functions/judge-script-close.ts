// window.close() de uma página: quando o app deixa a aba fechar. Regra do HTML ("script-closable"),
// mais estrita no que importa:
// - só fecha aba aberta por script (window.open, target=_blank). A aba que o usuário abriu (⌘T,
//   endereço, favorito) ignora o pedido, com um aviso no log: o Chromium já recusa quando ela
//   tem histórico, mas uma com uma entrada só passaria;
// - nunca fecha quem abriu outras abas e elas ainda vivem: um pop-up que chama opener.close() não
//   derruba a aba que o abriu.
// Pura sobre o estado de ctx.guard.
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'

export type ScriptCloseVerdict = 'allow' | 'not-script-opened' | 'has-children'

export function judgeScriptClose(
  ctx: MainContext,
  tabId: TabId
): ScriptCloseVerdict {
  if (!ctx.guard.scriptOpened.has(tabId)) return 'not-script-opened'
  for (const [child, opener] of ctx.guard.openers)
    if (opener === tabId && ctx.store.getTab(child)) return 'has-children'
  return 'allow'
}
