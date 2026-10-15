// Liga os eventos do webContents de uma aba ao store (título, favicon, áudio, navegação).
import type { WebContents } from 'electron'
import type { Tab, TabId } from '@shared/types'
import { getHostname } from '@shared/url-parts'
import type { MainContext } from '../context'
import { applyLayout } from './apply-layout'
import { takeBlockedPopups } from './blocked-popups'
import { destroyTabView } from './destroy-tab-view'
import { faviconToDataUrl } from './favicon-to-data-url'
import { forwardEarlyKey } from './forward-early-key'
import { handleEarlyShortcut } from './handle-early-shortcut'
import { shouldFallbackToHttp } from './http-fallback-errors'
import { readNavigation } from './stash-navigation'
import {
  isActivationKey,
  isActivationPointer,
  markGesture
} from './user-gesture'

// códigos de rede do Chromium
const ERR_ABORTED = -3

function sameUrl(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href
  } catch {
    return a === b
  }
}

// um renderer que cai é recarregado uma vez; se cair de novo logo em seguida, fica como está
const CRASH_RELOAD_GAP_MS = 10_000

export function attachTabEvents(
  ctx: MainContext,
  tabId: TabId,
  wc: WebContents
): void {
  const { store } = ctx

  const syncNavigation = () => {
    if (wc.isDestroyed()) return
    const url = wc.getURL()
    store.patchTab(tabId, {
      ...(url ? { url } : {}),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward()
    })
  }

  // histórico do espaço da aba (a aba pode ter mudado de espaço desde que a view nasceu)
  const recordVisit = () => {
    const tab = store.getTab(tabId)
    if (tab && !wc.isDestroyed())
      ctx.history.record(tab.spaceId, wc.getURL(), wc.getTitle())
  }

  wc.on('before-input-event', (event, input) => {
    if (handleEarlyShortcut(ctx, event, input)) return
    // com a paleta (ou a Nova aba) abrindo, as teclas seguem para a shell em vez de cair na página
    forwardEarlyKey(ctx, event, input)
    // só é gesto da página a tecla que chegou a ela
    if (!event.defaultPrevented && isActivationKey(input))
      markGesture(ctx.guard, tabId)
  })

  // clique do usuário na página (a página não forja input-event); libera download, pop-up e afins
  wc.on('input-event', (_event, inputEvent) => {
    if (isActivationPointer(inputEvent.type)) markGesture(ctx.guard, tabId)
  })

  wc.on('page-title-updated', (_event, title) => {
    // a página de erro é da shell: o título da aba segue sendo o host que falhou
    if (store.getTab(tabId)?.error) return
    store.patchTab(tabId, { title })
    const tab = store.getTab(tabId)
    if (tab) ctx.history.setTitle(tab.spaceId, wc.getURL(), title)
  })

  wc.on('page-favicon-updated', (_event, favicons) => {
    const tab = store.getTab(tabId)
    if (!tab) return
    void faviconToDataUrl(wc.session, favicons).then(favicon => {
      if (!favicon || wc.isDestroyed()) return
      store.patchTab(tabId, { favicon })
      store.fillFavoriteFavicons(wc.getURL(), favicon)
    })
  })

  wc.on('did-start-loading', () => store.patchTab(tabId, { loading: true }))

  wc.on('did-stop-loading', () => {
    store.patchTab(tabId, { loading: false })
    syncNavigation()
  })

  // a página de erro é da shell (como a Nova aba): o main só guarda o erro na aba e esconde a
  // view da página enquanto ele existir. A página de erro do Chromium não dispara did-navigate,
  // então um did-navigate é sempre uma página que carregou de verdade
  // na página de erro a aba deixa de se parecer com o site que falhou: o título vira o host e o
  // favicon volta ao padrão (letra e cor)
  const setError = (error: Tab['error'], failedUrl = '') => {
    store.patchTab(tabId, {
      error,
      ...(error
        ? { title: getHostname(failedUrl) || failedUrl, favicon: null }
        : {})
    })
    if (ctx.attached.tabId !== tabId) return
    applyLayout(ctx)
    if (error) ctx.shell.webContents.focus()
    else wc.focus()
  }

  wc.on('did-navigate', () => {
    ctx.httpFallbacks.delete(tabId)
    // página nova: o aviso de pop-up bloqueado, a contagem de diálogos e o "bloquear mais" eram
    // da anterior (o bloqueio de diálogos vale "até recarregar")
    if (ctx.guard.blockedPopups.has(tabId)) takeBlockedPopups(ctx, tabId)
    ctx.guard.dialogs.delete(tabId)
    if (store.getTab(tabId)?.dialogBlocked)
      store.patchTab(tabId, { dialogBlocked: false })
    syncNavigation()
    recordVisit()
    if (store.getTab(tabId)?.error) setError(null)
  })

  wc.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === ERR_ABORTED || wc.isDestroyed()) return

      const fallback = ctx.httpFallbacks.get(tabId)
      ctx.httpFallbacks.delete(tabId)
      if (
        fallback &&
        shouldFallbackToHttp(errorCode) &&
        sameUrl(fallback.from, validatedURL)
      ) {
        store.patchTab(tabId, { url: fallback.to })
        void wc.loadURL(fallback.to).catch(() => {})
        return
      }

      if (!store.getTab(tabId)) return
      if (validatedURL) store.patchTab(tabId, { url: validatedURL })
      setError(
        {
          code: errorCode,
          description: errorDescription || `ERR_${Math.abs(errorCode)}`
        },
        validatedURL || store.getTab(tabId)?.url
      )
    }
  )

  wc.on('did-navigate-in-page', (_event, _url, isMainFrame) => {
    if (!isMainFrame) return
    syncNavigation()
    recordVisit()
  })

  wc.on('audio-state-changed', event => {
    store.patchTab(tabId, { audible: event.audible })
  })

  let lastCrashReload = 0
  wc.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return
    console.error(`[Tab][render-process-gone] ${tabId}: ${details.reason}`)
    if (ctx.attached.tabId === tabId) {
      const now = Date.now()
      if (now - lastCrashReload > CRASH_RELOAD_GAP_MS) {
        lastCrashReload = now
        wc.reload()
      }
      return
    }
    // aba em segundo plano: vira dormente e recarrega quando for aberta. O histórico de
    // voltar/avançar fica guardado, como numa suspensão
    if (!wc.isDestroyed()) ctx.stash.set(tabId, readNavigation(wc))
    destroyTabView(ctx, tabId)
    store.patchTab(tabId, {
      dormant: true,
      loading: false,
      audible: false,
      canGoBack: false,
      canGoForward: false,
      error: null,
      blockedPopups: 0,
      dialogBlocked: false
    })
  })
}
