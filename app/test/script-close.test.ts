import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContentsView } from 'electron'
import { closeDeadTab } from '../src/main/actions/close-dead-tab'
import { attachCloseEvents } from '../src/main/functions/attach-close-events'
import { judgeScriptClose } from '../src/main/functions/judge-script-close'
import { REVIVE_GAP_MS } from '../src/main/functions/keep-tab-after-script-close'
import { fakeContext } from './fake-main'

const as = <T>(value: unknown) => value as T

function setup() {
  const env = fakeContext([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/'
  ])
  const [a, b, c] = env.store.getTabsOfSpace('personal')
  return { ...env, a, b, c }
}

function show(
  env: ReturnType<typeof setup>,
  tab: { id: string },
  live: { view: unknown }
) {
  env.store.setActiveTab('personal', tab.id)
  env.ctx.attached.tabId = tab.id
  env.ctx.attached.view = live.view as never
}

test('regra: só aba aberta por script pode ser fechada por script', () => {
  const env = setup()
  assert.equal(judgeScriptClose(env.ctx, env.a.id), 'not-script-opened')
  env.ctx.guard.scriptOpened.add(env.a.id)
  assert.equal(judgeScriptClose(env.ctx, env.a.id), 'allow')
})

test('regra: nunca fecha o opener enquanto as abas que ele abriu existem', () => {
  const env = setup()
  env.ctx.guard.scriptOpened.add(env.a.id)
  env.ctx.guard.openers.set(env.b.id, env.a.id)
  assert.equal(judgeScriptClose(env.ctx, env.a.id), 'has-children')
  // o filho se foi: o pai volta a poder
  env.store.removeTab(env.b.id)
  assert.equal(judgeScriptClose(env.ctx, env.a.id), 'allow')
})

test('window.close() numa aba normal é ignorado: a aba fica dormente, com o histórico, e recarrega', () => {
  const env = setup()
  const live = env.makeLive(env.a)
  show(env, env.a, live)
  env.makeLive(env.b)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(live.view))
  // o Chromium emite 'close' e destrói em seguida
  const history = { entries: [{ url: 'https://a.test/' }], index: 0 }
  Object.assign(live.wc, {
    navigationHistory: {
      getAllEntries: () => history.entries,
      getActiveIndex: () => history.index
    }
  })
  live.wc.emit('close')
  live.view.destroy()

  assert.ok(env.store.getTab(env.a.id), 'a aba continua na sidebar')
  assert.equal(env.store.closed.length, 0)
  // a que estava na frente é recarregada (acordada) com o histórico guardado
  const revived = env.ctx.views.get(env.a.id)
  assert.ok(revived, 'a aba foi recriada')
  assert.notEqual(revived, as(live.view))
  assert.equal(env.store.getTab(env.a.id)?.dormant, false)
  assert.equal(env.ctx.attached.tabId, env.a.id)
})

test('aba normal em segundo plano que tenta se fechar fica dormente, sem roubar a tela', () => {
  const env = setup()
  const front = env.makeLive(env.b)
  show(env, env.b, front)
  const back = env.makeLive(env.a)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(back.view))
  back.view.destroy()
  assert.equal(env.store.getTab(env.a.id)?.dormant, true)
  assert.equal(env.ctx.views.has(env.a.id), false)
  assert.equal(env.ctx.attached.tabId, env.b.id)
})

test('página que insiste em se fechar em laço: a segunda vez a aba fica dormente e a vizinha assume', () => {
  const env = setup()
  const first = env.makeLive(env.a)
  show(env, env.a, first)
  env.makeLive(env.b)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(first.view))
  first.view.destroy()
  // recarregou, a página se fechou de novo logo em seguida
  const second = env.ctx.views.get(env.a.id) as unknown as {
    webContents: { emit(e: string): void }
  }
  assert.ok(second)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(second))
  closeDeadTab(env.ctx, env.a.id, as<WebContentsView>(second))
  assert.equal(env.store.getTab(env.a.id)?.dormant, true)
  assert.equal(env.ctx.attached.tabId, env.b.id)
  assert.ok(REVIVE_GAP_MS >= 5000)
})

test('pop-up que tenta fechar o opener com opener.close(): o opener fica', () => {
  const env = setup()
  // a (normal) abriu o pop-up b por script
  env.ctx.guard.scriptOpened.add(env.b.id)
  env.ctx.guard.openers.set(env.b.id, env.a.id)
  const opener = env.makeLive(env.a)
  show(env, env.a, opener)
  const popup = env.makeLive(env.b)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(opener.view))
  attachCloseEvents(env.ctx, env.b.id, as<WebContentsView>(popup.view))
  // o Chromium fecha o opener a pedido do pop-up
  opener.view.destroy()
  assert.ok(env.store.getTab(env.a.id), 'o opener continua')
  assert.equal(env.store.closed.length, 0)
  // o pop-up termina sozinho com window.close(): sai e entra no ⇧⌘T
  popup.view.destroy()
  assert.equal(env.store.getTab(env.b.id), undefined)
  assert.equal(env.store.closed.length, 1)
})

test('o pai de um pop-up que se abriu por script não se fecha enquanto o filho vive', () => {
  const env = setup()
  env.ctx.guard.scriptOpened.add(env.a.id)
  env.ctx.guard.scriptOpened.add(env.b.id)
  env.ctx.guard.openers.set(env.b.id, env.a.id)
  const parent = env.makeLive(env.a)
  show(env, env.a, parent)
  env.makeLive(env.b)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(parent.view))
  parent.view.destroy()
  assert.ok(env.store.getTab(env.a.id))
})

test('fechar pelo usuário (⌘W) continua entrando no ⇧⌘T e não passa pela regra de script', () => {
  const env = setup()
  const live = env.makeLive(env.a)
  show(env, env.a, live)
  env.makeLive(env.b)
  attachCloseEvents(env.ctx, env.a.id, as<WebContentsView>(live.view))
  env.ctx.closing.add(env.a.id)
  live.view.destroy()
  assert.equal(env.store.getTab(env.a.id), undefined)
  assert.equal(env.store.closed[0]?.url, 'https://a.test/')
})
