import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clipboard, type WebContents } from 'electron'
import { runPageMenuAction } from '../src/main/actions/run-page-menu-action'
import { fakeContext, fakeContents } from './fake-main'

function setup() {
  const env = fakeContext(['https://a.com'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const calls: string[] = []
  const wc = Object.assign(fakeContents('https://a.com/'), {
    navigationHistory: {
      canGoBack: () => true,
      canGoForward: () => false,
      goBack: () => void calls.push('goBack'),
      goForward: () => void calls.push('goForward')
    },
    copy: () => void calls.push('copy'),
    cut: () => void calls.push('cut'),
    paste: () => void calls.push('paste'),
    selectAll: () => void calls.push('selectAll'),
    reload: () => void calls.push('reload'),
    copyImageAt: (x: number, y: number) =>
      void calls.push(`copyImageAt ${x},${y}`),
    downloadURL: (url: string) => void calls.push(`downloadURL ${url}`),
    inspectElement: (x: number, y: number) =>
      void calls.push(`inspect ${x},${y}`)
  })
  const params = {
    x: 10,
    y: 20,
    linkURL: 'https://destino.com/pagina',
    srcURL: 'https://a.com/img.png',
    selectionText: '  navegador leve  '
  }
  const run = (action: Parameters<typeof runPageMenuAction>[4]) =>
    runPageMenuAction(
      env.ctx,
      tab.id,
      wc as unknown as WebContents,
      params,
      action
    )
  return { ...env, tab, calls, run }
}

test('abrir link ou imagem cria uma aba no mesmo espaço e a ativa', () => {
  const { store, tab, run } = setup()
  run('open-link')
  const [opened] = store.getTabsOfSpace(tab.spaceId)
  assert.equal(opened.url, 'https://destino.com/pagina')
  assert.equal(store.getActiveTabId(), opened.id)
  run('open-image')
  assert.equal(
    store.getTabsOfSpace(tab.spaceId)[0].url,
    'https://a.com/img.png'
  )
})

test('buscar na web usa o buscador das configurações com o texto codificado', () => {
  const { store, tab, run } = setup()
  run('search-web')
  const [opened] = store.getTabsOfSpace(tab.spaceId)
  const expected = store.state.settings.searchUrl.replace(
    '%s',
    encodeURIComponent('navegador leve')
  )
  assert.equal(opened.url, expected)
})

test('copiar link vai para a área de transferência', () => {
  const { run } = setup()
  const written: string[] = []
  ;(clipboard as any).writeText = (text: string) => void written.push(text)
  run('copy-link')
  assert.deepEqual(written, ['https://destino.com/pagina'])
})

test('edição, navegação, imagem e inspeção chamam o webContents certo', () => {
  const { calls, ctx, run } = setup()
  for (const action of [
    'cut',
    'copy',
    'paste',
    'select-all',
    'back',
    'reload',
    'copy-image',
    'inspect'
  ] as const)
    run(action)
  assert.deepEqual(calls, [
    'cut',
    'copy',
    'paste',
    'selectAll',
    'goBack',
    'reload',
    'copyImageAt 10,20',
    'inspect 10,20'
  ])
  // sem avançar disponível, avançar não faz nada
  run('forward')
  assert.ok(!calls.includes('goForward'))
  assert.equal(ctx.saveAs.size, 0)
})

test('Salvar imagem como marca o endereço para o diálogo de salvar e baixa', () => {
  const { ctx, calls, run } = setup()
  run('save-image')
  assert.ok(ctx.saveAs.has('https://a.com/img.png'))
  assert.deepEqual(calls, ['downloadURL https://a.com/img.png'])
})

test('o menu aberto numa aba que sumiu não faz nada', () => {
  const { store, tab, calls, run } = setup()
  store.removeTab(tab.id)
  run('copy')
  assert.deepEqual(calls, [])
})
