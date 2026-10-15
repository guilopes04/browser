// Guarda o histórico de navegação da aba antes de destruir o webContents.
import type { WebContents } from 'electron'
import type { NavigationStash } from '../context'

export function readNavigation(wc: WebContents): NavigationStash {
  return {
    entries: wc.navigationHistory.getAllEntries(),
    index: wc.navigationHistory.getActiveIndex()
  }
}
