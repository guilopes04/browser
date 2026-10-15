import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EarlyKey } from '@shared/early-key'
import { readFindEarlyKey } from '@shared/find-early-key'

function key(name: string, extra: Partial<EarlyKey> = {}): EarlyKey {
  return { key: name, alt: false, meta: false, shift: false, ...extra }
}

test('caracteres entram no fim do texto, com acento e espaço', () => {
  assert.deepEqual(readFindEarlyKey('ca', key('f')), {
    kind: 'text',
    text: 'caf'
  })
  assert.deepEqual(readFindEarlyKey('caf', key('é', { alt: true })), {
    kind: 'text',
    text: 'café'
  })
  assert.deepEqual(readFindEarlyKey('a', key(' ')), {
    kind: 'text',
    text: 'a '
  })
})

test('Backspace apaga o último caractere', () => {
  assert.deepEqual(readFindEarlyKey('abc', key('Backspace')), {
    kind: 'text',
    text: 'ab'
  })
  assert.deepEqual(readFindEarlyKey('', key('Backspace')), {
    kind: 'text',
    text: ''
  })
})

test('↵ anda para o próximo e ⇧↵ para o anterior; ⌘↵ não é da barra', () => {
  assert.deepEqual(readFindEarlyKey('a', key('Enter')), {
    kind: 'step',
    forward: true
  })
  assert.deepEqual(readFindEarlyKey('a', key('Enter', { shift: true })), {
    kind: 'step',
    forward: false
  })
  assert.deepEqual(readFindEarlyKey('a', key('Enter', { meta: true })), {
    kind: 'ignore'
  })
})

test('esc fecha; setas, ⇥ e atalhos de ⌘ são ignorados', () => {
  assert.deepEqual(readFindEarlyKey('a', key('Escape')), { kind: 'close' })
  for (const name of ['ArrowUp', 'ArrowDown', 'Tab'])
    assert.deepEqual(readFindEarlyKey('a', key(name)), { kind: 'ignore' })
  assert.deepEqual(readFindEarlyKey('a', key('c', { meta: true })), {
    kind: 'ignore'
  })
})
