// Depois de fechar ou mover a aba ativa de um espaço: escolhe a vizinha (a de baixo,
// senão a de cima) ou abre uma Nova aba se o espaço ficou vazio.
import type { SpaceId } from '@shared/types'
import type { MainContext } from '../context'
import { createTabRecord } from '../store/create-tab-record'
import { activateTab } from './activate-tab'

export function pickNextTab(
  ctx: MainContext,
  spaceId: SpaceId,
  removedIndex: number
): void {
  const { store } = ctx
  const remaining = store.getTabsOfSpace(spaceId)
  const next = remaining[removedIndex] ?? remaining[removedIndex - 1]
  const isCurrent = store.state.window.spaceId === spaceId

  if (next) {
    if (isCurrent) activateTab(ctx, next.id)
    else store.setActiveTab(spaceId, next.id)
    return
  }

  const fresh = createTabRecord(spaceId, '')
  store.addTab(fresh, 'top')
  if (isCurrent) activateTab(ctx, fresh.id)
  else store.setActiveTab(spaceId, fresh.id)
}
