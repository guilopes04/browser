// Sessão persistente de cada espaço, configurada uma única vez.
import { app, session, type Session } from 'electron'
import { parseAddressSpaceOverrides } from '@shared/address-space-overrides'
import type { MainContext } from '../context'
import { cleanUserAgent } from './clean-user-agent'
import { getPartitionName } from './get-partition-name'
import { requestExternalOpen } from './handle-external-open'
import { hardenSession } from './harden-session'
import { installLocalNetworkGuard } from './local-network-guard'
import { isPermissionAllowed, PAGE_PERMISSIONS } from './permission-policy'
import { getTabPreloadPath } from './tab-preload-path'

const configured = new Set<string>()

// o contexto do app: a permissão "openExternal" é respondida por um diálogo, que precisa dele
let boundContext: MainContext | null = null

export function bindSessionContext(ctx: MainContext): void {
  boundContext = ctx
}

function configureSession(ses: Session): void {
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()))
  // o padrão do Electron concede tudo; até a peça de Permissão existir, só PAGE_PERMISSIONS passa
  hardenSession(ses, PAGE_PERMISSIONS)
  // mailto:, tel: e afins: o usuário decide num diálogo (nunca abre em silêncio); o resto segue a
  // política de permissões de página
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission === 'openExternal') {
      if (boundContext)
        requestExternalOpen(
          boundContext,
          contents,
          (details as { externalURL?: string }).externalURL,
          callback,
          (details as { requestingUrl?: string }).requestingUrl
        )
      else callback(false)
      return
    }
    callback(isPermissionAllowed(permission, PAGE_PERMISSIONS))
  })
  // página da internet não alcança a rede local (roteador, serviços em localhost)
  installLocalNetworkGuard(
    ses,
    parseAddressSpaceOverrides(
      app.commandLine.getSwitchValue('ip-address-space-overrides')
    )
  )
  // o preload da guarda vale para todo webContents da sessão, inclusive o pop-up que o Chromium cria
  // (window.open) e a aba adota: o preload das webPreferences não chega a ele
  const preload = getTabPreloadPath()
  if (preload)
    ses.registerPreloadScript({
      type: 'frame',
      filePath: preload,
      id: 'gilas-tab-guard'
    })
}

export function getSpaceSession(spaceId: string): Session {
  const ses = session.fromPartition(getPartitionName(spaceId))
  if (!configured.has(spaceId)) {
    configured.add(spaceId)
    configureSession(ses)
  }
  return ses
}
