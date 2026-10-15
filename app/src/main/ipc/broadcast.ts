// Envia estado para a shell: snapshot no máximo uma vez por tick; patches de aba
// coalescidos no intervalo de um frame.
import type { WebContents } from 'electron'
import type { Events } from '@shared/ipc'
import type { AppSnapshot, Tab, TabId } from '@shared/types'

const TAB_PATCH_INTERVAL_MS = 16

export interface Broadcaster {
  scheduleSnapshot(): void
  queueTabPatch(tabId: TabId, patch: Partial<Tab>): void
  send<K extends keyof Events>(channel: K, payload: Events[K]): void
}

export function createBroadcaster(
  getState: () => AppSnapshot,
  getTarget: () => WebContents | null
): Broadcaster {
  let snapshotScheduled = false
  let patchTimer: NodeJS.Timeout | null = null
  const pending = new Map<TabId, Partial<Tab>>()

  const send: Broadcaster['send'] = (channel, payload) => {
    const target = getTarget()
    if (target && !target.isDestroyed() && !target.isCrashed())
      target.send(channel, payload)
  }

  const flushPatches = () => {
    patchTimer = null
    for (const [tabId, patch] of pending) send('state:tab', { tabId, patch })
    pending.clear()
  }

  return {
    scheduleSnapshot() {
      if (snapshotScheduled) return
      snapshotScheduled = true
      setImmediate(() => {
        snapshotScheduled = false
        // o snapshot já leva tudo o que estava pendente
        pending.clear()
        send('state:snapshot', getState())
      })
    },
    queueTabPatch(tabId, patch) {
      pending.set(tabId, { ...pending.get(tabId), ...patch })
      if (!patchTimer)
        patchTimer = setTimeout(flushPatches, TAB_PATCH_INTERVAL_MS)
    },
    send
  }
}
