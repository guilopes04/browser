// Diálogo nativo assíncrono, como folha da janela (não trava o app como o showMessageBoxSync).
// Com a janela escondida devolve null: no macOS um diálogo sem janela-pai roda de forma síncrona,
// o que travaria o app, e o `signal` de cancelamento também não vale nele. Quem pergunta trata
// null como "o usuário não respondeu".
import {
  dialog,
  type MessageBoxOptions,
  type MessageBoxReturnValue
} from 'electron'
import type { MainContext } from '../context'

export async function showMessage(
  ctx: MainContext,
  options: MessageBoxOptions
): Promise<MessageBoxReturnValue | null> {
  if (ctx.win.isDestroyed() || !ctx.win.isVisible()) return null
  return dialog.showMessageBox(ctx.win, options)
}

// texto vindo da página (nome de arquivo, mensagem de alert) cabe num diálogo: corta o excesso
export function clipForDialog(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
