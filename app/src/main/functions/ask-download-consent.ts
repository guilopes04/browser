// "<quem pediu> quer baixar <nome> (<tamanho>). Permitir?": o download que a página iniciou sem que
// um clique ou tecla do usuário tenha ativado quem o pediu (nenhum, ou um clique em outro quadro).
// Cancelar é o padrão (Enter recusa). true = o usuário permitiu.
import { formatBytes } from '@shared/format-bytes'
import type { MainContext } from '../context'
import {
  describeDownloadRequest,
  type DownloadRequestFacts
} from './describe-download-request'
import { clipForDialog, showMessage } from './show-message'

const CANCEL = 0
const ALLOW = 1

export async function askDownloadConsent(
  ctx: MainContext,
  file: { name: string; bytes: number } & DownloadRequestFacts
): Promise<boolean> {
  const request = describeDownloadRequest(file)
  const result = await showMessage(ctx, {
    type: 'warning',
    buttons: ['Cancelar', 'Baixar'],
    defaultId: CANCEL,
    cancelId: CANCEL,
    noLink: true,
    message: `${clipForDialog(request.subject, 80)} quer baixar ${clipForDialog(file.name, 80)} (${formatBytes(file.bytes)}). Permitir?`,
    detail: clipForDialog(request.detail, 400)
  })
  // janela escondida: ninguém para responder, o download não segue
  return result?.response === ALLOW
}
