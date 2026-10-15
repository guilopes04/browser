import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTabShortcutLabel } from '../src/renderer/tab-shortcut'

test('⌘1 a ⌘8 são as oito primeiras e ⌘9 é a última', () => {
  assert.equal(getTabShortcutLabel(0, 3), '⌘1')
  assert.equal(getTabShortcutLabel(1, 3), '⌘2')
  assert.equal(getTabShortcutLabel(7, 8), '⌘8')
  assert.equal(getTabShortcutLabel(10, 12), undefined)
  assert.equal(getTabShortcutLabel(11, 12), '⌘9')
})
