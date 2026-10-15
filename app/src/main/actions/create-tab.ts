// Cria uma aba no topo da lista do espaço. Sem url = Nova aba.
import type { SpaceId, Tab } from '@shared/types'
import type { MainContext } from '../context'
import { createTabRecord } from '../store/create-tab-record'
import { activateTab } from './activate-tab'
import { wakeTab } from './wake-tab'

export interface CreateTabInput {
  spaceId?: SpaceId
  url?: string
  background?: boolean
}

export function createTab(ctx: MainContext, input: CreateTabInput = {}): Tab {
  const { store } = ctx
  const spaceId =
    input.spaceId && store.getSpace(input.spaceId)
      ? input.spaceId
      : store.state.window.spaceId
  const tab = createTabRecord(spaceId, input.url ?? '')
  store.addTab(tab, 'top')
  if (input.background) wakeTab(ctx, tab.id)
  else activateTab(ctx, tab.id)
  return tab
}
