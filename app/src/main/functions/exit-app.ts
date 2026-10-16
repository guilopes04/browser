// Sai do app sem passar pelo ⌘Q. app.exit() não emite before-quit, então quem sai por ele precisa
// marcar `ctx.quitting` antes: o Electron destrói as views no meio da saída, e sem a marca o
// closeDeadTab trata a destruição como a página que se fechou sozinha, ignora o pedido e
// (keepTabAfterScriptClose) cria uma view nova no meio do desmonte. O Chromium cai com SIGTRAP (133).
import { app } from 'electron'
import type { MainContext } from '../context'

export function exitApp(
  ctx: Pick<MainContext, 'quitting'>,
  code: number
): void {
  ctx.quitting = true
  app.exit(code)
}
