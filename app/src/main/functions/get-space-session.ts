// Sessão persistente de cada espaço, configurada uma única vez.
import { session, type Session } from 'electron'
import { cleanUserAgent } from './clean-user-agent'
import { getPartitionName } from './get-partition-name'

// o padrão do Electron concede tudo; até a peça de Permissão existir, só estes passam
const ALLOWED_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock'
])

const configured = new Set<string>()

function configureSession(ses: Session): void {
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()))
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
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
