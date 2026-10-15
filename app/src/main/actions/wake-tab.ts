// Acorda uma aba dormente: cria a view na partição do espaço e restaura ou carrega.
import type { WebContentsView } from 'electron'
import { isLocalFileUrl } from '@shared/is-local-file-url'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { blockLocalFile } from '../functions/block-local-file'
import { createTabView } from '../functions/create-tab-view'
import { getLiveContents } from '../functions/get-live-contents'
import { hideTabView } from '../functions/show-tab-view'
import { planScrollRestore } from '../functions/restore-scroll'

// devolve a view existente, ou a nova; null para Nova aba (sem webContents)
export function wakeTab(
  ctx: MainContext,
  tabId: TabId
): WebContentsView | null {
  const existing = ctx.views.get(tabId)
  if (existing) {
    if (getLiveContents(existing)) return existing
    // a página morreu e o evento ainda não chegou: descarta a view e recria como numa suspensão
    if (ctx.attached.view === existing) hideTabView(ctx)
    ctx.views.delete(tabId)
  }
  const tab = ctx.store.getTab(tabId)
  if (!tab || !tab.url) return null
  // sessão antiga ou editada à mão com um file://: nada é carregado
  if (isLocalFileUrl(tab.url)) {
    ctx.store.patchTab(tabId, { url: '', dormant: false })
    blockLocalFile(ctx, tabId)
    return null
  }

  const view = createTabView(ctx, tab)
  const wc = view.webContents
  const stash = ctx.stash.get(tabId)
  ctx.stash.delete(tabId)

  // restore devolve voltar/avançar; a rolagem o Chromium nem sempre mantém, então é reaplicada
  // quando a página carrega e a aba está na janela. Sem stash, carrega a URL
  if (stash && stash.entries.length > 0) {
    void wc.navigationHistory
      .restore({ entries: stash.entries, index: stash.index })
      .catch(() => {})
    if (stash.scroll) planScrollRestore(ctx, tabId, wc, stash.scroll)
  } else {
    void wc.loadURL(tab.url).catch(() => {})
  }

  ctx.store.touchTab(tabId)
  ctx.store.patchTab(tabId, { dormant: false, loading: true })
  return view
}
