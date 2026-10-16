// Quem pede (pop-up, download, abrir em outro app) foi ativado pelo gesto do usuário? Junta o que
// o main sabe da aba: os quadros agora, os gestos reportados por quadro e o último gesto visto.
import type { WebContents } from 'electron'
import type { TabId } from '@shared/types'
import type { MainContext } from '../context'
import { judgeActivation, type Activation } from './frame-activation'
import { snapshotFrames } from './snapshot-frames'
import { getLastGesture } from './user-gesture'

export function judgeRequester(
  ctx: MainContext,
  tabId: TabId,
  contents: Pick<WebContents, 'mainFrame'> | null | undefined,
  requesterOrigin: string | null,
  now = Date.now()
): Activation {
  return judgeActivation({
    frames: snapshotFrames(contents),
    gestures: ctx.guard.frameGestures.get(tabId) ?? [],
    tabGestureAt: getLastGesture(ctx.guard, tabId),
    requesterOrigin,
    now
  })
}
