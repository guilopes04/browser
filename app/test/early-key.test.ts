import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyEarlyKeyToText,
  classifyEarlyKey,
  isSameTarget,
  type EarlyKey,
  type EarlyKeyInput
} from '@shared/early-key'

function input(key: string, extra: Partial<EarlyKeyInput> = {}): EarlyKeyInput {
  return {
    type: 'keyDown',
    key,
    meta: false,
    control: false,
    alt: false,
    shift: false,
    ...extra
  }
}

function forwarded(key: string, extra: Partial<EarlyKeyInput> = {}) {
  const action = classifyEarlyKey(input(key, extra))
  return action.kind === 'forward' ? action.key : null
}

test('classifyEarlyKey repassa letras, espaço e as teclas que a paleta usa', () => {
  assert.deepEqual(forwarded('l'), {
    key: 'l',
    alt: false,
    meta: false,
    shift: false
  })
  assert.equal(forwarded('L', { shift: true })?.key, 'L')
  assert.equal(forwarded(' ')?.key, ' ')
  // Option+c escreve "ç": a tecla já vem composta
  assert.equal(forwarded('ç', { alt: true })?.key, 'ç')
  // caractere fora do plano básico ocupa dois códigos e continua sendo uma tecla
  assert.equal(forwarded('𝒜')?.key, '𝒜')
  for (const key of [
    'Enter',
    'Escape',
    'Tab',
    'Backspace',
    'ArrowUp',
    'ArrowDown'
  ])
    assert.equal(forwarded(key)?.key, key)
})

test('classifyEarlyKey deixa passar atalhos, modificadores e soltar de tecla', () => {
  for (const action of [
    classifyEarlyKey(input('k', { meta: true })),
    classifyEarlyKey(input('t', { meta: true, shift: true })),
    classifyEarlyKey(input('Tab', { control: true })),
    classifyEarlyKey(input('a', { control: true })),
    classifyEarlyKey(input('a', { type: 'keyUp' })),
    classifyEarlyKey(input('Shift')),
    classifyEarlyKey(input('Meta', { meta: true })),
    classifyEarlyKey(input('F5'))
  ])
    assert.deepEqual(action, { kind: 'pass' })
})

test('classifyEarlyKey: composição e IME encerram o repasse', () => {
  assert.deepEqual(classifyEarlyKey(input('a', { isComposing: true })), {
    kind: 'compose'
  })
  assert.deepEqual(classifyEarlyKey(input('Process')), { kind: 'compose' })
  assert.deepEqual(classifyEarlyKey(input('Dead')), { kind: 'compose' })
})

test('classifyEarlyKey descarta as teclas que o texto repassado não modela', () => {
  for (const key of [
    'ArrowLeft',
    'ArrowRight',
    'Delete',
    'Home',
    'End',
    'PageUp',
    'PageDown'
  ])
    assert.deepEqual(classifyEarlyKey(input(key)), { kind: 'swallow' })
  // com ⌘ (⌘← é do sistema) e ⌃ seguem o caminho normal
  assert.deepEqual(classifyEarlyKey(input('ArrowLeft', { meta: true })), {
    kind: 'pass'
  })
  assert.deepEqual(classifyEarlyKey(input('ArrowLeft', { control: true })), {
    kind: 'pass'
  })
})

test('classifyEarlyKey: ⌘↵ e ⌥↵ seguem com o modificador', () => {
  assert.deepEqual(forwarded('Enter', { meta: true }), {
    key: 'Enter',
    alt: false,
    meta: true,
    shift: false
  })
  assert.equal(forwarded('Enter', { alt: true })?.alt, true)
})

test('isSameTarget compara o tipo e, na Nova aba, a aba', () => {
  assert.equal(isSameTarget({ kind: 'palette' }, { kind: 'palette' }), true)
  assert.equal(isSameTarget({ kind: 'find' }, { kind: 'find' }), true)
  assert.equal(isSameTarget({ kind: 'find' }, { kind: 'palette' }), false)
  assert.equal(
    isSameTarget(
      { kind: 'new-tab', tabId: 'a' },
      { kind: 'new-tab', tabId: 'a' }
    ),
    true
  )
  assert.equal(
    isSameTarget(
      { kind: 'new-tab', tabId: 'a' },
      { kind: 'new-tab', tabId: 'b' }
    ),
    false
  )
  assert.equal(
    isSameTarget({ kind: 'palette' }, { kind: 'new-tab', tabId: 'a' }),
    false
  )
})

test('applyEarlyKeyToText: caracteres entram no fim e Backspace apaga o último', () => {
  const key = (value: string, extra: Partial<EarlyKey> = {}): EarlyKey => ({
    key: value,
    alt: false,
    meta: false,
    shift: false,
    ...extra
  })
  assert.equal(applyEarlyKeyToText('alph', key('a')), 'alpha')
  assert.equal(applyEarlyKeyToText('a', key('𝒜')), 'a𝒜')
  assert.equal(applyEarlyKeyToText('a𝒜', key('Backspace')), 'a')
  assert.equal(applyEarlyKeyToText('', key('Backspace')), '')
  assert.equal(applyEarlyKeyToText('ab', key('Enter')), null)
  assert.equal(applyEarlyKeyToText('ab', key('Tab')), null)
  assert.equal(applyEarlyKeyToText('ab', key('v', { meta: true })), null)
})
