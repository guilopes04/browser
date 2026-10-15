import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeFindSelection } from '@shared/find-selection'

test('a seleção vira uma linha só, sem espaços sobrando', () => {
  assert.equal(
    normalizeFindSelection('  uma\n\n  frase\tcom   quebras '),
    'uma frase com quebras'
  )
  assert.equal(normalizeFindSelection('\n \t'), '')
})

test('seleção longa é cortada em 200 caracteres', () => {
  assert.equal(normalizeFindSelection('a'.repeat(500)).length, 200)
})
