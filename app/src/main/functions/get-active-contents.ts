// webContents da aba que está na janela agora (nunca dormente).
import type { WebContents } from 'electron'
import type { MainContext } from '../context'

export function getActiveContents(ctx: MainContext): WebContents | null {
  const view = ctx.attached.view
  if (!view || view.webContents.isDestroyed()) return null
  return view.webContents
}
