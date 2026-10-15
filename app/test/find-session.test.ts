// A busca na página no main, com o contexto falso: a página nova, a página de erro, a paleta, a
// seleção que chega tarde, o mouse na margem da barra e a barra já destruída.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents, WebContentsView } from 'electron'
import {
  applyFindResult,
  beginFindRequest,
  createFindState,
  typeFindText
} from '@shared/find-state'
import type { FindPointer } from '@shared/find-pointer'
import { closeFind } from '../src/main/actions/close-find'
import { openFind } from '../src/main/actions/open-find'
import { passFindPointer } from '../src/main/actions/pass-find-pointer'
import { setFindText } from '../src/main/actions/set-find-text'
import type { FindSession } from '../src/main/context'
import { applyFindHighlight } from '../src/main/functions/apply-find-highlight'
import { attachFindEvents } from '../src/main/functions/attach-find-events'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import { layoutFind } from '../src/main/functions/layout-find'
import { pushFindState } from '../src/main/functions/push-find-state'
import { fakeContext } from './fake-main'

const tick = () => new Promise<void>(done => setImmediate(done))

function setup() {
  const env = fakeContext(['http://find.test/a'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  const calls: unknown[][] = []
  let selection: Promise<unknown> = Promise.resolve('')
  let css = 0
  const page = Object.assign(live.wc, {
    session: {},
    navigationHistory: { canGoBack: () => false, canGoForward: () => false },
    getTitle: () => '',
    insertCSS: async () => {
      calls.push(['insertCSS'])
      return `k${++css}`
    },
    removeInsertedCSS: async (key: string) =>
      void calls.push(['removeInsertedCSS', key]),
    stopFindInPage: (action: string) => void calls.push(['stop', action]),
    findInPage: (text: string, options: unknown) => {
      calls.push(['find', text, options])
      return calls.length
    },
    executeJavaScriptInIsolatedWorld: () => selection,
    sendInputEvent: (event: unknown) => void calls.push(['input', event])
  })
  env.ctx.attached.tabId = tab.id
  env.ctx.attached.view = live.view as unknown as WebContentsView

  // a view da barra: um webContents que só registra o que recebe
  const sentToBar: unknown[] = []
  const barContents = {
    destroyed: false,
    closed: 0,
    focused: 0,
    isDestroyed: () => barContents.destroyed,
    close: () => void barContents.closed++,
    focus: () => void barContents.focused++,
    send: (_channel: string, payload: unknown) => void sentToBar.push(payload)
  }
  const barView = {
    webContents: barContents as unknown,
    bounds: null as unknown,
    getBounds: () => ({ x: 1003, y: 8, width: 437, height: 84 }),
    setBounds: (bounds: unknown) => void (barView.bounds = bounds)
  }
  const session: FindSession = {
    tabId: tab.id,
    view: barView as unknown as WebContentsView,
    state: beginFindRequest(typeFindText(createFindState(), 'banana'), 1),
    ready: true,
    cssKey: 'k0',
    refreshOnLoad: false,
    lastSent: ''
  }
  env.ctx.find = session
  const setSelection = (value: Promise<unknown>) => void (selection = value)
  return {
    ...env,
    tab,
    page,
    calls,
    session,
    barView,
    barContents,
    sentToBar,
    setSelection
  }
}

test('página nova com a barra aberta: as cores do design entram de novo e a busca recomeça do começo', async () => {
  const { ctx, page, calls, session } = setup()
  attachFindEvents(ctx, session.tabId, page as unknown as WebContents)
  session.state = applyFindResult(session.state, {
    requestId: 1,
    activeMatchOrdinal: 2,
    matches: 3,
    finalUpdate: true
  })

  page.emit('did-navigate')
  assert.equal(session.state.matches, 0)
  assert.equal(session.state.live, false)
  await tick()
  assert.deepEqual(calls, [['insertCSS']])
  assert.equal(session.cssKey, 'k1')

  // o Chromium começaria depois do destaque da página anterior ("2 de 3"): a sessão anterior sai
  page.emit('did-stop-loading')
  assert.deepEqual(calls.slice(1), [
    ['stop', 'clearSelection'],
    ['find', 'banana', { forward: true, findNext: true, matchCase: false }]
  ])
  // um iframe que termina depois não recomeça de novo
  page.emit('did-stop-loading')
  assert.equal(calls.length, 3)
})

test('a barra fechou enquanto o CSS entrava: ele sai da página', async () => {
  const { ctx, page, calls, session } = setup()
  applyFindHighlight(ctx, session, page as unknown as WebContents)
  ctx.find = null
  await tick()
  assert.deepEqual(calls, [['insertCSS'], ['removeInsertedCSS', 'k1']])
})

test('página de erro com a barra aberta: a barra fecha e os destaques saem', () => {
  const { ctx, page, calls, barContents, removed, barView, session } = setup()
  attachTabEvents(ctx, session.tabId, page as unknown as WebContents)
  page.emit(
    'did-fail-load',
    {},
    -105,
    'ERR_NAME_NOT_RESOLVED',
    'http://find.test/a',
    true
  )
  assert.equal(ctx.find, null)
  assert.ok(removed.includes(barView))
  assert.equal(barContents.closed, 1)
  assert.deepEqual(calls, [
    ['stop', 'clearSelection'],
    ['removeInsertedCSS', 'k0']
  ])
})

test('⌘F com a paleta aberta: a paleta fecha e a barra fica com o foco', () => {
  const { ctx, store, barContents, sent } = setup()
  store.setOverlay('palette', true)
  openFind(ctx)
  assert.equal(store.state.overlay.includes('palette'), false)
  assert.ok(sent.some(message => message.channel === 'palette:hide'))
  assert.equal(barContents.focused, 1)
})

test('⌘F de novo: a seleção da página que chega depois não apaga o que já se digitou', async () => {
  const { ctx, session, setSelection, calls } = setup()
  let resolve: (value: unknown) => void = () => {}
  setSelection(new Promise(done => (resolve = done)))
  openFind(ctx)
  setFindText(ctx, 'kiwi')
  resolve('abacaxi')
  await tick()
  assert.equal(session.state.text, 'kiwi')
  assert.ok(!calls.some(call => call[1] === 'abacaxi'))
})

test('⌘F de novo com o próprio texto da busca selecionado: o destaque ativo fica onde está', async () => {
  const { ctx, session, setSelection, calls } = setup()
  setSelection(Promise.resolve('banana'))
  const revision = session.state.textRevision
  openFind(ctx)
  await tick()
  assert.equal(session.state.textRevision, revision)
  assert.equal(session.state.selected, true)
  assert.ok(!calls.some(call => call[0] === 'find'))
})

test('⌘F com outro texto selecionado: ele vira a busca', async () => {
  const { ctx, session, setSelection, calls } = setup()
  setSelection(Promise.resolve('  abacaxi\n  '))
  openFind(ctx)
  await tick()
  assert.equal(session.state.text, 'abacaxi')
  assert.ok(calls.some(call => call[0] === 'find' && call[1] === 'abacaxi'))
})

const POINTER: FindPointer = {
  kind: 'down',
  x: 200,
  y: 66,
  button: 'left',
  clickCount: 1,
  buttons: 1,
  deltaX: 0,
  deltaY: 0,
  shift: false,
  alt: false,
  meta: false,
  control: false
}

test('mouse na margem da barra: a página recebe o evento no mesmo ponto e o foco no clique', () => {
  const { ctx, page, calls } = setup()
  passFindPointer(ctx, POINTER)
  assert.equal(page.focused, 1)
  const [kind, event] = calls[0] as [string, { type: string; x: number }]
  assert.equal(kind, 'input')
  assert.equal(event.type, 'mouseDown')
  // a página começa depois da sidebar (x 260 na janela de 1300)
  assert.equal(event.x, 1003 + 200 - 260)

  passFindPointer(ctx, { ...POINTER, kind: 'move', buttons: 0 })
  assert.equal(page.focused, 1)
  assert.equal(calls.length, 2)

  // sem barra aberta, ninguém recebe nada
  ctx.find = null
  passFindPointer(ctx, POINTER)
  assert.equal(calls.length, 2)
})

test('barra já destruída (o Electron tira o webContents da view): fechar e arrumar não quebram', () => {
  const { ctx, barView, session } = setup()
  barView.webContents = undefined
  assert.doesNotThrow(() => {
    layoutFind(ctx, { x: 0, y: 0, width: 800, height: 600 })
    pushFindState(ctx)
    passFindPointer(ctx, POINTER)
    closeFind(ctx)
  })
  assert.equal(ctx.find, null)
  assert.equal(ctx.findMatchCase, session.state.matchCase)
})

test('estado da barra: só quando muda, e com o tema e a cor do espaço', () => {
  const { ctx, sentToBar } = setup()
  pushFindState(ctx)
  pushFindState(ctx)
  assert.equal(sentToBar.length, 1)
  assert.deepEqual(Object.keys(sentToBar[0] as object).sort(), [
    'accent',
    'count',
    'focusRevision',
    'matchCase',
    'text',
    'textRevision',
    'theme'
  ])
})
