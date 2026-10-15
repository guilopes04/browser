import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getNextSidebarMode } from '../src/main/functions/get-next-sidebar-mode'

test('⌘S na janela larga: aberta <-> estilo escolhido', () => {
  assert.equal(getNextSidebarMode('open', 'hidden', 1440), 'hidden')
  assert.equal(getNextSidebarMode('hidden', 'hidden', 1440), 'open')
  assert.equal(getNextSidebarMode('open', 'compact', 1440), 'compact')
  assert.equal(getNextSidebarMode('compact', 'compact', 1440), 'open')
})

test('⌘S na janela estreita nunca vira um toque sem efeito', () => {
  // aberta já aparece compacta: o estilo compacto não mudaria nada, então oculta
  assert.equal(getNextSidebarMode('open', 'compact', 800), 'hidden')
  assert.equal(getNextSidebarMode('open', 'hidden', 800), 'hidden')
  // compacta gravada: abrir também continuaria compacta, então oculta
  assert.equal(getNextSidebarMode('compact', 'compact', 800), 'hidden')
  // oculta volta para aberta (mostrada como compacta)
  assert.equal(getNextSidebarMode('hidden', 'hidden', 800), 'open')
})
