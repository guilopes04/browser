import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseDuration, parseFlags } from '../src/main/flags'

test('parseFlags lê as flags do app', () => {
  const flags = parseFlags([
    'electron',
    '.',
    '--abas=../bench/tabs.json',
    '--captura=/tmp/x.png',
    '--suspender-apos=5',
    '--tema=claro',
    '--carregar-todas',
    '--largura',
    '1200',
    '--altura=700',
    '--x=10'
  ])
  assert.equal(flags.tabsSource, '../bench/tabs.json')
  assert.equal(flags.capturePath, '/tmp/x.png')
  assert.equal(flags.suspendAfterMs, 5000)
  assert.equal(flags.theme, 'light')
  assert.equal(flags.loadAll, true)
  assert.deepEqual(flags.window, { width: 1200, height: 700, x: 10 })
})

test('--janela=x,y,largura,altura e padrões', () => {
  assert.deepEqual(parseFlags(['--janela=0,0,1440,900']).window, {
    x: 0,
    y: 0,
    width: 1440,
    height: 900
  })
  const empty = parseFlags([])
  assert.equal(empty.suspendAfterMs, null)
  assert.equal(empty.loadAll, false)
  assert.equal(empty.captureDelayMs, 1500)
})

test('parseDuration: número puro é segundos, com sufixos ms, s e min', () => {
  assert.equal(parseDuration('5'), 5000)
  assert.equal(parseDuration('5s'), 5000)
  assert.equal(parseDuration('5000ms'), 5000)
  assert.equal(parseDuration('0.5'), 500)
  assert.equal(parseDuration('2min'), 120000)
  assert.equal(parseDuration('0'), 0)
  assert.equal(parseDuration('abc'), null)
})

test('--captura fixa o tema claro; --tema vence', () => {
  assert.equal(parseFlags(['--captura=/tmp/x.png']).theme, 'light')
  assert.equal(
    parseFlags(['--captura=/tmp/x.png', '--tema=escuro']).theme,
    'dark'
  )
  assert.equal(
    parseFlags(['--captura=/tmp/x.png', '--tema=sistema']).theme,
    'system'
  )
  assert.equal(parseFlags([]).theme, null)
})

test('--captura-paleta e --captura-nova-aba escolhem a cena e também fixam o tema claro', () => {
  const palette = parseFlags([
    '--captura-paleta=/tmp/p.png',
    '--paleta-consulta=linear'
  ])
  assert.equal(palette.capturePath, '/tmp/p.png')
  assert.equal(palette.captureScene, 'palette')
  assert.equal(palette.paletteQuery, 'linear')
  assert.equal(palette.theme, 'light')

  const newTab = parseFlags(['--captura-nova-aba=/tmp/n.png', '--tema=escuro'])
  assert.equal(newTab.capturePath, '/tmp/n.png')
  assert.equal(newTab.captureScene, 'new-tab')
  assert.equal(newTab.theme, 'dark')

  const window = parseFlags(['--captura=/tmp/w.png'])
  assert.equal(window.captureScene, 'window')
  const none = parseFlags([])
  assert.equal(none.capturePath, null)
  assert.equal(none.paletteQuery, '')
})
