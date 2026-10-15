import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeFindBounds } from '../src/main/functions/compute-find-bounds'
import { computeLayout } from '../src/main/functions/compute-layout'
import {
  FIND_BAR_HEIGHT,
  FIND_BAR_INSET,
  FIND_BAR_MARGIN,
  FIND_BAR_WIDTH
} from '@shared/tokens'

// a barra de 397×44 pt (Busca.dc.html) a 12 pt do alto e da direita do painel da página
function bar(page: { x: number; y: number; width: number; height: number }) {
  const bounds = computeFindBounds(page)
  return {
    left: bounds.x + FIND_BAR_MARGIN.left,
    top: bounds.y + FIND_BAR_MARGIN.top,
    right: bounds.x + bounds.width - FIND_BAR_MARGIN.right,
    bottom: bounds.y + bounds.height - FIND_BAR_MARGIN.bottom
  }
}

test('no design (1440×900, sidebar aberta) a barra vai de x 1023 a 1420 e de y 20 a 64', () => {
  const { page } = computeLayout({ width: 1440, height: 900, sidebar: 'open' })
  assert.deepEqual(bar(page), { left: 1023, top: 20, right: 1420, bottom: 64 })
})

test('a barra mede 397×44 e acompanha o canto do painel em qualquer modo', () => {
  for (const sidebar of ['open', 'compact', 'hidden'] as const) {
    const { page } = computeLayout({ width: 1200, height: 800, sidebar })
    const box = bar(page)
    assert.equal(box.right - box.left, FIND_BAR_WIDTH)
    assert.equal(box.bottom - box.top, FIND_BAR_HEIGHT)
    assert.equal(box.right, page.x + page.width - FIND_BAR_INSET)
    assert.equal(box.top, page.y + FIND_BAR_INSET)
  }
})

test('a view inclui a margem da sombra e nunca sai da janela nem do painel', () => {
  const { page } = computeLayout({
    width: 560,
    height: 400,
    sidebar: 'compact'
  })
  const bounds = computeFindBounds(page)
  assert.equal(
    bounds.width,
    FIND_BAR_WIDTH + FIND_BAR_MARGIN.left + FIND_BAR_MARGIN.right
  )
  assert.equal(
    bounds.height,
    FIND_BAR_HEIGHT + FIND_BAR_MARGIN.top + FIND_BAR_MARGIN.bottom
  )
  assert.ok(bounds.x >= 0 && bounds.y >= 0)
  assert.ok(bar(page).left >= page.x)
})
