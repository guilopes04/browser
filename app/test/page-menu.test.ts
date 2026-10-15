import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  describePageMenu,
  shortenSelection,
  type PageMenuEntry,
  type PageMenuInput
} from '../src/main/functions/describe-page-menu'

const BASE: PageMenuInput = {
  linkURL: '',
  srcURL: '',
  mediaType: 'none',
  selectionText: '',
  isEditable: false,
  editFlags: {
    canCut: false,
    canCopy: false,
    canPaste: false,
    canSelectAll: true
  },
  canGoBack: false,
  canGoForward: false,
  dev: false
}

const labels = (entries: PageMenuEntry[]) =>
  entries.map(entry => (entry.kind === 'separator' ? '---' : entry.label))

const enabled = (entries: PageMenuEntry[], label: string) => {
  const found = entries.find(e => e.kind === 'item' && e.label === label)
  return found?.kind === 'item' ? found.enabled : undefined
}

test('página sem nada sob o ponteiro: Voltar, Avançar, Recarregar', () => {
  const entries = describePageMenu({ ...BASE, canGoBack: true })
  assert.deepEqual(labels(entries), ['Voltar', 'Avançar', 'Recarregar'])
  assert.equal(enabled(entries, 'Voltar'), true)
  assert.equal(enabled(entries, 'Avançar'), false)
})

test('link: abrir em nova aba e copiar; sem Voltar/Avançar', () => {
  const entries = describePageMenu({ ...BASE, linkURL: 'https://a.com/x' })
  assert.deepEqual(labels(entries), ['Abrir link em nova aba', 'Copiar link'])
  assert.equal(enabled(entries, 'Abrir link em nova aba'), true)
})

test('link que não é http não abre aba (javascript:, mailto:) mas copia', () => {
  const entries = describePageMenu({ ...BASE, linkURL: 'javascript:alert(1)' })
  assert.equal(enabled(entries, 'Abrir link em nova aba'), false)
  assert.equal(enabled(entries, 'Copiar link'), true)
})

test('imagem: abrir, copiar e salvar como', () => {
  const entries = describePageMenu({
    ...BASE,
    mediaType: 'image',
    srcURL: 'https://a.com/i.png'
  })
  assert.deepEqual(labels(entries), [
    'Abrir imagem em nova aba',
    'Copiar imagem',
    'Salvar imagem como…'
  ])
  const blob = describePageMenu({
    ...BASE,
    mediaType: 'image',
    srcURL: 'blob:x'
  })
  assert.equal(enabled(blob, 'Abrir imagem em nova aba'), false)
})

test('imagem dentro de link mostra os dois grupos separados', () => {
  const entries = describePageMenu({
    ...BASE,
    linkURL: 'https://a.com/',
    mediaType: 'image',
    srcURL: 'https://a.com/i.png'
  })
  assert.deepEqual(labels(entries), [
    'Abrir link em nova aba',
    'Copiar link',
    '---',
    'Abrir imagem em nova aba',
    'Copiar imagem',
    'Salvar imagem como…'
  ])
})

test('texto selecionado: Copiar e Buscar "seleção" na web', () => {
  const entries = describePageMenu({
    ...BASE,
    selectionText: 'navegador leve',
    editFlags: { ...BASE.editFlags, canCopy: true }
  })
  assert.deepEqual(labels(entries), [
    'Copiar',
    'Buscar "navegador leve" na web'
  ])
})

test('link ou imagem com a palavra auto-selecionada não ganham Copiar nem busca', () => {
  const link = describePageMenu({
    ...BASE,
    linkURL: 'https://a.com/',
    selectionText: 'Um link',
    editFlags: { ...BASE.editFlags, canCopy: true }
  })
  assert.deepEqual(labels(link), ['Abrir link em nova aba', 'Copiar link'])
  const image = describePageMenu({
    ...BASE,
    mediaType: 'image',
    srcURL: 'https://a.com/i.png',
    selectionText: 'legenda'
  })
  assert.ok(!labels(image).some(label => label.startsWith('Buscar')))
})

test('seleção longa é resumida no rótulo', () => {
  const text = 'palavra '.repeat(20)
  const label = shortenSelection(text)
  assert.ok(label.length <= 29)
  assert.ok(label.endsWith('…'))
  assert.equal(shortenSelection('  a\n b  '), 'a b')
})

test('campo editável: Recortar, Copiar, Colar e Selecionar tudo seguem editFlags', () => {
  const entries = describePageMenu({
    ...BASE,
    isEditable: true,
    editFlags: {
      canCut: false,
      canCopy: false,
      canPaste: true,
      canSelectAll: true
    }
  })
  assert.deepEqual(labels(entries), [
    'Recortar',
    'Copiar',
    'Colar',
    'Selecionar tudo'
  ])
  assert.equal(enabled(entries, 'Recortar'), false)
  assert.equal(enabled(entries, 'Colar'), true)
})

test('Inspecionar elemento só com --dev', () => {
  assert.ok(!labels(describePageMenu(BASE)).includes('Inspecionar elemento'))
  const dev = labels(describePageMenu({ ...BASE, dev: true }))
  assert.equal(dev[dev.length - 1], 'Inspecionar elemento')
  assert.equal(dev[dev.length - 2], '---')
})
