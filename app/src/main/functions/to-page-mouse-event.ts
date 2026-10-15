// O evento de mouse que a página recebe no lugar do que caiu na margem da barra de busca: o ponto
// da view da barra vira o ponto da página (as duas em coordenadas da janela). Fora da página, nada.
// Pura: só tipos do Electron.
import type {
  InputEvent,
  MouseInputEvent,
  MouseWheelInputEvent
} from 'electron'
import type { FindPointer } from '@shared/find-pointer'
import type { Rect } from '@shared/types'

type Modifier = NonNullable<InputEvent['modifiers']>[number]

const TYPES = {
  down: 'mouseDown',
  up: 'mouseUp',
  move: 'mouseMove'
} as const

function modifiersOf(pointer: FindPointer): Modifier[] {
  const modifiers: Modifier[] = []
  if (pointer.shift) modifiers.push('shift')
  if (pointer.alt) modifiers.push('alt')
  if (pointer.meta) modifiers.push('meta')
  if (pointer.control) modifiers.push('control')
  // MouseEvent.buttons: 1 = esquerdo, 2 = direito, 4 = do meio
  if (pointer.buttons & 1) modifiers.push('leftbuttondown')
  if (pointer.buttons & 2) modifiers.push('rightbuttondown')
  if (pointer.buttons & 4) modifiers.push('middlebuttondown')
  return modifiers
}

export function toPageMouseEvent(
  pointer: FindPointer,
  view: Rect,
  page: Rect
): MouseInputEvent | MouseWheelInputEvent | null {
  const x = Math.round(view.x + pointer.x - page.x)
  const y = Math.round(view.y + pointer.y - page.y)
  // arrastar pode sair da view; só o clique e a rolagem precisam cair dentro da página
  const inside = x >= 0 && y >= 0 && x < page.width && y < page.height
  if (!inside && pointer.kind !== 'move' && pointer.kind !== 'up') return null
  const modifiers = modifiersOf(pointer)
  if (pointer.kind === 'wheel')
    return {
      type: 'mouseWheel',
      x,
      y,
      // o Chromium conta a rolagem ao contrário do DOM: positivo é para cima e para a esquerda
      deltaX: -pointer.deltaX,
      deltaY: -pointer.deltaY,
      hasPreciseScrollingDeltas: true,
      canScroll: true,
      modifiers
    }
  return {
    type: TYPES[pointer.kind],
    x,
    y,
    button: pointer.button,
    clickCount: pointer.clickCount,
    modifiers
  }
}
