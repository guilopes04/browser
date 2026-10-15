// Esquemas externos (mailto:, tel:, x-apple.systempreferences: e o que mais houver registrado):
// o Chromium pede a permissão "openExternal" e, antes, o app abria em silêncio (ou, com a
// permissão negada, não abria nada e não dizia nada). Agora:
// - só com gesto recente do usuário na aba (a página não abre app por script);
// - esquema que nenhum app do Mac trata: a aba mostra a página de erro;
// - esquema tratado por um app: diálogo "Abrir <esquema> em outro app?", com Cancelar como padrão.
// Nunca abre em silêncio.
import { app, type WebContents } from 'electron'
import { getHostname } from '@shared/url-parts'
import type { MainContext } from '../context'
import { externalSchemeOf } from './external-scheme'
import { findTabByContents } from './find-tab-by-contents'
import { clipForDialog, showMessage } from './show-message'
import { showTabError } from './show-tab-error'
import { hasRecentGesture } from './user-gesture'

const CANCEL = 0
const OPEN = 1
// -302: ERR_UNKNOWN_URL_SCHEME
const UNKNOWN_SCHEME = -302

export function requestExternalOpen(
  ctx: MainContext,
  contents: WebContents | null,
  externalUrl: string | undefined,
  callback: (allow: boolean) => void
): void {
  const tabId = findTabByContents(ctx, contents)
  const scheme = externalUrl ? externalSchemeOf(externalUrl) : null
  if (!externalUrl || !scheme || !tabId) {
    callback(false)
    return
  }
  // a página não abre app por conta própria: sem clique ou tecla do usuário, nada acontece
  if (!hasRecentGesture(ctx.guard, tabId)) {
    console.warn(`[External][openExternal] sem gesto, recusado: ${scheme}:`)
    callback(false)
    return
  }
  // uma pergunta por vez em cada aba
  if (ctx.guard.externalPending.has(tabId)) {
    callback(false)
    return
  }

  const handler = app.getApplicationNameForProtocol(externalUrl)
  if (!handler) {
    showTabError(
      ctx,
      tabId,
      {
        code: UNKNOWN_SCHEME,
        description: 'ERR_UNKNOWN_URL_SCHEME',
        target: scheme
      },
      scheme
    )
    callback(false)
    return
  }

  ctx.guard.externalPending.add(tabId)
  const site = getHostname(contents?.getURL() ?? '')
  void showMessage(ctx, {
    type: 'warning',
    buttons: ['Cancelar', 'Abrir'],
    defaultId: CANCEL,
    cancelId: CANCEL,
    noLink: true,
    message: `Abrir ${scheme} em outro app?`,
    detail:
      `${site ? `${site} quer` : 'A página quer'} abrir o app ${handler}.\n` +
      clipForDialog(externalUrl, 200)
  })
    .then(result => result?.response === OPEN)
    .catch(() => false)
    .then(allowed => {
      ctx.guard.externalPending.delete(tabId)
      callback(allowed)
    })
}
