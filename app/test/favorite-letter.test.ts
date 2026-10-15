import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getFavoriteLetter } from '../src/renderer/favorite-letter'

test('getFavoriteLetter: a 1ª do título, ou a do site quando o título só o cita', () => {
  assert.equal(
    getFavoriteLetter('Calendário', 'https://calendar.google.com/'),
    'C'
  )
  assert.equal(getFavoriteLetter('GitHub', 'https://github.com/'), 'G')
  assert.equal(
    getFavoriteLetter('Electron', 'https://www.electronjs.org/'),
    'E'
  )
  assert.equal(getFavoriteLetter('Linear', 'https://linear.app/'), 'L')
  // PaletaVazia/Paleta.dc.html: "Roadmap no Linear" tem o bloco "L"
  assert.equal(
    getFavoriteLetter('Roadmap no Linear', 'https://linear.app/roadmap'),
    'L'
  )
  assert.equal(
    getFavoriteLetter('Roadmap interno', 'https://linear.app/roadmap'),
    'R'
  )
  // sem endereço (nome do espaço, por exemplo) vale o título
  assert.equal(getFavoriteLetter('Trabalho'), 'T')
  assert.equal(getFavoriteLetter('  '), '?')
})
