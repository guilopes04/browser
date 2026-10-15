import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { PaletteSection } from '@shared/types'
import { fake } from './fake-window'

const state = await import('../src/renderer/palette-state')

function section(...titles: string[]): PaletteSection[] {
  return [
    {
      id: 'tabs',
      items: titles.map((title, index) => ({
        kind: 'tab' as const,
        tabId: `t${index}`,
        spaceId: 'personal',
        title,
        url: `https://${title}.test/`
      }))
    }
  ]
}

function titles(): string[] {
  return state.paletteItems.value.map(item =>
    item.kind === 'tab' ? item.title : item.kind
  )
}

beforeEach(() => {
  fake.reset()
  state.hidePalette()
  state.paletteScope.value = 'all'
})

test('showPalette (⌘K) abre com as seções que o main mandou, sem pedir consulta', () => {
  state.showPalette({ mode: 'search', text: '', sections: section('a', 'b') })
  assert.equal(state.paletteVisible.value, true)
  assert.equal(state.paletteSelected.value, 0)
  assert.equal(state.paletteTouched.value, true)
  assert.deepEqual(titles(), ['a', 'b'])
  assert.equal(fake.queries.length, 0)
})

test('showPalette (⌘L) mostra a URL intacta, sem linha escolhida, e ela não vira consulta', () => {
  state.showPalette({
    mode: 'address',
    text: 'https://a.test/',
    sections: section('a')
  })
  assert.equal(state.paletteText.value, 'https://a.test/')
  assert.equal(state.paletteTouched.value, false)
  assert.equal(state.paletteSelected.value, -1)
  // alternar o escopo antes de editar consulta o texto vazio
  state.togglePaletteScope()
  assert.deepEqual(fake.queries[0].req, { text: '', scope: 'current' })
  // a primeira edição passa a valer como consulta
  state.setPaletteText('b')
  assert.deepEqual(fake.queries[1].req, { text: 'b', scope: 'current' })
  assert.equal(state.paletteTouched.value, true)
})

test('sem seções (shell recarregada com a paleta aberta), a shell pede a consulta', () => {
  state.showPalette({ mode: 'search', text: 'lin' })
  assert.equal(fake.queries.length, 1)
  assert.deepEqual(fake.queries[0].req, { text: 'lin', scope: 'all' })
  assert.equal(state.paletteSections.value, null)
})

test('resposta fora de ordem não sobrescreve a mais nova', async () => {
  state.showPalette({ mode: 'search', text: '', sections: section('x') })
  state.setPaletteText('a')
  state.setPaletteText('ab')
  const [first, second] = fake.queries
  second.resolve(section('resposta de ab'))
  await Promise.resolve()
  first.resolve(section('resposta de a'))
  await Promise.resolve()
  assert.deepEqual(titles(), ['resposta de ab'])
  assert.equal(state.paletteResultText.value, 'ab')
})

test('hidePalette descarta a consulta em voo', async () => {
  state.showPalette({ mode: 'search', text: '', sections: section('x') })
  state.setPaletteText('a')
  state.hidePalette()
  fake.queries[0].resolve(section('tarde demais'))
  await Promise.resolve()
  assert.equal(state.paletteSections.value, null)
  assert.equal(state.paletteVisible.value, false)
})

test('whenResultsReady roda já com resultados atuais e espera pelos do texto novo', async () => {
  state.showPalette({ mode: 'search', text: '', sections: section('velho') })
  let seen: string[] | null = null
  state.whenResultsReady(items => {
    seen = items.map(item => (item.kind === 'tab' ? item.title : item.kind))
  })
  assert.deepEqual(seen, ['velho'])

  seen = null
  state.setPaletteText('novo')
  state.whenResultsReady(items => {
    seen = items.map(item => (item.kind === 'tab' ? item.title : item.kind))
  })
  // a consulta ainda não voltou: a lista velha não pode ser usada
  assert.equal(seen, null)
  fake.queries[0].resolve(section('novo'))
  await Promise.resolve()
  assert.deepEqual(seen, ['novo'])
})

test('digitar de novo cancela a ação que esperava a consulta anterior', async () => {
  state.showPalette({ mode: 'search', text: '', sections: section('x') })
  state.setPaletteText('a')
  let ran = false
  state.whenResultsReady(() => {
    ran = true
  })
  state.setPaletteText('ab')
  fake.queries[0].resolve(section('a'))
  fake.queries[1].resolve(section('ab'))
  await Promise.resolve()
  assert.equal(ran, false)
})

test('a linha escolhida volta para dentro da lista quando ela encolhe', async () => {
  state.showPalette({
    mode: 'search',
    text: '',
    sections: section('a', 'b', 'c', 'd')
  })
  state.movePaletteSelection(-1)
  assert.equal(state.paletteSelected.value, 3)
  state.setPaletteText('x')
  // setPaletteText volta para a primeira linha; escolher a última de novo antes da resposta
  state.paletteSelected.value = 3
  fake.queries[0].resolve(section('a', 'b'))
  await Promise.resolve()
  assert.equal(state.paletteSelected.value, 1)
})

test('movePaletteSelection dá a volta e, sem linha escolhida, ↓ vai à primeira e ↑ à última', () => {
  state.showPalette({
    mode: 'address',
    text: 'https://a.test/',
    sections: section('a', 'b', 'c')
  })
  assert.equal(state.paletteSelected.value, -1)
  state.movePaletteSelection(1)
  assert.equal(state.paletteSelected.value, 0)
  state.movePaletteSelection(-1)
  assert.equal(state.paletteSelected.value, 2)
  state.movePaletteSelection(1)
  assert.equal(state.paletteSelected.value, 0)
  state.paletteSelected.value = -1
  state.movePaletteSelection(-1)
  assert.equal(state.paletteSelected.value, 2)
})

test('closePalette só pede ao main; quem esconde é o palette:hide dele', () => {
  state.showPalette({ mode: 'search', text: '', sections: section('a') })
  state.closePalette()
  assert.deepEqual(fake.sent, [{ channel: 'palette:close', payload: {} }])
  assert.equal(state.paletteVisible.value, true)
})
