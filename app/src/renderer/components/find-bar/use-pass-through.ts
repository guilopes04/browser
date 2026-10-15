// A view da barra é maior que a barra: a margem transparente em volta guarda a sombra do design.
// O que o mouse faz nessa margem (clicar, arrastar, rolar, passar por cima) é da página que está
// por baixo: vai para o main, que o entrega a ela no mesmo ponto.
import type { RefObject } from 'preact'
import { useEffect } from 'preact/hooks'
import type { FindPointer, FindPointerKind } from '@shared/find-pointer'
import { sendFindPointer } from '../../find-state'

const BUTTONS = ['left', 'middle', 'right'] as const

// a rolagem em linhas ou páginas (mouse com roda, em alguns ajustes) vira pontos
const LINE = 40
const PAGE = 800

function wheelScale(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return LINE
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return PAGE
  return 1
}

function toPointer(kind: FindPointerKind, event: MouseEvent): FindPointer {
  const wheel = event instanceof WheelEvent ? event : null
  const scale = wheel ? wheelScale(wheel) : 0
  return {
    kind,
    x: event.clientX,
    y: event.clientY,
    button: BUTTONS[event.button] ?? 'left',
    clickCount:
      kind === 'down' || kind === 'up'
        ? Math.min(Math.max(event.detail, 1), 3)
        : 0,
    buttons: event.buttons & 7,
    deltaX: wheel ? wheel.deltaX * scale : 0,
    deltaY: wheel ? wheel.deltaY * scale : 0,
    shift: event.shiftKey,
    alt: event.altKey,
    meta: event.metaKey,
    control: event.ctrlKey
  }
}

export function usePassThrough(bar: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    // o botão foi apertado na margem: o arrasto inteiro (e o soltar) é da página, mesmo passando
    // por cima da barra
    let dragging = false
    const inBar = (event: Event) =>
      event.target instanceof Node && !!bar.current?.contains(event.target)

    const onDown = (event: MouseEvent) => {
      if (inBar(event)) return
      // nada nesta view ganha o foco nem seleção: o clique é da página
      event.preventDefault()
      dragging = true
      sendFindPointer(toPointer('down', event))
    }
    const onMove = (event: MouseEvent) => {
      if (dragging || !inBar(event)) sendFindPointer(toPointer('move', event))
    }
    const onUp = (event: MouseEvent) => {
      if (!dragging) return
      dragging = false
      sendFindPointer(toPointer('up', event))
    }
    const onWheel = (event: WheelEvent) => {
      if (!inBar(event)) sendFindPointer(toPointer('wheel', event))
    }
    // o menu de contexto é o da página (ele chega com o botão direito repassado)
    const onContextMenu = (event: MouseEvent) => {
      if (!inBar(event)) event.preventDefault()
    }

    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup', onUp, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: true })
    window.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup', onUp, true)
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [])
}
