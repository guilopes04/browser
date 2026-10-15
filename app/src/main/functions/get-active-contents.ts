// webContents da aba que está na janela agora (nunca dormente).
import type { WebContents } from 'electron'
import type { MainContext } from '../context'
import { getLiveContents } from './get-live-contents'

export function getActiveContents(ctx: MainContext): WebContents | null {
  return getLiveContents(ctx.attached.view)
}
