import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getFavoriteTileColor, getTileLetter } from '@shared/tile-appearance'
import { createDefaultSpaces } from '../src/main/store/default-spaces'

test('letra do tile: nome do site, senão o título', () => {
  assert.equal(getTileLetter('', 'https://github.com/electron'), 'G')
  assert.equal(getTileLetter('', 'http://127.0.0.1:3000/'), '1')
  assert.equal(getTileLetter('ótimo', ''), 'Ó')
})

test('aba de um site favorito usa o tile do favorito', () => {
  const spaces = createDefaultSpaces()
  assert.equal(
    getFavoriteTileColor(spaces, 'https://www.electronjs.org/docs/latest'),
    '#4352C4'
  )
  assert.equal(
    getFavoriteTileColor(spaces, 'https://docs.github.com/x'),
    '#3D4452'
  )
  assert.equal(
    getFavoriteTileColor(spaces, 'https://calendar.google.com/'),
    '#4352C4'
  )
  // google.com não é favorito: só mail. e calendar. são
  assert.equal(
    getFavoriteTileColor(spaces, 'https://www.google.com/search'),
    null
  )
  assert.equal(getFavoriteTileColor(spaces, ''), null)
})
