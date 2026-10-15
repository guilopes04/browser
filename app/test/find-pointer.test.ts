import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFindPointer, type FindPointer } from '@shared/find-pointer'
import { toPageMouseEvent } from '../src/main/functions/to-page-mouse-event'

const BASE: FindPointer = {
  kind: 'down',
  x: 200,
  y: 66,
  button: 'left',
  clickCount: 1,
  buttons: 1,
  deltaX: 0,
  deltaY: 0,
  shift: false,
  alt: false,
  meta: false,
  control: false
}

// a view da barra (com a margem da sombra) no canto do painel da página, como no app
const VIEW = { x: 1003, y: 8, width: 437, height: 84 }
const PAGE = { x: 260, y: 8, width: 1172, height: 844 }

test('o ponteiro que a barra manda é conferido campo a campo', () => {
  assert.deepEqual(readFindPointer({ ...BASE }), BASE)
  assert.equal(readFindPointer(null), null)
  assert.equal(readFindPointer('down'), null)
  assert.equal(readFindPointer({ ...BASE, kind: 'click' }), null)
  assert.equal(readFindPointer({ ...BASE, button: 'back' }), null)
  assert.equal(readFindPointer({ ...BASE, x: Number.NaN }), null)
  assert.equal(readFindPointer({ ...BASE, y: 1e9 }), null)
  assert.equal(readFindPointer({ ...BASE, clickCount: 4 }), null)
  assert.equal(readFindPointer({ ...BASE, clickCount: 1.5 }), null)
  assert.equal(readFindPointer({ ...BASE, buttons: 64 }), null)
  assert.equal(readFindPointer({ ...BASE, deltaY: Infinity }), null)
  assert.equal(readFindPointer({ ...BASE, shift: 'sim' }), null)
  const withoutMeta: Partial<FindPointer> = { ...BASE }
  delete withoutMeta.meta
  assert.equal(readFindPointer(withoutMeta), null)
})

test('clique na margem da barra vira o clique da página no mesmo ponto da janela', () => {
  assert.deepEqual(toPageMouseEvent(BASE, VIEW, PAGE), {
    type: 'mouseDown',
    x: 1003 + 200 - 260,
    y: 66,
    button: 'left',
    clickCount: 1,
    modifiers: ['leftbuttondown']
  })
  const up = toPageMouseEvent(
    { ...BASE, kind: 'up', buttons: 0, clickCount: 2, shift: true },
    VIEW,
    PAGE
  )
  assert.equal(up?.type, 'mouseUp')
  assert.equal(up?.clickCount, 2)
  assert.deepEqual(up?.modifiers, ['shift'])
})

test('rolar na margem rola a página (o Chromium conta ao contrário do DOM)', () => {
  const wheel = toPageMouseEvent(
    { ...BASE, kind: 'wheel', buttons: 0, deltaX: 3, deltaY: 120 },
    VIEW,
    PAGE
  )
  assert.equal(wheel?.type, 'mouseWheel')
  assert.ok(wheel && 'deltaY' in wheel)
  assert.equal(wheel.deltaY, -120)
  assert.equal(wheel.deltaX, -3)
  assert.equal(wheel.canScroll, true)
})

test('fora da página o clique não vale; o arrasto que sai dela continua', () => {
  // a margem direita da view passa da borda do painel (vai até a borda da janela)
  const outside = { ...BASE, x: 436 }
  assert.equal(toPageMouseEvent(outside, VIEW, PAGE), null)
  assert.equal(
    toPageMouseEvent({ ...outside, kind: 'wheel' }, VIEW, PAGE),
    null
  )
  const drag = toPageMouseEvent({ ...outside, kind: 'move' }, VIEW, PAGE)
  assert.equal(drag?.type, 'mouseMove')
  assert.deepEqual(drag?.modifiers, ['leftbuttondown'])
  assert.equal(
    toPageMouseEvent({ ...outside, kind: 'up', buttons: 0 }, VIEW, PAGE)?.type,
    'mouseUp'
  )
})

test('botões e modificadores seguem para a página', () => {
  const event = toPageMouseEvent(
    {
      ...BASE,
      kind: 'move',
      buttons: 2 | 4,
      button: 'right',
      alt: true,
      meta: true,
      control: true
    },
    VIEW,
    PAGE
  )
  assert.deepEqual(event?.modifiers, [
    'alt',
    'meta',
    'control',
    'rightbuttondown',
    'middlebuttondown'
  ])
})
