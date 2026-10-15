import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { EarlyKey } from '@shared/early-key'
import { fake } from './fake-window'

const nt = await import('../src/renderer/new-tab-state')

const key = (value: string, extra: Partial<EarlyKey> = {}): EarlyKey => ({
  key: value,
  alt: false,
  meta: false,
  shift: false,
  ...extra
})

function type(tabId: string, text: string): void {
  for (const char of Array.from(text)) nt.handleNewTabKey(tabId, key(char))
}

beforeEach(() => {
  fake.reset()
  nt.newTabDraft.value = null
})

test('as teclas repassadas formam o texto da aba, na ordem, antes de o campo existir', () => {
  type('t1', 'alpha.test/four')
  assert.equal(nt.getNewTabText('t1'), 'alpha.test/four')
  nt.handleNewTabKey('t1', key('Backspace'))
  nt.handleNewTabKey('t1', key('r'))
  assert.equal(nt.getNewTabText('t1'), 'alpha.test/four')
})

test('↵ repassado navega a aba do portão, mesmo que ela não seja a ativa na shell', () => {
  type('t2', 'segredo')
  nt.handleNewTabKey('t2', key('Enter'))
  assert.deepEqual(fake.sent, [
    { channel: 'tab:navigate', payload: { tabId: 't2', input: 'segredo' } }
  ])
})

test('↵ com o texto vazio ou só de espaços não navega', () => {
  nt.handleNewTabKey('t1', key('Enter'))
  type('t1', '  ')
  nt.handleNewTabKey('t1', key('Enter'))
  assert.deepEqual(fake.sent, [])
})

test('⌘↵ e ⌥↵ são da paleta; teclas sem texto não mudam nada', () => {
  type('t1', 'abc')
  nt.handleNewTabKey('t1', key('Enter', { meta: true }))
  nt.handleNewTabKey('t1', key('Enter', { alt: true }))
  nt.handleNewTabKey('t1', key('Tab'))
  nt.handleNewTabKey('t1', key('ArrowUp'))
  nt.handleNewTabKey('t1', key('Escape'))
  nt.handleNewTabKey('t1', key('v', { meta: true }))
  assert.deepEqual(fake.sent, [])
  assert.equal(nt.getNewTabText('t1'), 'abc')
})

test('o rascunho é de uma aba só: a Nova aba seguinte começa vazia', () => {
  type('t1', 'abc')
  assert.equal(nt.getNewTabText('t2'), '')
  type('t2', 'x')
  assert.equal(nt.getNewTabText('t1'), '')
  assert.equal(nt.getNewTabText('t2'), 'x')
})

test('caractere fora do plano básico conta como uma tecla', () => {
  type('t1', 'a𝒜')
  nt.handleNewTabKey('t1', key('Backspace'))
  assert.equal(nt.getNewTabText('t1'), 'a')
})
