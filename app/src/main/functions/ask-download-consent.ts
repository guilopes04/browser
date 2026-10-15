// "Este site quer baixar <nome> (<tamanho>). Permitir?": o download que a página iniciou sem um
// clique ou tecla do usuário. Cancelar é o padrão (Enter recusa). true = o usuário permitiu.
import { formatBytes } from '@shared/format-bytes'
import type { MainContext } from '../context'
import { clipForDialog, showMessage } from './show-message'

const CANCEL = 0
const ALLOW = 1

export async function askDownloadConsent(
  ctx: MainContext,
  file: { name: string; bytes: number; site: string }
): Promise<boolean> {
  const { response } = await showMessage(ctx, {
    type: 'warning',
    buttons: ['Cancelar', 'Baixar'],
    defaultId: CANCEL,
    cancelId: CANCEL,
    noLink: true,
    message: `Este site quer baixar ${clipForDialog(file.name, 80)} (${formatBytes(file.bytes)}). Permitir?`,
    detail: file.site
      ? `Site: ${clipForDialog(file.site, 120)}\nO download começou sem um clique ou toque seu.`
      : 'O download começou sem um clique ou toque seu.'
  })
  return response === ALLOW
}
