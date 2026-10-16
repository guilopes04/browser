import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import {
  describeLoadError,
  LOCAL_FILE_ERROR
} from '@shared/describe-load-error'
import { isLocalFileUrl } from '@shared/is-local-file-url'
import { resolveInput, resolveTyped } from '@shared/resolve-input'
import { focusAddress } from '../src/main/actions/focus-address'
import { navigateTab } from '../src/main/actions/navigate-tab'
import { wakeTab } from '../src/main/actions/wake-tab'
import { runPageMenuAction } from '../src/main/actions/run-page-menu-action'
import {
  describePageMenu,
  isSavableImage
} from '../src/main/functions/describe-page-menu'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import { guardTabNavigation } from '../src/main/functions/guard-tab-navigation'
import { isBlockedNavigation } from '../src/main/functions/is-blocked-navigation'
import { markGesture } from '../src/main/functions/user-gesture'
import { installWindowOpenHandler } from '../src/main/functions/window-open'
import { buildInitialState } from '../src/main/store/build-initial-state'
import { hydrateTab } from '../src/main/store/hydrate-tab'
import { sanitizeClosed } from '../src/main/store/sanitize-closed'
import { fakeContext } from './fake-main'

const SEARCH = 'https://www.google.com/search?q=%s'

test('isLocalFileUrl: file:// em qualquer caixa e view-source:file://', () => {
  assert.equal(isLocalFileUrl('file:///etc/senhas-do-sistema'), true)
  assert.equal(isLocalFileUrl('FILE:///Users/x/a.html'), true)
  assert.equal(isLocalFileUrl('file://localhost/etc/hosts'), true)
  assert.equal(isLocalFileUrl('view-source:file:///etc/hosts'), true)
  assert.equal(isLocalFileUrl('https://a.com/file:///x'), false)
  assert.equal(isLocalFileUrl('about:blank'), false)
  assert.equal(isLocalFileUrl('texto solto'), false)
  assert.equal(isLocalFileUrl(''), false)
})

test('resolve-input recusa file:// (nada é aberto nem pesquisado)', () => {
  for (const text of [
    'file:///etc/senhas-do-sistema',
    '  FILE:///Users/gilas/a.html ',
    'file://localhost/etc/hosts',
    'view-source:file:///etc/hosts'
  ]) {
    assert.deepEqual(resolveTyped(text, SEARCH), {
      url: '',
      httpFallback: null,
      refused: 'local-file'
    })
    assert.equal(resolveInput(text, SEARCH), '')
  }
  // texto comum que só parece: vai para a busca, como antes
  assert.ok(
    resolveInput('file: formatos de áudio', SEARCH).startsWith(
      SEARCH.slice(0, 28)
    )
  )
  assert.equal(resolveTyped('example.com', SEARCH).refused, undefined)
})

test('a página de erro de arquivo local fala português e não oferece "tentar de novo"', () => {
  const text = describeLoadError(LOCAL_FILE_ERROR.code, '')
  assert.equal(text.title, 'Arquivos locais não são abertos nesta versão')
  assert.equal(text.kind, 'problem')
  assert.equal(text.retry, false)
  assert.equal(describeLoadError(-105, 'a.com').retry, undefined)
  // o código do app não colide com os do Chromium (-1 a -999)
  assert.ok(LOCAL_FILE_ERROR.code < -999)
  // pedido cancelado pelo app: página pública querendo a rede local
  const blocked = describeLoadError(-20, '192.168.0.1')
  assert.equal(blocked.title, 'Acesso à rede local bloqueado')
  assert.ok(blocked.body.includes('192.168.0.1'))
})

test('barra de endereço com file:// mostra o erro na aba e não carrega nada', () => {
  const { ctx, store, makeLive } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  const live = makeLive(tab, 'https://a.com/')
  const loaded: string[] = []
  ;(live.wc as unknown as { loadURL: (url: string) => Promise<void> }).loadURL =
    async url => void loaded.push(url)
  ctx.attached.tabId = tab.id

  navigateTab(ctx, tab.id, 'file:///etc/senhas-do-sistema')

  assert.deepEqual(loaded, [])
  const after = store.getTab(tab.id)
  assert.deepEqual(after?.error, { ...LOCAL_FILE_ERROR })
  assert.equal(
    after?.url,
    'https://a.com',
    'a página que estava continua por baixo'
  )
  assert.equal(after?.favicon, null)

  // a próxima navegação de verdade sai do erro quando a página carrega (did-navigate); aqui só
  // confirma que um endereço normal segue carregando
  navigateTab(ctx, tab.id, 'example.com')
  assert.deepEqual(loaded, ['https://example.com'])
})

test('Nova aba com file:// vira erro, sem url, e a próxima navegação limpa o erro', () => {
  const { ctx, store } = fakeContext()
  const tab = store.getActiveTab() as NonNullable<
    ReturnType<typeof store.getActiveTab>
  >
  assert.equal(tab.url, '')

  navigateTab(ctx, tab.id, 'file:///Users/x/a.html')
  const failed = store.getTab(tab.id)
  assert.equal(failed?.url, '')
  assert.deepEqual(failed?.error, { ...LOCAL_FILE_ERROR })
  assert.equal(failed?.dormant, false)

  navigateTab(ctx, tab.id, 'example.com')
  const next = store.getTab(tab.id)
  assert.equal(next?.url, 'https://example.com')
  assert.equal(next?.error, null)
})

test('aba com file:// no session.json acorda como erro, sem loadURL', () => {
  const { ctx, store } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  store.patchTab(tab.id, {
    url: 'file:///etc/senhas-do-sistema',
    dormant: true
  })

  const view = wakeTab(ctx, tab.id)

  assert.equal(view, null)
  assert.equal(ctx.views.has(tab.id), false, 'nenhuma view foi criada')
  const after = store.getTab(tab.id)
  assert.equal(after?.url, '')
  assert.deepEqual(after?.error, { ...LOCAL_FILE_ERROR })
})

test('sessão antiga: file:// volta como Nova aba e sai da pilha do ⇧⌘T', () => {
  const tab = hydrateTab({
    id: 't',
    spaceId: 'personal',
    url: 'file:///etc/senhas-do-sistema',
    title: 'senhas-do-sistema',
    favicon: null,
    muted: false,
    lastActiveAt: 1
  })
  assert.equal(tab.url, '')
  assert.equal(tab.dormant, false)

  const closed = sanitizeClosed([
    { spaceId: 'personal', url: 'file:///etc/hosts', title: 'x' },
    { spaceId: 'personal', url: 'https://a.com/', title: 'A\u202Eb' },
    { spaceId: 1, url: 'https://b.com', title: 'x' },
    null,
    'texto'
  ])
  assert.deepEqual(closed, [
    { spaceId: 'personal', url: 'https://a.com/', title: 'A b' }
  ])
  assert.deepEqual(sanitizeClosed(undefined), [])

  const { closed: restored } = buildInitialState({
    theme: 'light',
    session: {
      version: 1,
      spaces: [
        { id: 'personal', name: 'Pessoal', color: 'indigo', favorites: [] }
      ],
      window: {
        spaceId: 'personal',
        activeTabBySpace: {},
        sidebar: 'open',
        bounds: { x: 0, y: 0, width: 1000, height: 700 }
      },
      settings: {} as never,
      tabs: [],
      closed: [{ spaceId: 'personal', url: 'file:///x', title: 'x' }]
    },
    tabsFile: null,
    bounds: { x: 0, y: 0, width: 1000, height: 700 }
  })
  assert.deepEqual(restored, [])
})

test('isBlockedNavigation: file:// e a interface do app', () => {
  assert.equal(isBlockedNavigation('file:///etc/senhas-do-sistema'), true)
  assert.equal(isBlockedNavigation('app://shell/index.html'), true)
  assert.equal(isBlockedNavigation('APP://shell/'), true)
  assert.equal(isBlockedNavigation('https://example.com/'), false)
  assert.equal(isBlockedNavigation('about:blank'), false)
})

test('will-navigate, will-redirect e will-frame-navigate cancelam file:// e app://', () => {
  const { makeLive, store } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  const live = makeLive(tab)
  guardTabNavigation(live.wc as unknown as WebContents)

  for (const event of [
    'will-navigate',
    'will-redirect',
    'will-frame-navigate'
  ]) {
    for (const [url, blocked] of [
      ['file:///etc/senhas-do-sistema', true],
      ['app://shell/index.html', true],
      ['view-source:file:///etc/hosts', true],
      ['https://example.com/', false],
      ['http://localhost:3000/', false]
    ] as const) {
      let prevented = false
      live.wc.emit(event, { url, preventDefault: () => (prevented = true) })
      assert.equal(prevented, blocked, `${event} ${url}`)
    }
  }
})

test('window.open e target=_blank só abrem http, https, about:blank e blob', () => {
  const { ctx, store, makeLive } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  let handler:
    | ((details: { url: string; disposition: string }) => { action: string })
    | null = null
  const wc = {
    setWindowOpenHandler: (fn: typeof handler) => void (handler = fn)
  }
  makeLive(tab)
  installWindowOpenHandler(
    ctx,
    'personal',
    tab.id,
    wc as unknown as WebContents
  )
  // o bloqueador de pop-ups só deixa abrir com gesto recente: aqui o gesto existe, o que se
  // confere é o esquema da URL
  markGesture(ctx.guard, tab.id)
  const decide = (url: string) =>
    (handler as NonNullable<typeof handler>)({
      url,
      disposition: 'foreground-tab'
    }).action
  assert.equal(decide('file:///etc/senhas-do-sistema'), 'deny')
  assert.equal(decide('app://shell/index.html'), 'deny')
  assert.equal(decide('javascript:alert(1)'), 'deny')
  assert.equal(decide('https://example.com/'), 'allow')
  assert.equal(decide('about:blank'), 'allow')
})

test('"Salvar imagem como" só vale para o que uma página carrega (nada de file://)', () => {
  assert.equal(isSavableImage('https://a.com/i.png'), true)
  assert.equal(isSavableImage('data:image/png;base64,AAAA'), true)
  assert.equal(isSavableImage('blob:https://a.com/x'), true)
  assert.equal(isSavableImage('file:///Users/x/segredo.png'), false)
  assert.equal(isSavableImage(''), false)

  const entries = describePageMenu({
    linkURL: '',
    srcURL: 'file:///etc/senhas-do-sistema',
    mediaType: 'image',
    selectionText: '',
    isEditable: false,
    editFlags: {
      canCut: false,
      canCopy: false,
      canPaste: false,
      canSelectAll: false
    },
    canGoBack: false,
    canGoForward: false,
    dev: false
  })
  const save = entries.find(e => e.kind === 'item' && e.action === 'save-image')
  assert.equal(save?.kind === 'item' && save.enabled, false)

  // mesmo se a escolha chegasse, o download não começa
  const { ctx, store } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  const downloads: string[] = []
  const wc = {
    isDestroyed: () => false,
    downloadURL: (url: string) => void downloads.push(url)
  }
  runPageMenuAction(
    ctx,
    tab.id,
    wc as unknown as WebContents,
    {
      x: 0,
      y: 0,
      linkURL: '',
      srcURL: 'file:///etc/senhas-do-sistema',
      selectionText: ''
    },
    'save-image'
  )
  assert.deepEqual(downloads, [])
  assert.equal(ctx.saveAs.size, 0)
})

test('⌘L numa Nova aba com a página de erro (file://) abre a paleta, não o campo que não existe', () => {
  const { ctx, store, sent } = fakeContext()
  const tab = store.getActiveTab() as NonNullable<
    ReturnType<typeof store.getActiveTab>
  >
  focusAddress(ctx)
  assert.deepEqual(
    sent.filter(item => item.channel === 'address:focus').length,
    1,
    'Nova aba normal foca o campo dela'
  )
  navigateTab(ctx, tab.id, 'file:///etc/hosts')
  sent.length = 0
  focusAddress(ctx)
  assert.equal(sent.filter(item => item.channel === 'address:focus').length, 0)
  assert.equal(sent.filter(item => item.channel === 'palette:show').length, 1)
  assert.ok(store.state.overlay.includes('palette'))
})

test('a página volta depois do erro de arquivo local: o título dela volta à aba', () => {
  const { ctx, store, makeLive } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  const live = makeLive(tab, 'https://a.com/')
  ;(live.wc as any).navigationHistory = {
    canGoBack: () => false,
    canGoForward: () => false
  }
  attachTabEvents(ctx, tab.id, live.wc as unknown as WebContents)
  ctx.attached.tabId = tab.id
  live.wc.title = 'Página A'
  store.patchTab(tab.id, { title: 'Página A' })

  navigateTab(ctx, tab.id, 'file:///etc/hosts')
  assert.equal(store.getTab(tab.id)?.title, 'Arquivo local')

  // ⌘R: did-navigate sem novo evento de título (o título é o mesmo)
  live.wc.emit('did-navigate')
  assert.equal(store.getTab(tab.id)?.error, null)
  assert.equal(store.getTab(tab.id)?.title, 'Página A')
})
