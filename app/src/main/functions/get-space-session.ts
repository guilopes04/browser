// Sessão persistente de cada espaço, configurada uma única vez.
import { session, type Session } from 'electron'
import { cleanUserAgent } from './clean-user-agent'
import { getPartitionName } from './get-partition-name'
import { hardenSession } from './harden-session'
import { PAGE_PERMISSIONS } from './permission-policy'

const configured = new Set<string>()

function configureSession(ses: Session): void {
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()))
  // o padrão do Electron concede tudo; até a peça de Permissão existir, só PAGE_PERMISSIONS passa
  hardenSession(ses, PAGE_PERMISSIONS)
}

export function getSpaceSession(spaceId: string): Session {
  const ses = session.fromPartition(getPartitionName(spaceId))
  if (!configured.has(spaceId)) {
    configured.add(spaceId)
    configureSession(ses)
  }
  return ses
}
