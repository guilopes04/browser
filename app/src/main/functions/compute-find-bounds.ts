// Onde fica a view da barra de busca: a barra de 397×44 a 12 pt do alto e da direita do painel
// da página (Busca.dc.html), mais a margem da sombra. Pura.
import {
  FIND_BAR_HEIGHT,
  FIND_BAR_INSET,
  FIND_BAR_MARGIN,
  FIND_BAR_WIDTH
} from '@shared/tokens'
import type { Rect } from '@shared/types'

export function computeFindBounds(page: Rect): Rect {
  const width = FIND_BAR_WIDTH + FIND_BAR_MARGIN.left + FIND_BAR_MARGIN.right
  const height = FIND_BAR_HEIGHT + FIND_BAR_MARGIN.top + FIND_BAR_MARGIN.bottom
  const barRight = page.x + page.width - FIND_BAR_INSET
  return {
    x: barRight + FIND_BAR_MARGIN.right - width,
    y: page.y + FIND_BAR_INSET - FIND_BAR_MARGIN.top,
    width,
    height
  }
}
