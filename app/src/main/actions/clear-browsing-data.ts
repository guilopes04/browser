// Arquivo > Limpar dados de navegação…: apaga, só do espaço atual, cookies, cache, armazenamento
// dos sites (localStorage, IndexedDB), service workers, o histórico e as abas fechadas (⇧⌘T).
// Pede confirmação, e a sidebar avisa por alguns segundos quando termina.
import { dialog } from 'electron'
import type { MainContext } from '../context'
import {
  CLEAR_DATA_CONFIRM,
  describeClearData
} from '../functions/describe-clear-data'
import { getSpaceSession } from '../functions/get-space-session'
import { showWindow } from './show-window'

// quanto tempo a sidebar mostra "Dados limpos"
const NOTICE_MS = 4000

export async function clearBrowsingData(ctx: MainContext): Promise<boolean> {
  const { store } = ctx
  const space = store.getCurrentSpace()
  if (!ctx.win.isVisible()) showWindow(ctx)

  const { response } = await dialog.showMessageBox(
    ctx.win,
    describeClearData(space.name)
  )
  if (response !== CLEAR_DATA_CONFIRM) return false

  const ses = getSpaceSession(space.id)
  await ses.clearStorageData()
  await Promise.all([
    ses.clearCache(),
    ses.clearAuthCache(),
    ses.clearHostResolverCache()
  ])
  ctx.history.clearSpace(space.id)
  store.clearClosed(space.id)

  const cleared = { spaceId: space.id, at: Date.now() }
  store.setClearedData(cleared)
  const timer = setTimeout(() => {
    if (store.state.clearedData === cleared) store.setClearedData(null)
  }, NOTICE_MS)
  timer.unref()
  return true
}
