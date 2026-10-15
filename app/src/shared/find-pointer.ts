// O mouse na margem transparente da view da barra de busca. A view é maior que a barra (a sombra do
// design precisa de espaço), e a margem cobriria um pedaço da página: o que o mouse faz nela a
// barra repassa ao main, que o entrega à página no mesmo ponto. Puro.

export type FindPointerKind = 'down' | 'up' | 'move' | 'wheel'
export type FindPointerButton = 'left' | 'middle' | 'right'

export interface FindPointer {
  kind: FindPointerKind
  // posição na view da barra, em pontos
  x: number
  y: number
  button: FindPointerButton
  // 1 no clique simples, 2 no duplo (seleciona a palavra na página)...
  clickCount: number
  // botões pressionados durante o movimento (bits do MouseEvent.buttons): arrastar seleciona
  buttons: number
  // rolagem, em pontos, no sentido do DOM (positivo = para baixo e para a direita)
  deltaX: number
  deltaY: number
  shift: boolean
  alt: boolean
  meta: boolean
  control: boolean
}

const KINDS: readonly string[] = ['down', 'up', 'move', 'wheel']
const BUTTONS: readonly string[] = ['left', 'middle', 'right']
// nenhuma view da barra passa disto; um número fora disto não é um ponto dela
const MAX_COORD = 10_000
const MAX_DELTA = 10_000

function isNumberIn(value: unknown, limit: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  )
}

// o que chega pelo IPC (find:pointer), conferido campo a campo; null se não for um ponteiro
export function readFindPointer(value: unknown): FindPointer | null {
  if (typeof value !== 'object' || value === null) return null
  const input = value as Record<string, unknown>
  if (typeof input.kind !== 'string' || !KINDS.includes(input.kind)) return null
  if (typeof input.button !== 'string' || !BUTTONS.includes(input.button))
    return null
  if (!isNumberIn(input.x, MAX_COORD) || !isNumberIn(input.y, MAX_COORD))
    return null
  if (
    !isNumberIn(input.deltaX, MAX_DELTA) ||
    !isNumberIn(input.deltaY, MAX_DELTA)
  )
    return null
  if (
    !isNumberIn(input.clickCount, 3) ||
    !Number.isInteger(input.clickCount) ||
    input.clickCount < 0
  )
    return null
  if (
    !isNumberIn(input.buttons, 31) ||
    !Number.isInteger(input.buttons) ||
    input.buttons < 0
  )
    return null
  for (const flag of ['shift', 'alt', 'meta', 'control'])
    if (typeof input[flag] !== 'boolean') return null
  return {
    kind: input.kind as FindPointerKind,
    x: input.x,
    y: input.y,
    button: input.button as FindPointerButton,
    clickCount: input.clickCount,
    buttons: input.buttons,
    deltaX: input.deltaX,
    deltaY: input.deltaY,
    shift: input.shift as boolean,
    alt: input.alt as boolean,
    meta: input.meta as boolean,
    control: input.control as boolean
  }
}
