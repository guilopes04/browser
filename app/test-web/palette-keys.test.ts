import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { PaletteSection } from '@shared/types'
import { fake } from './fake-window'

const state = await import('../src/renderer/palette-state')
const { handleKey } =
  await import('../src/renderer/components/palette/use-palette-keys')
const { snapshot } = await import('../src/renderer/state')

function keyEvent(key: string, extra: Record<string, boolean> = {}) {
  return {
    key,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    preventDefault() {},
    ...extra
  }
}

// o que o main repassa: o campo não recebe a tecla por conta própria
const forwarded = (key: string, extra: Record<string, boolean> = {}) =>
  handleKey(keyEvent(key, extra), true)

function open(mode: 'search' | 'address', text = ''): void {
  const sections: PaletteSection[] = [
    {
      id: 'tabs',
      items: [
        {
          kind: 'tab',
          tabId: 't0',
          spaceId: 'personal',
          title: 'A',
          url: 'https://a.test/'
        },
        {
          kind: 'tab',
          tabId: 't1',
          spaceId: 'personal',
          title: 'B',
          url: 'https://b.test/'
        }
      ]
    }
  ]
  state.showPalette({ mode, text, sections })
}

beforeEach(() => {
  fake.reset()
  state.hidePalette()
  state.paletteScope.value = 'all'
})

test('teclas repassadas viram o texto da busca, na ordem, e Backspace apaga o último', () => {
  open('search')
  for (const char of 'linear') forwarded(char)
  assert.equal(state.paletteText.value, 'linear')
  forwarded('Backspace')
  assert.equal(state.paletteText.value, 'linea')
  // uma consulta por tecla, cada uma com o texto do momento
  assert.deepEqual(
    fake.queries.map(query => query.req.text),
    ['l', 'li', 'lin', 'line', 'linea', 'linear', 'linea']
  )
})

test('⌥ repassado ainda escreve o caractere composto; ⌘ e ⌃ não escrevem', () => {
  open('search')
  forwarded('ç', { altKey: true })
  forwarded('k', { metaKey: true })
  forwarded('k', { ctrlKey: true })
  assert.equal(state.paletteText.value, 'ç')
})

test('no modo endereço, a primeira tecla repassada substitui a URL intacta', () => {
  open('address', 'https://a.test/')
  forwarded('b')
  forwarded('e')
  assert.equal(state.paletteText.value, 'be')
  assert.equal(state.paletteTouched.value, true)
})

test('no modo endereço, Backspace sobre a URL intacta a apaga', () => {
  open('address', 'https://a.test/')
  forwarded('Backspace')
  assert.equal(state.paletteText.value, '')
})

test('↑↓ repassados movem a linha e esc pede o fechamento', () => {
  open('search')
  forwarded('ArrowDown')
  assert.equal(state.paletteSelected.value, 1)
  forwarded('ArrowDown')
  assert.equal(state.paletteSelected.value, 0)
  forwarded('ArrowUp')
  assert.equal(state.paletteSelected.value, 1)
  forwarded('Escape')
  assert.deepEqual(fake.sent, [{ channel: 'palette:close', payload: {} }])
})

test('↵ repassado abre a linha escolhida (e fecha a paleta)', () => {
  open('search')
  forwarded('ArrowDown')
  forwarded('Enter')
  assert.deepEqual(fake.sent, [
    { channel: 'tab:activate', payload: { tabId: 't1' } },
    { channel: 'palette:close', payload: {} }
  ])
})

test('↵ no modo endereço, sem linha escolhida, navega a aba ativa com o texto digitado', () => {
  snapshot.value = {
    window: { spaceId: 'personal', activeTabBySpace: { personal: 'k1' } },
    tabs: [{ id: 'k1', spaceId: 'personal', url: 'http://keylog.test/' }]
  } as any
  open('address', 'http://keylog.test/')
  for (const char of 'alpha.test') forwarded(char)
  forwarded('Enter')
  assert.deepEqual(fake.sent, [
    { channel: 'tab:navigate', payload: { tabId: 'k1', input: 'alpha.test' } },
    { channel: 'palette:close', payload: {} }
  ])
  snapshot.value = null
})

test('⇥ só alterna o escopo quando há consulta', () => {
  open('search')
  forwarded('Tab')
  assert.equal(state.paletteScope.value, 'all')
  forwarded('a')
  forwarded('Tab')
  assert.equal(state.paletteScope.value, 'current')
  forwarded('Tab')
  assert.equal(state.paletteScope.value, 'all')
})

test('tecla nativa com o foco fora do campo devolve o foco a ele antes de agir', () => {
  open('search')
  fake.input = {
    focus() {
      fake.focused++
    }
  }
  handleKey(keyEvent('a'), false)
  assert.equal(fake.focused, 1)
  // ⌘ não rouba o foco: é atalho
  handleKey(keyEvent('Enter', { metaKey: true }), false)
  assert.equal(fake.focused, 1)
})
