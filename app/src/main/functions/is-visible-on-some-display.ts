// A janela salva ainda aparece em alguma tela? (um monitor removido deixaria a janela fora)
import { screen } from 'electron'
import type { Rect } from '@shared/types'

const MIN_VISIBLE_PX = 100

export function isVisibleOnSomeDisplay(bounds: Rect): boolean {
  return screen.getAllDisplays().some(display => {
    const area = display.workArea
    const width =
      Math.min(bounds.x + bounds.width, area.x + area.width) -
      Math.max(bounds.x, area.x)
    const height =
      Math.min(bounds.y + bounds.height, area.y + area.height) -
      Math.max(bounds.y, area.y)
    return width >= MIN_VISIBLE_PX && height >= MIN_VISIBLE_PX
  })
}
