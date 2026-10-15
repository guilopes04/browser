// Arquivo local (file://) não abre nesta versão: a aba mostra a página de erro da shell, sem
// carregar nada. Uma aba viva mantém a página que já tinha (escondida) até a próxima navegação.
import { LOCAL_FILE_ERROR } from '@shared/describe-load-error'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'

export function blockLocalFile(ctx: MainContext, tabId: TabId): void {
  if (!ctx.store.getTab(tabId)) return
  ctx.store.patchTab(tabId, {
    error: { ...LOCAL_FILE_ERROR },
    title: 'Arquivo local',
    favicon: null,
    loading: false
  })
  if (ctx.attached.tabId !== tabId) return
  applyLayout(ctx)
  ctx.shell.webContents.focus()
}
