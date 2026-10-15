// A aba dona de um webContents (o evento will-download só entrega o webContents).
import type { WebContents } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'

export function findTabByContents(
  ctx: MainContext,
  contents: WebContents | null | undefined
): TabId | null {
  if (!contents) return null
  for (const [tabId, view] of ctx.views) {
    // view destruída: o Electron tira a propriedade webContents (ver get-live-contents.ts)
    const candidate = view.webContents as WebContents | undefined
    if (candidate === contents) return tabId
  }
  return null
}
