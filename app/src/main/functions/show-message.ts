// Diálogo nativo assíncrono (não trava o app como o showMessageBoxSync): vira folha da janela
// quando ela está na tela e diálogo solto quando está escondida.
import {
  dialog,
  type MessageBoxOptions,
  type MessageBoxReturnValue
} from 'electron'
import type { MainContext } from '../context'

export function showMessage(
  ctx: MainContext,
  options: MessageBoxOptions
): Promise<MessageBoxReturnValue> {
  return !ctx.win.isDestroyed() && ctx.win.isVisible()
    ? dialog.showMessageBox(ctx.win, options)
    : dialog.showMessageBox(options)
}

// texto vindo da página (nome de arquivo, mensagem de alert) cabe num diálogo: corta o excesso
export function clipForDialog(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
