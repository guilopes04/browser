// Diálogo nativo do beforeunload: a página pediu para não ser descarregada (rascunho, formulário).
// É síncrono de propósito: o 'will-prevent-unload' só aceita o preventDefault dentro do próprio
// ouvinte. Devolve true quando o usuário escolhe Sair.
import { dialog, type MessageBoxSyncOptions } from 'electron'
import type { MainContext } from '../context'

const LEAVE = 0
const STAY = 1

export function confirmLeavePage(ctx: MainContext): boolean {
  const options: MessageBoxSyncOptions = {
    type: 'question',
    buttons: ['Sair', 'Ficar'],
    defaultId: STAY,
    cancelId: STAY,
    message: 'Sair desta página?',
    detail: 'As alterações podem não ser salvas.'
  }
  // como folha da janela quando ela está na tela; senão, como diálogo solto
  const choice =
    !ctx.win.isDestroyed() && ctx.win.isVisible()
      ? dialog.showMessageBoxSync(ctx.win, options)
      : dialog.showMessageBoxSync(options)
  return choice === LEAVE
}
