import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import { activateTab } from '../src/main/actions/activate-tab'
import {
  dismissBlockedPopups,
  openBlockedPopups
} from '../src/main/actions/open-blocked-popups'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import {
  MAX_KEPT_POPUPS,
  recordBlockedPopup
} from '../src/main/functions/blocked-popups'
import {
  MAX_POPUPS_PER_GESTURE,
  decidePopup
} from '../src/main/functions/decide-popup'
import {
  markFrameGesture,
  markLinkClick
} from '../src/main/functions/frame-gesture'
import {
  GESTURE_WINDOW_MS,
  markGesture
} from '../src/main/functions/user-gesture'
import { installWindowOpenHandler } from '../src/main/functions/window-open'
import { forgetTab } from '../src/main/web-guard'
import { fakeContext } from './fake-main'

test('pop-up só abre com gesto recente (5 s)', () => {
  assert.equal(decidePopup(1000, undefined, undefined).allow, false)
  assert.equal(decidePopup(1000, undefined, undefined).reason, 'no-gesture')
  assert.equal(
    decidePopup(1000 + GESTURE_WINDOW_MS, 1000, undefined).allow,
    true
  )
  const late = decidePopup(1001 + GESTURE_WINDOW_MS, 1000, undefined)
  assert.equal(late.allow, false)
  assert.equal(late.reason, 'no-gesture')
  // gesto "no futuro" (relógio andou para trás) também não vale
  assert.equal(decidePopup(500, 1000, undefined).allow, false)
})

test('um gesto libera no máximo 3 pop-ups; outro gesto, outro saldo', () => {
  let budget = undefined as ReturnType<typeof decidePopup>['budget']
  for (let n = 1; n <= MAX_POPUPS_PER_GESTURE; n++) {
    const verdict = decidePopup(2000, 1000, budget)
    assert.equal(verdict.allow, true, `pop-up ${n}`)
    budget = verdict.budget
  }
  const fourth = decidePopup(2000, 1000, budget)
  assert.equal(fourth.allow, false)
  assert.equal(fourth.reason, 'limit')
  // o clique seguinte renova o saldo
  const next = decidePopup(3000, 2900, fourth.budget)
  assert.equal(next.allow, true)
  assert.equal(next.budget?.used, 1)
})

function setup() {
  const env = fakeContext(['https://opener.test/', 'https://outra.test/'])
  const [opener, other] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(opener)
  let handler: ((details: unknown) => unknown) | null = null
  const wc = Object.assign(live.wc, {
    setWindowOpenHandler(fn: (details: unknown) => unknown) {
      handler = fn
    }
  })
  installWindowOpenHandler(
    env.ctx,
    'personal',
    opener.id,
    wc as unknown as WebContents
  )
  // referrer: o que o Chromium calcula a partir do quadro que pediu (vazio com noreferrer)
  const open = (url: string, disposition = 'foreground-tab', referrer = '') =>
    handler?.({
      url,
      disposition,
      frameName: '',
      features: '',
      referrer: { url: referrer, policy: 'strict-origin-when-cross-origin' }
    }) as {
      action: string
      outlivesOpener?: boolean
      createWindow?: (options: object) => WebContents
    }
  return { ...env, opener, other, wc, open }
}

test('sem gesto: o pop-up é negado, a aba ganha o aviso e a URL fica guardada no main', () => {
  const env = setup()
  const result = env.open('https://anuncio.test/promo')
  assert.equal(result.action, 'deny')
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 1)
  assert.deepEqual(env.ctx.guard.blockedPopups.get(env.opener.id), [
    'https://anuncio.test/promo'
  ])
  // a mesma URL de novo não infla a contagem
  env.open('https://anuncio.test/promo')
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 1)
  env.open('https://outro.test/')
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 2)
  assert.equal(env.store.getTabsOfSpace('personal').length, 2)
})

test('o aviso guarda poucas URLs (a mesma página insistindo)', () => {
  const env = setup()
  for (let n = 0; n < 20; n++)
    recordBlockedPopup(env.ctx, env.opener.id, `https://x.test/${n}`)
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, MAX_KEPT_POPUPS)
})

test('esquemas que não são web continuam negados, com ou sem gesto', () => {
  const env = setup()
  markGesture(env.ctx.guard, env.opener.id)
  for (const url of [
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,x'
  ])
    assert.equal(env.open(url).action, 'deny', url)
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 0)
})

test('com gesto: a janela abre como aba, independente do opener e marcada como de script', () => {
  const env = setup()
  env.store.setActiveTab('personal', env.opener.id)
  env.ctx.attached.tabId = env.opener.id
  markGesture(env.ctx.guard, env.opener.id)
  const result = env.open('https://login.test/oauth')
  assert.equal(result.action, 'allow')
  // fechar o opener não leva o pop-up junto
  assert.equal(result.outlivesOpener, true)
  result.createWindow?.({})
  const tabs = env.store.getTabsOfSpace('personal')
  assert.equal(tabs.length, 3)
  const popup = tabs.find(tab => tab.url === 'https://login.test/oauth')
  assert.ok(popup)
  assert.equal(env.ctx.guard.scriptOpened.has(popup.id), true)
  assert.equal(env.ctx.guard.openers.get(popup.id), env.opener.id)
  // o opener estava na frente: o pop-up vira a aba ativa
  assert.equal(env.store.getActiveTabId('personal'), popup.id)
})

test('aba que não é a ativa abre o pop-up em segundo plano, sem roubar a tela', () => {
  const env = setup()
  env.store.setActiveTab('personal', env.other.id)
  env.ctx.attached.tabId = env.other.id
  markGesture(env.ctx.guard, env.opener.id)
  const result = env.open('https://anuncio.test/popunder')
  result.createWindow?.({})
  const popup = env.store
    .getTabsOfSpace('personal')
    .find(tab => tab.url === 'https://anuncio.test/popunder')
  assert.ok(popup)
  assert.equal(env.store.getActiveTabId('personal'), env.other.id)
  assert.equal(env.ctx.attached.tabId, env.other.id)
})

test('abrir em segundo plano pelo usuário (⌘+clique) continua em segundo plano', () => {
  const env = setup()
  env.store.setActiveTab('personal', env.opener.id)
  env.ctx.attached.tabId = env.opener.id
  markGesture(env.ctx.guard, env.opener.id)
  env.open('https://a.test/', 'background-tab').createWindow?.({})
  assert.equal(env.store.getActiveTabId('personal'), env.opener.id)
})

test('no máximo 3 pop-ups por gesto', () => {
  const env = setup()
  markGesture(env.ctx.guard, env.opener.id)
  const actions = [1, 2, 3, 4, 5].map(
    n => env.open(`https://p${n}.test/`).action
  )
  assert.deepEqual(actions, ['allow', 'allow', 'allow', 'deny', 'deny'])
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 2)
})

test('"Abrir" no aviso abre o que foi bloqueado: o primeiro na frente, o resto ao fundo', () => {
  const env = setup()
  env.open('https://um.test/')
  env.open('https://dois.test/')
  openBlockedPopups(env.ctx, env.opener.id)
  const urls = env.store.getTabsOfSpace('personal').map(tab => tab.url)
  assert.ok(urls.includes('https://um.test/'))
  assert.ok(urls.includes('https://dois.test/'))
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 0)
  assert.equal(env.ctx.guard.blockedPopups.has(env.opener.id), false)
  const one = env.store
    .getTabsOfSpace('personal')
    .find(tab => tab.url === 'https://um.test/')
  assert.equal(env.store.getActiveTabId('personal'), one?.id)
})

test('dispensar o aviso descarta sem abrir nada', () => {
  const env = setup()
  env.open('https://um.test/')
  dismissBlockedPopups(env.ctx, env.opener.id)
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 0)
  assert.equal(env.store.getTabsOfSpace('personal').length, 2)
})

test('a página navegou: o aviso de pop-up bloqueado some', () => {
  const env = setup()
  const wc = Object.assign(env.wc, {
    session: {},
    navigationHistory: { canGoBack: () => false, canGoForward: () => false },
    getTitle: () => ''
  })
  attachTabEvents(env.ctx, env.opener.id, wc as unknown as WebContents)
  env.open('https://um.test/')
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 1)
  wc.emit('did-navigate')
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 0)
})

test('ativar a aba apaga o marcador de diálogo descartado', () => {
  const env = setup()
  env.store.patchTab(env.other.id, { dialogBlocked: true })
  env.makeLive(env.other)
  activateTab(env.ctx, env.other.id)
  assert.equal(env.store.getTab(env.other.id)?.dialogBlocked, false)
})

test('a aba que sai da sidebar esquece o que se sabia dela', () => {
  const env = setup()
  env.ctx.guard.scriptOpened.add(env.opener.id)
  env.ctx.guard.openers.set('filha', env.opener.id)
  forgetTab(env.ctx.guard, env.opener.id)
  assert.equal(env.ctx.guard.scriptOpened.has(env.opener.id), false)
  assert.equal(env.ctx.guard.openers.has('filha'), false)
})

// ---------- gesto por quadro: o anúncio de outra origem não herda o clique na página ----------

interface FakeFrame {
  processId: number
  frameToken: string
  origin: string
  url: string
  parent: FakeFrame | null
}

function fakeFrame(
  token: string,
  origin: string,
  url: string,
  parent: FakeFrame | null = null
): FakeFrame {
  return { processId: 1, frameToken: token, origin, url, parent }
}

// a página (opener.test) com um anúncio de outra origem num iframe
function setupWithAd() {
  const env = setup()
  const page = fakeFrame('page', 'https://opener.test', 'https://opener.test/')
  const ad = fakeFrame(
    'ad',
    'https://ads.test',
    'https://ads.test/banner',
    page
  )
  Object.assign(env.wc, { mainFrame: { framesInSubtree: [page, ad] } })
  const clickIn = (frame: FakeFrame) =>
    markFrameGesture(env.ctx.guard, env.opener.id, {
      key: `${frame.processId}:${frame.frameToken}`,
      origin: frame.origin
    })
  return { ...env, page, ad, clickIn }
}

test('clique na página: o pop-up do iframe de outra origem é negado; o da página abre', () => {
  const env = setupWithAd()
  env.clickIn(env.page)
  // window.open do anúncio: o referrer é da origem dele
  const fromAd = env.open(
    'https://ads.test/popunder',
    'foreground-tab',
    'https://ads.test/banner'
  )
  assert.equal(fromAd.action, 'deny')
  assert.deepEqual(env.ctx.guard.blockedPopups.get(env.opener.id), [
    'https://ads.test/popunder'
  ])
  // o mesmo clique continua valendo para a página
  const fromPage = env.open(
    'https://login.test/',
    'foreground-tab',
    'https://opener.test/'
  )
  assert.equal(fromPage.action, 'allow')
  assert.equal(env.store.getTab(env.opener.id)?.blockedPopups, 1)
})

test('clique dentro do anúncio: o pop-up dele abre (como no Chromium), e a página também', () => {
  const env = setupWithAd()
  // o main não vê o clique num iframe de outra origem: só o relato do preload do quadro
  assert.equal(env.ctx.guard.gestures.has(env.opener.id), false)
  env.clickIn(env.ad)
  assert.equal(
    env.ctx.guard.gestures.has(env.opener.id),
    true,
    'o relato do quadro também é o gesto da aba'
  )
  const fromAd = env.open(
    'https://ads.test/oferta',
    'foreground-tab',
    'https://ads.test/banner'
  )
  assert.equal(fromAd.action, 'allow')
  const fromPage = env.open(
    'https://opener.test/x',
    'foreground-tab',
    'https://opener.test/'
  )
  assert.equal(fromPage.action, 'allow')
})

test('sem referrer (noreferrer): só abre se nenhum quadro ficou sem o clique, ou se foi um clique em link', () => {
  const env = setupWithAd()
  env.clickIn(env.page)
  // pode ser o anúncio pedindo: negado
  assert.equal(env.open('https://ads.test/nr').action, 'deny')
  // o usuário clicou num link para esta URL: o pop-up é dele
  markLinkClick(env.ctx.guard, env.opener.id, 'https://externo.test/artigo')
  assert.equal(env.open('https://externo.test/artigo').action, 'allow')
  // a URL é outra (o anúncio tentando aproveitar o clique): negado
  assert.equal(env.open('https://ads.test/nr2').action, 'deny')
  // o clique no link vale por pouco tempo
  env.ctx.guard.linkClicks.set(env.opener.id, {
    url: 'https://externo.test/artigo',
    at: Date.now() - 5000
  })
  assert.equal(env.open('https://externo.test/artigo').action, 'deny')
})

test('página sem iframe de outra origem: noreferrer abre normalmente com o clique', () => {
  const env = setup()
  const page = fakeFrame('page', 'https://opener.test', 'https://opener.test/')
  const same = fakeFrame(
    'same',
    'https://opener.test',
    'https://opener.test/w',
    page
  )
  Object.assign(env.wc, { mainFrame: { framesInSubtree: [page, same] } })
  markFrameGesture(env.ctx.guard, env.opener.id, {
    key: '1:page',
    origin: 'https://opener.test'
  })
  assert.equal(env.open('https://a.test/').action, 'allow')
})

test('o gesto por quadro e o clique em link somem quando a aba carrega outro documento', () => {
  const env = setupWithAd()
  env.clickIn(env.ad)
  markLinkClick(env.ctx.guard, env.opener.id, 'https://x.test/')
  const wc = Object.assign(env.wc, {
    session: {},
    navigationHistory: { canGoBack: () => false, canGoForward: () => false },
    getTitle: () => ''
  })
  attachTabEvents(env.ctx, env.opener.id, wc as unknown as WebContents)
  wc.emit('did-navigate')
  assert.equal(env.ctx.guard.frameGestures.has(env.opener.id), false)
  assert.equal(env.ctx.guard.linkClicks.has(env.opener.id), false)
  assert.equal(env.ctx.guard.gestures.has(env.opener.id), false)
  assert.equal(
    env.open('https://ads.test/p', 'foreground-tab', 'https://ads.test/banner')
      .action,
    'deny'
  )
})

test('decidePopup: o motivo é outro quadro, depois do gesto e antes do limite', () => {
  assert.equal(
    decidePopup(2000, undefined, undefined, false).reason,
    'no-gesture'
  )
  const foreign = decidePopup(2000, 1000, undefined, false)
  assert.equal(foreign.allow, false)
  assert.equal(foreign.reason, 'other-frame')
  // não gasta o saldo do gesto
  assert.equal(foreign.budget, undefined)
  assert.equal(decidePopup(2000, 1000, undefined, true).allow, true)
})
