// Com enableLargerThanScreen o macOS não ajusta mais a origem: abaixo da barra de menus, à mão.
import { screen } from 'electron'
import type { Rect } from '@shared/types'

export function clampOrigin(bounds: Rect): Rect {
  const area = screen.getDisplayMatching(bounds).workArea
  return {
    ...bounds,
    x: Math.max(bounds.x, area.x),
    y: Math.max(bounds.y, area.y)
  }
}
