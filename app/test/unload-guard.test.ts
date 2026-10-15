import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import { dialog } from 'electron'
import { closeTab } from '../src/main/actions/close-tab'
import { goBack } from '../src/main/actions/go-back'
import { navigateTab } from '../src/main/actions/navigate-tab'
import { reloadTab } from '../src/main/actions/reload-tab'
import { attachUnloadGuard } from '../src/main/functions/attach-unload-guard'
import {
  latestUserIntent,
  markUserNavigation
} from '../src/main/functions/user-intent'
import {
  GESTURE_WINDOW_MS,
  markGesture
} from '../src/main/functions/user-gesture'
import { fakeContext } from './fake-main'

function setup() {
  const env = fakeContext(['https://rascunho.test/', 'https://outra.test/'])
  const [tab, other] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  const liveOther = env.makeLive(other)
  env.store.setActiveTab('personal', tab.id)
  env.ctx.attached.tabId = tab.id
  env.ctx.attached.view = live.view as never
  const wc = Object.assign(live.wc, {
    reload() {
      this.reloaded = (this.reloaded ?? 0) + 1
    },
    loadURL: async () => {},
    reloaded: 0,
    navigationHistory: {
      canGoBack: () => true,
      canGoForward: () => false,
      goBack() {}
    }
  })
  attachUnloadGuard(env.ctx, tab.id, wc as unknown as WebContents)
  const otherWc = Object.assign(liveOther.wc, {
    loadURL: async () => {},
    navigationHistory: {
      canGoBack: () => false,
      canGoForward: () => false
    }
  })
  attachUnloadGuard(env.ctx, other.id, otherWc as unknown as WebContents)

  const asked: unknown[] = []
  let answer = 1
  ;(
    dialog as unknown as { showMessageBoxSync: (...a: unknown[]) => number }
  ).showMessageBoxSync = (...args: unknown[]) => {
    asked.push(args[args.length - 1])
    return answer
  }
  // a página pede para não ser descarregada; devolve true se o app a deixou sair
  const beforeUnload = (target: {
    emit: (e: string, ...a: unknown[]) => void
  }) => {
    let left = false
    target.emit('will-prevent-unload', { preventDefault: () => (left = true) })
    return left
  }
  return {
    ...env,
    tab,
    other,
    wc,
    otherWc,
    asked,
    beforeUnload,
    sair: () => void (answer = 0),
    ficar: () => void (answer = 1)
  }
}

test('sem ação do usuário o beforeunload não ganha diálogo: a página fica como está', () => {
  const env = setup()
  assert.equal(env.beforeUnload(env.wc), false)
  assert.equal(env.asked.length, 0)
})

test('aba em segundo plano não rouba o foco nem prende o app com um diálogo', () => {
  const env = setup()
  // a página dela força uma navegação em loop: dezenas de pedidos de saída
  for (let n = 0; n < 50; n++) env.beforeUnload(env.otherWc)
  assert.equal(env.asked.length, 0)
  assert.equal(env.ctx.attached.tabId, env.tab.id)
  // nem um clique "recente" dela vale: ela não está na frente
  markGesture(env.ctx.guard, env.other.id)
  assert.equal(env.beforeUnload(env.otherWc), false)
  assert.equal(env.asked.length, 0)
})

test('⌘W do usuário: pergunta uma vez; Sair deixa fechar', () => {
  const env = setup()
  env.sair()
  closeTab(env.ctx, env.tab.id)
  assert.equal(env.beforeUnload(env.wc), true)
  assert.equal(env.asked.length, 1)
  assert.equal(env.ctx.closing.has(env.tab.id), true)
})

test('fechar uma aba ao fundo pelo menu é ação do usuário: ela vem para a frente e pergunta', () => {
  const env = setup()
  env.ficar()
  closeTab(env.ctx, env.other.id)
  assert.equal(env.beforeUnload(env.otherWc), false)
  assert.equal(env.asked.length, 1)
  assert.equal(env.ctx.attached.tabId, env.other.id)
})

test('nunca em loop: uma pergunta por ação, os pedidos seguintes da mesma ação repetem a resposta', () => {
  const env = setup()
  env.ficar()
  markGesture(env.ctx.guard, env.tab.id)
  // o clique no link e a página, em loop, tentando impedir a saída
  const results = Array.from({ length: 20 }, () => env.beforeUnload(env.wc))
  assert.equal(env.asked.length, 1)
  assert.ok(results.every(left => !left))

  // Sair: os quadros seguintes da mesma ação também deixam sair, sem perguntar de novo
  const other = setup()
  other.sair()
  markGesture(other.ctx.guard, other.tab.id)
  assert.equal(other.beforeUnload(other.wc), true)
  assert.equal(other.beforeUnload(other.wc), true)
  assert.equal(other.asked.length, 1)
})

test('uma ação nova do usuário vale uma pergunta nova', () => {
  const env = setup()
  env.ficar()
  markGesture(env.ctx.guard, env.tab.id, Date.now() - 2000)
  env.beforeUnload(env.wc)
  assert.equal(env.asked.length, 1)
  // o usuário clica de novo
  markGesture(env.ctx.guard, env.tab.id, Date.now())
  env.beforeUnload(env.wc)
  assert.equal(env.asked.length, 2)
})

test('a ação do usuário vale só por alguns segundos', () => {
  const env = setup()
  markGesture(env.ctx.guard, env.tab.id, Date.now() - GESTURE_WINDOW_MS - 500)
  assert.equal(env.beforeUnload(env.wc), false)
  assert.equal(env.asked.length, 0)
  assert.equal(latestUserIntent(env.ctx, env.tab.id), null)
})

test('recarregar, voltar e ir a um endereço são ações do usuário', () => {
  const env = setup()
  env.sair()
  reloadTab(env.ctx)
  assert.equal(env.wc.reloaded, 1)
  assert.equal(env.beforeUnload(env.wc), true)
  assert.equal(env.asked.length, 1)

  const back = setup()
  back.sair()
  goBack(back.ctx)
  assert.equal(back.beforeUnload(back.wc), true)

  const address = setup()
  address.sair()
  navigateTab(address.ctx, address.tab.id, 'exemplo.com')
  assert.equal(address.beforeUnload(address.wc), true)
})

test('o gesto de outra aba não vale para esta', () => {
  const env = setup()
  markUserNavigation(env.ctx, env.other.id)
  assert.equal(latestUserIntent(env.ctx, env.tab.id), null)
  assert.ok(latestUserIntent(env.ctx, env.other.id) !== null)
})
