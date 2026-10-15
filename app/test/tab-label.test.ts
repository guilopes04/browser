import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTabLabel } from '@shared/tab-label'

test('rótulo da aba: título, hostname ou Nova aba', () => {
  assert.equal(
    getTabLabel('WebContentsView | Electron', 'https://x.com'),
    'WebContentsView | Electron'
  )
  assert.equal(
    getTabLabel('', 'https://www.apple.com/br/macbook-air/'),
    'apple.com'
  )
  assert.equal(getTabLabel('', ''), 'Nova aba')
})
