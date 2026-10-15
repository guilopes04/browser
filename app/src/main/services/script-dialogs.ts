// alert, confirm e prompt das páginas (o preload das abas os manda para cá por IPC síncrono; a
// página espera a resposta como num diálogo de verdade, mas o main segue livre).
// - só a aba ativa mostra o diálogo; o das abas em segundo plano é descartado, com o retorno
//   padrão, e a aba ganha um marcador (Tab.dialogBlocked);
// - o diálogo nativo mostra a origem ("127.0.0.1:9601 diz:") e, depois de 3 em 10 s, a caixa
//   "Bloquear mais diálogos deste site" (por aba, até recarregar);
// - prompt() continua devolvendo null: um diálogo nativo não tem campo de texto e o Electron nunca
//   o suportou.
import { ipcMain, type IpcMainEvent } from 'electron'
import type { MainContext } from '../context'
import { decideDialog, recordDialogShown } from '../functions/decide-dialog'
import { describeDialogOrigin } from '../functions/describe-dialog-origin'
import { findTabByContents } from '../functions/find-tab-by-contents'
import {
  defaultAnswer,
  readDialogRequest,
  type DialogRequest
} from '../functions/read-dialog-request'
import { clipForDialog, showMessage } from '../functions/show-message'

const OK = 0

async function showDialog(
  ctx: MainContext,
  event: IpcMainEvent,
  request: DialogRequest,
  offerBlock: boolean
): Promise<{ accepted: boolean; blockMore: boolean } | null> {
  const frame = event.senderFrame
  const controller = new AbortController()
  // a aba morreu com o diálogo na tela: ele fecha junto
  const abort = () => controller.abort()
  event.sender.once('destroyed', abort)
  try {
    const result = await showMessage(ctx, {
      message: `${describeDialogOrigin(frame)} diz:`,
      detail: clipForDialog(request.message, 1000),
      buttons: request.kind === 'confirm' ? ['OK', 'Cancelar'] : ['OK'],
      defaultId: OK,
      cancelId: request.kind === 'confirm' ? 1 : OK,
      noLink: true,
      signal: controller.signal,
      ...(offerBlock
        ? {
            checkboxLabel: 'Bloquear mais diálogos deste site',
            checkboxChecked: false
          }
        : {})
    })
    if (!result) return null
    return {
      accepted: result.response === OK,
      blockMore: result.checkboxChecked
    }
  } finally {
    if (!event.sender.isDestroyed()) event.sender.off('destroyed', abort)
  }
}

// a resposta que o preload entrega à página
export async function answerScriptDialog(
  ctx: MainContext,
  event: IpcMainEvent,
  payload: unknown
): Promise<boolean | null> {
  const request = readDialogRequest(payload)
  const tabId = findTabByContents(ctx, event.sender)
  if (!request || !tabId) return null

  const fallback = defaultAnswer(request.kind)
  const now = Date.now()
  const state = ctx.guard.dialogs.get(tabId)
  const decision = decideDialog(state, {
    isActive: ctx.attached.tabId === tabId,
    windowVisible: !ctx.win.isDestroyed() && ctx.win.isVisible(),
    now
  })

  if (decision.action === 'drop') {
    if (decision.reason !== 'blocked')
      ctx.store.patchTab(tabId, { dialogBlocked: true })
    console.warn(
      `[Dialogs][${request.kind}] descartado (${decision.reason}) na aba ${tabId}`
    )
    return fallback
  }

  if (request.kind === 'prompt') {
    console.warn(`[Dialogs][prompt] sem suporte: devolve null (aba ${tabId})`)
    return null
  }

  ctx.guard.dialogs.set(tabId, recordDialogShown(state, now))
  const answer = await showDialog(ctx, event, request, decision.offerBlock)
  if (!answer) return fallback
  if (answer.blockMore) {
    const current = ctx.guard.dialogs.get(tabId)
    if (current) current.blocked = true
  }
  return request.kind === 'confirm' ? answer.accepted : null
}

export function registerScriptDialogs(ctx: MainContext): void {
  ipcMain.on('guard:dialog', (event, payload: unknown) => {
    // a página espera por esta resposta: ela sempre sai, mesmo se algo falhar
    answerScriptDialog(ctx, event, payload).then(
      value => {
        event.returnValue = value
      },
      error => {
        console.error('[Dialogs][guard:dialog] falha', error)
        event.returnValue = null
      }
    )
  })
}
