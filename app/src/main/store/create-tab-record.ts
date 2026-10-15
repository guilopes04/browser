// Cria o registro de uma aba nova. Url vazia = Nova aba (sem webContents).
import { randomUUID } from 'node:crypto'
import type { SpaceId, Tab } from '@shared/types'

export function createTabRecord(
  spaceId: SpaceId,
  url: string,
  now = Date.now()
): Tab {
  return {
    id: randomUUID(),
    spaceId,
    url,
    title: '',
    favicon: null,
    audible: false,
    muted: false,
    dormant: url !== '',
    lastActiveAt: now,
    loading: false,
    canGoBack: false,
    canGoForward: false,
    error: null,
    blockedPopups: 0,
    dialogBlocked: false
  }
}
