// Sessão persistente de cada espaço, configurada uma única vez.
import { session, type Session } from 'electron'
import type { MainContext } from '../context'
import { cleanUserAgent } from './clean-user-agent'
import { getPartitionName } from './get-partition-name'
import { requestExternalOpen } from './handle-external-open'

// o padrão do Electron concede tudo; até a peça de Permissão existir, só estes passam
const ALLOWED_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock'
])

const configured = new Set<string>()

// o contexto do app: a permissão "openExternal" é respondida por um diálogo, que precisa dele
let boundContext: MainContext | null = null

export function bindSessionContext(ctx: MainContext): void {
  boundContext = ctx
}

function configureSession(ses: Session): void {
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()))
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    // mailto:, tel: e afins: o usuário decide num diálogo (nunca abre em silêncio)
    if (permission === 'openExternal') {
      if (boundContext)
        requestExternalOpen(
          boundContext,
          contents,
          (details as { externalURL?: string }).externalURL,
          callback
        )
      else callback(false)
      return
    }
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  ses.setPermissionCheckHandler((_contents, permission) =>
    ALLOWED_PERMISSIONS.has(permission)
  )
}

export function getSpaceSession(spaceId: string): Session {
  const ses = session.fromPartition(getPartitionName(spaceId))
  if (!configured.has(spaceId)) {
    configured.add(spaceId)
    configureSession(ses)
  }
  return ses
}
