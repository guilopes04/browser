import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeLayout,
  getEffectiveSidebar
} from '../src/main/functions/compute-layout'

test('sidebar aberta: painel em 260,8 com recuo de 8 px', () => {
  const layout = computeLayout({ width: 1440, height: 900, sidebar: 'open' })
  assert.deepEqual(layout.page, {
    x: 260,
    y: 8,
    width: 1440 - 268,
    height: 884
  })
  assert.deepEqual(layout.shell, { x: 0, y: 0, width: 1440, height: 900 })
  assert.deepEqual(layout.trafficLights, {
    visible: true,
    position: { x: 15, y: 21 }
  })
  assert.equal(layout.pageRadius, 10)
})

test('sidebar oculta: painel em 8,8 e semáforos escondidos', () => {
  const layout = computeLayout({ width: 1440, height: 900, sidebar: 'hidden' })
  assert.deepEqual(layout.page, { x: 8, y: 8, width: 1424, height: 884 })
  assert.equal(layout.trafficLights.visible, false)
})

test('compacta: 76 px e semáforos em x 8', () => {
  const layout = computeLayout({ width: 1000, height: 700, sidebar: 'compact' })
  assert.deepEqual(layout.page, { x: 76, y: 8, width: 1000 - 84, height: 684 })
  assert.deepEqual(layout.trafficLights.position, { x: 8, y: 21 })
})

test('tela cheia de vídeo: página ocupa a janela, raio 0', () => {
  const layout = computeLayout({
    width: 1440,
    height: 900,
    sidebar: 'open',
    videoFullscreen: true
  })
  assert.deepEqual(layout.page, { x: 0, y: 0, width: 1440, height: 900 })
  assert.equal(layout.pageRadius, 0)
  assert.equal(layout.trafficLights.visible, false)
})

test('janela estreita: a sidebar aberta vira compacta, a oculta continua oculta', () => {
  const narrow = computeLayout({ width: 899, height: 700, sidebar: 'open' })
  assert.equal(narrow.sidebar, 'compact')
  assert.deepEqual(narrow.page, { x: 76, y: 8, width: 899 - 84, height: 684 })
  assert.deepEqual(narrow.trafficLights.position, { x: 8, y: 21 })

  assert.equal(
    computeLayout({ width: 900, height: 700, sidebar: 'open' }).sidebar,
    'open'
  )
  assert.equal(
    computeLayout({ width: 700, height: 700, sidebar: 'hidden' }).sidebar,
    'hidden'
  )
  assert.equal(getEffectiveSidebar('compact', 1440), 'compact')
})

test('sidebar oculta revelada: página igual, semáforos dentro da sidebar flutuante', () => {
  const hidden = computeLayout({ width: 1440, height: 900, sidebar: 'hidden' })
  const peek = computeLayout({
    width: 1440,
    height: 900,
    sidebar: 'hidden',
    peek: true
  })
  assert.deepEqual(peek.page, hidden.page)
  assert.deepEqual(peek.trafficLights, {
    visible: true,
    position: { x: 23, y: 29 }
  })
})

test('peek só vale com a sidebar oculta', () => {
  const layout = computeLayout({
    width: 1440,
    height: 900,
    sidebar: 'open',
    peek: true
  })
  assert.deepEqual(layout.trafficLights.position, { x: 15, y: 21 })
})
