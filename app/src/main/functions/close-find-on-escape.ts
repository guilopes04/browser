// esc com o foco na página e a busca aberta: fecha a barra (como o Chrome). A tecla segue para a
// página, que pode ter o que fazer com ela.
import type { Input } from 'electron'
import type { TabId } from '@shared/types'
import { closeFind } from '../actions/close-find'
import type { MainContext } from '../context'

export function closeFindOnEscape(
  ctx: MainContext,
  tabId: TabId,
  input: Input
): void {
  if (ctx.find?.tabId !== tabId) return
  if (input.type !== 'keyDown' || input.key !== 'Escape' || input.isAutoRepeat)
    return
  if (input.meta || input.control || input.alt || input.shift) return
  closeFind(ctx)
}
