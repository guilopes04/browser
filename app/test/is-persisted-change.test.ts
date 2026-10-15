import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPersistedChange } from '../src/main/store/is-persisted-change'

test('só o que o session.json guarda dispara a gravação', () => {
  const tab = (patch: object) => ({ kind: 'tab' as const, tabId: 't', patch })
  assert.equal(isPersistedChange({ kind: 'structure' }), true)
  assert.equal(isPersistedChange({ kind: 'dirty' }), true)
  assert.equal(isPersistedChange(tab({ url: 'https://a.com' })), true)
  assert.equal(isPersistedChange(tab({ title: 'A', loading: false })), true)
  assert.equal(isPersistedChange(tab({ favicon: 'data:x' })), true)
  assert.equal(isPersistedChange(tab({ muted: true })), true)
  // não vão para o arquivo
  assert.equal(isPersistedChange(tab({ loading: true })), false)
  assert.equal(
    isPersistedChange(tab({ canGoBack: true, canGoForward: false })),
    false
  )
  assert.equal(isPersistedChange(tab({ audible: true })), false)
  assert.equal(isPersistedChange(tab({ dormant: true })), false)
  assert.equal(
    isPersistedChange(tab({ error: { code: -105, description: 'x' } })),
    false
  )
  assert.equal(isPersistedChange({ kind: 'view' }), false)
})
