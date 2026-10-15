import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContentsView } from 'electron'
import { closeDeadTab } from '../src/main/actions/close-dead-tab'
import { closeTab } from '../src/main/actions/close-tab'
import { attachCloseEvents } from '../src/main/functions/attach-close-events'
import { getLiveContents } from '../src/main/functions/get-live-contents'
import { runSuspensionTick } from '../src/main/services/suspension-timer'
import { fakeContext } from './fake-main'

const as = <T>(value: unknown) => value as T

function setup() {
  const env = fakeContext(['https://a.com', 'https://b.com', 'https://c.com'])
  const [a, b, c] = env.store.getTabsOfSpace('personal')
  return { ...env, a, b, c }
}

test('getLiveContents: undefined depois de destruído, nunca lança', () => {
  const { makeLive, a } = setup()
  const { view, wc } = makeLive(a)
  assert.equal(getLiveContents(as<WebContentsView>(view)), as(wc))
  view.destroy()
  assert.equal(getLiveContents(as<WebContentsView>(view)), null)
  assert.equal(getLiveContents(null), null)
  assert.equal(getLiveContents(undefined), null)
})

test('pop-up que se fecha (window.close): a aba sai da sidebar e a vizinha assume', () => {
  const { ctx, store, a, b, c, makeLive } = setup()
  // aberta por window.open: pode se fechar por script
  ctx.guard.scriptOpened.add(a.id)
  const popup = makeLive(a)
  makeLive(b)
  store.setActiveTab('personal', a.id)
  ctx.attached.tabId = a.id
  ctx.attached.view = as<WebContentsView>(popup.view)
  attachCloseEvents(ctx, a.id, as<WebContentsView>(popup.view))

  popup.view.destroy()

  assert.equal(store.getTab(a.id), undefined)
  assert.equal(ctx.views.has(a.id), false)
  // a vizinha de baixo vira a ativa
  assert.equal(store.getActiveTabId('personal'), b.id)
  assert.equal(ctx.attached.tabId, b.id)
  assert.ok(store.getTab(c.id))
  // fechada por script também entra no ⇧⌘T: o usuário recupera o que um site fechou
  assert.equal(store.closed.length, 1)
  assert.equal(store.closed[0].url, 'https://a.com')
})

test('suspensão destrói a view mas não remove a aba', () => {
  const { ctx, store, a, makeLive } = setup()
  const live = makeLive(a)
  attachCloseEvents(ctx, a.id, as<WebContentsView>(live.view))
  // o app destrói: tira do registro antes (destroyTabView) e só então o evento chega
  ctx.views.delete(a.id)
  live.view.destroy()
  assert.ok(store.getTab(a.id))
})

test('evento atrasado de uma view antiga não derruba a aba que acordou', () => {
  const { ctx, store, a, makeLive } = setup()
  const old = makeLive(a)
  attachCloseEvents(ctx, a.id, as<WebContentsView>(old.view))
  ctx.views.delete(a.id)
  const fresh = makeLive(a)
  closeDeadTab(ctx, a.id, as<WebContentsView>(old.view))
  assert.ok(store.getTab(a.id))
  assert.equal(ctx.views.get(a.id), as(fresh.view))
})

test('fechar o último tab do espaço abre uma Nova aba', () => {
  const env = fakeContext(['https://a.com'])
  const [a] = env.store.getTabsOfSpace('personal')
  env.ctx.guard.scriptOpened.add(a.id)
  const live = env.makeLive(a)
  env.ctx.attached.tabId = a.id
  env.ctx.attached.view = live.view as never
  attachCloseEvents(env.ctx, a.id, as<WebContentsView>(live.view))
  live.view.destroy()
  const rest = env.store.getTabsOfSpace('personal')
  assert.equal(rest.length, 1)
  assert.equal(rest[0].url, '')
  assert.equal(env.store.getActiveTabId('personal'), rest[0].id)
})

test('o timer de suspensão não lança com views mortas e deixa as abas dormentes', () => {
  const { ctx, store, a, b, c, makeLive } = setup()
  const deadA = makeLive(a)
  const deadB = makeLive(b)
  makeLive(c)
  // o evento destroyed se perdeu: as views seguem no registro sem webContents
  deadA.view.webContents = undefined
  deadB.view.webContents = undefined
  store.setActiveTab('personal', c.id)
  ctx.attached.tabId = c.id

  assert.doesNotThrow(() => runSuspensionTick(ctx, 60_000))
  // as duas, uma ao lado da outra: tratar a primeira não pode pular a segunda. Não foram abertas
  // por script, então não saem da sidebar: voltam dormentes e recarregam quando forem abertas
  assert.equal(store.getTab(a.id)?.dormant, true)
  assert.equal(store.getTab(b.id)?.dormant, true)
  assert.equal(ctx.views.has(a.id), false)
  assert.equal(ctx.views.has(b.id), false)
  assert.ok(store.getTab(c.id))
})

test('⌘W numa aba viva espera o beforeunload e só remove quando o webContents some', () => {
  const { ctx, store, a, b, makeLive } = setup()
  const live = makeLive(a)
  makeLive(b)
  store.setActiveTab('personal', a.id)
  attachCloseEvents(ctx, a.id, as<WebContentsView>(live.view))

  closeTab(ctx, a.id)
  assert.deepEqual(live.wc.closeCalls, [{ waitForBeforeUnload: true }])
  assert.ok(store.getTab(a.id), 'a aba espera a confirmação da página')
  assert.ok(ctx.closing.has(a.id))
  // ⌘W repetido não pede de novo
  closeTab(ctx, a.id)
  assert.equal(live.wc.closeCalls.length, 1)

  live.view.destroy()
  assert.equal(store.getTab(a.id), undefined)
  // fechada pelo usuário: entra no ⇧⌘T
  assert.equal(store.closed.length, 1)
  assert.equal(store.closed[0].url, 'https://a.com')
  assert.equal(ctx.closing.has(a.id), false)
})

test('aba dormente fecha na hora, sem webContents', () => {
  const { ctx, store, a, c } = setup()
  // a ativa é outra: fechar a dormente não acorda ninguém
  store.setActiveTab('personal', c.id)
  closeTab(ctx, a.id)
  assert.equal(store.getTab(a.id), undefined)
  assert.equal(store.closed.length, 1)
})

test('encerrando o app, a view que morre não é recriada nem a aba removida (SIGTRAP ao sair)', () => {
  const { ctx, store, a, b, c, makeLive } = setup()
  const front = makeLive(a)
  const popup = makeLive(b)
  makeLive(c)
  // b veio de window.open e sai da sidebar se fechar; a é a da frente e seria recarregada
  ctx.guard.scriptOpened.add(b.id)
  store.setActiveTab('personal', a.id)
  ctx.attached.tabId = a.id
  ctx.attached.view = as<WebContentsView>(front.view)
  attachCloseEvents(ctx, a.id, as<WebContentsView>(front.view))
  attachCloseEvents(ctx, b.id, as<WebContentsView>(popup.view))

  // before-quit
  ctx.quitting = true
  front.view.destroy()
  popup.view.destroy()

  // nada mudou no registro nem na sidebar: o desmonte não ativa, não cria e não remove
  assert.equal(ctx.views.get(a.id), as(front.view))
  assert.equal(store.getTab(a.id)?.dormant, false)
  assert.equal(ctx.attached.tabId, a.id)
  assert.ok(store.getTab(b.id))
  assert.equal(store.getTabsOfSpace('personal').length, 3)
  assert.equal(store.closed.length, 0)
  assert.equal(ctx.guard.scriptCloseUndoneAt.has(a.id), false)
})
