// O preload das abas (preload/tab-guard.ts, em todos os quadros) reporta por IPC síncrono o
// clique ou a tecla do usuário, e o clique num link. É síncrono para o main saber do gesto antes
// de a página tratá-lo (o pop-up que o clique abre sai na mesma tarefa). Só quem tem o gesto
// "isTrusted" reporta, e o quadro vem do Chromium (senderFrame), não do que a página diz.
import { ipcMain, type IpcMainEvent } from 'electron'
import type { MainContext } from '../context'
import { findTabByContents } from '../functions/find-tab-by-contents'
import {
  markFrameGesture,
  markLinkClick,
  readLinkUrl
} from '../functions/frame-gesture'
import { describeFrame } from '../functions/snapshot-frames'

export function recordFrameGesture(
  ctx: MainContext,
  event: Pick<IpcMainEvent, 'sender' | 'senderFrame'>
): void {
  const tabId = findTabByContents(ctx, event.sender)
  const frame = event.senderFrame
  if (!tabId || !frame) return
  const { key, origin } = describeFrame(frame)
  markFrameGesture(ctx.guard, tabId, { key, origin })
}

export function recordLinkClick(
  ctx: MainContext,
  event: Pick<IpcMainEvent, 'sender'>,
  payload: unknown
): void {
  const tabId = findTabByContents(ctx, event.sender)
  const url = readLinkUrl(payload)
  if (tabId && url) markLinkClick(ctx.guard, tabId, url)
}

export function registerFrameGestures(ctx: MainContext): void {
  // o preload espera a resposta: ela sai antes de qualquer coisa que possa falhar
  ipcMain.on('guard:gesture', event => {
    event.returnValue = null
    try {
      recordFrameGesture(ctx, event)
    } catch (error) {
      console.error('[Gestures][guard:gesture] falha', error)
    }
  })
  ipcMain.on('guard:link-click', (event, payload: unknown) => {
    event.returnValue = null
    try {
      recordLinkClick(ctx, event, payload)
    } catch (error) {
      console.error('[Gestures][guard:link-click] falha', error)
    }
  })
}
