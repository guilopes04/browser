import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPaletteActions, isKnownCommand } from '@shared/commands'
import type { Space } from '@shared/types'

const spaces: Space[] = [
  { id: 'personal', name: 'Pessoal', color: 'indigo', favorites: [] },
  { id: 'work', name: 'Trabalho', color: 'amber', favorites: [] }
]

test('isKnownCommand aceita atalhos, comandos só da paleta e recusa o resto', () => {
  assert.equal(isKnownCommand('new-tab'), true)
  assert.equal(isKnownCommand('palette'), true)
  assert.equal(isKnownCommand('suspend-tab'), true)
  assert.equal(isKnownCommand('tab-9'), true)
  assert.equal(isKnownCommand('space-2'), true)
  assert.equal(isKnownCommand('rm-rf'), false)
  assert.equal(isKnownCommand(42), false)
})

test('ações: as mínimas, com atalho, e trocar só para os outros espaços', () => {
  const actions = getPaletteActions({
    spaces,
    currentSpaceId: 'personal',
    canReload: true,
    canSuspend: true,
    canReopen: false
  })
  assert.deepEqual(
    actions.map(action => [action.command, action.label, action.keys]),
    [
      ['new-tab', 'Nova aba', '⌘T'],
      ['close-tab', 'Fechar aba', '⌘W'],
      ['reload', 'Recarregar', '⌘R'],
      ['toggle-sidebar', 'Mostrar ou ocultar sidebar', '⌘S'],
      ['suspend-tab', 'Suspender aba', ''],
      ['space-2', 'Trocar para Trabalho', '⌃2']
    ]
  )
})

test('ações: sem página não recarrega nem suspende; reabrir só com aba fechada', () => {
  const actions = getPaletteActions({
    spaces,
    currentSpaceId: 'work',
    canReload: false,
    canSuspend: false,
    canReopen: true
  })
  assert.deepEqual(
    actions.map(action => action.command),
    ['new-tab', 'close-tab', 'reopen-tab', 'toggle-sidebar', 'space-1']
  )
})
