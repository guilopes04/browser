import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Tab } from '@shared/types'
import { AppStore, type StoreChange } from '../src/main/store/app-store'
import { buildInitialState } from '../src/main/store/build-initial-state'
import { hydrateTab } from '../src/main/store/hydrate-tab'
import { toSessionFile } from '../src/main/store/serialize-session'

function makeStore() {
  const { state, closed } = buildInitialState({
    theme: 'light',
    session: null,
    tabsFile: {
      urls: ['https://a.com', 'https://b.com', 'https://c.com'],
      window: {}
    },
    bounds: { x: 0, y: 0, width: 1440, height: 900 }
  })
  return new AppStore(state, closed)
}

test('--abas: dez abas no Pessoal, primeira ativa, resto dormente, Trabalho com Nova aba', () => {
  const store = makeStore()
  const personal = store.getTabsOfSpace('personal')
  assert.equal(personal.length, 3)
  assert.equal(store.getActiveTabId(), personal[0].id)
  assert.ok(personal.every(tab => tab.dormant))
  const work = store.getTabsOfSpace('work')
  assert.equal(work.length, 1)
  assert.equal(work[0].url, '')
  assert.equal(work[0].dormant, false)
})

test('configurações vêm da sessão e valor inválido volta ao padrão', () => {
  const { state: first } = buildInitialState({
    theme: 'dark',
    session: null,
    tabsFile: null,
    bounds: { x: 0, y: 0, width: 1, height: 1 }
  })
  assert.equal(first.settings.suspendAfterSec, 1800)
  assert.equal(first.theme, 'dark')

  const session = toSessionFile(first, [])
  session.settings.suspendAfterSec = 600
  const { state: restored } = buildInitialState({
    theme: 'light',
    session,
    tabsFile: null,
    bounds: { x: 0, y: 0, width: 1, height: 1 }
  })
  assert.equal(restored.settings.suspendAfterSec, 600)

  session.settings.suspendAfterSec = -3
  const { state: broken } = buildInitialState({
    theme: 'light',
    session,
    tabsFile: null,
    bounds: { x: 0, y: 0, width: 1, height: 1 }
  })
  assert.equal(broken.settings.suspendAfterSec, 1800)
})

test('touchTab atualiza lastActiveAt e avisa só a sessão (dirty)', () => {
  const store = makeStore()
  const changes: StoreChange[] = []
  store.subscribe(change => changes.push(change))
  const tab = store.getTabsOfSpace('personal')[0]
  store.touchTab(tab.id, 12345)
  assert.equal(tab.lastActiveAt, 12345)
  assert.deepEqual(changes, [{ kind: 'dirty' }])
})

test('addTab no topo respeita o espaço; patchTab só emite o que mudou', () => {
  const store = makeStore()
  const changes: StoreChange[] = []
  store.subscribe(change => changes.push(change))
  const first = store.getTabsOfSpace('personal')[0]
  store.patchTab(first.id, { title: 'A', loading: false })
  assert.deepEqual(changes[0], {
    kind: 'tab',
    tabId: first.id,
    patch: { title: 'A' }
  })
  store.patchTab(first.id, { title: 'A' })
  assert.equal(changes.length, 1)

  const fresh: Tab = { ...first, id: 'novo', url: '', dormant: false }
  store.addTab(fresh, 'top')
  assert.equal(store.getTabsOfSpace('personal')[0].id, 'novo')
  assert.equal(
    store.state.tabs.findIndex(tab => tab.id === 'novo'),
    0
  )
})

test('moveTab reordena dentro do espaço sem tocar nos outros', () => {
  const store = makeStore()
  const [a, b, c] = store.getTabsOfSpace('personal')
  store.moveTab(c.id, 0)
  assert.deepEqual(
    store.getTabsOfSpace('personal').map(tab => tab.id),
    [c.id, a.id, b.id]
  )
  assert.equal(store.getTabsOfSpace('work').length, 1)
})

test('sessão: toSessionFile e hydrateTab devolvem tudo dormente e sem áudio', () => {
  const store = makeStore()
  const first = store.getTabsOfSpace('personal')[0]
  store.patchTab(first.id, {
    dormant: false,
    audible: true,
    loading: true,
    title: 'A'
  })
  const file = toSessionFile(store.state, store.closed)
  assert.equal(file.version, 1)
  assert.equal(file.tabs.length, 4)
  const restored = hydrateTab(file.tabs.find(tab => tab.id === first.id)!)
  assert.equal(restored.dormant, true)
  assert.equal(restored.audible, false)
  assert.equal(restored.loading, false)
  assert.equal(restored.title, 'A')
  const blank = hydrateTab({ ...file.tabs[0], url: '' })
  assert.equal(blank.dormant, false)
})

test('tela cheia, tema, sidebar efetiva e overlay avisam só a shell (view)', () => {
  const store = makeStore()
  const changes: StoreChange[] = []
  store.subscribe(change => changes.push(change))
  store.setFullscreen(true)
  store.setFullscreen(true)
  store.setTheme('dark')
  store.setEffectiveSidebar('compact')
  store.setEffectiveSidebar('compact')
  assert.equal(store.setOverlay('tooltip', true), true)
  assert.equal(store.setOverlay('tooltip', true), false)
  assert.deepEqual(changes, [
    { kind: 'view' },
    { kind: 'view' },
    { kind: 'view' },
    { kind: 'view' }
  ])
  assert.equal(store.state.fullscreen, true)
  assert.deepEqual(store.state.overlay, ['tooltip'])
})

test('o motivo de overlay que perde o sentido sai junto com a mudança de modo', () => {
  const store = makeStore()
  store.setSidebar('hidden')
  store.setEffectiveSidebar('hidden')
  store.setOverlay('peek', true)
  assert.deepEqual(store.state.overlay, ['peek'])
  store.setSidebar('open')
  assert.deepEqual(store.state.overlay, [])

  store.setEffectiveSidebar('compact')
  store.setOverlay('tooltip', true)
  store.setEffectiveSidebar('open')
  assert.deepEqual(store.state.overlay, [])
})

test('moveTabToSpace: vai para o topo do outro espaço, dormente e sem estado vivo', () => {
  const store = makeStore()
  const tab = store.getTabsOfSpace('personal')[1]
  store.patchTab(tab.id, {
    dormant: false,
    audible: true,
    loading: true,
    canGoBack: true,
    error: { code: -105, description: 'ERR_NAME_NOT_RESOLVED' }
  })
  store.moveTabToSpace(tab.id, 'work')
  assert.equal(tab.spaceId, 'work')
  assert.equal(store.getTabsOfSpace('work')[0].id, tab.id)
  assert.equal(store.getTabsOfSpace('personal').length, 2)
  assert.equal(tab.dormant, true)
  assert.equal(tab.audible, false)
  assert.equal(tab.loading, false)
  assert.equal(tab.canGoBack, false)
  assert.equal(tab.error, null)
})

test('setFavoriteFavicon: grava o ícone, avisa a shell e não repete o aviso', () => {
  const store = makeStore()
  const changes: StoreChange[] = []
  store.subscribe(change => changes.push(change))
  const favorite = store.getSpace('personal')!.favorites[0]
  assert.equal(favorite.favicon, null)

  store.setFavoriteFavicon('personal', favorite.id, 'data:image/png;base64,AA')
  assert.equal(favorite.favicon, 'data:image/png;base64,AA')
  assert.deepEqual(changes, [{ kind: 'structure' }])

  store.setFavoriteFavicon('personal', favorite.id, 'data:image/png;base64,AA')
  store.setFavoriteFavicon('personal', 'nao-existe', 'data:image/png;base64,BB')
  assert.equal(changes.length, 1)
})

test('fillFavoriteFavicons: só favoritos sem ícone e do mesmo site (www à parte), em todos os espaços', () => {
  const store = makeStore()
  const [gmail, calendar, github] = store.getSpace('personal')!.favorites
  const workGithub = store
    .getSpace('work')!
    .favorites.find(favorite => favorite.id === 'w-github')!
  github.favicon = 'data:image/png;base64,GH'
  const changes: StoreChange[] = []
  store.subscribe(change => changes.push(change))

  store.fillFavoriteFavicons(
    'https://www.github.com/x',
    'data:image/png;base64,NEW'
  )
  assert.equal(github.favicon, 'data:image/png;base64,GH')
  assert.equal(workGithub.favicon, 'data:image/png;base64,NEW')
  assert.deepEqual(changes, [{ kind: 'structure' }])

  store.fillFavoriteFavicons(
    'https://calendar.google.com/calendar/r',
    'data:image/png;base64,CAL'
  )
  assert.equal(calendar.favicon, 'data:image/png;base64,CAL')
  assert.equal(gmail.favicon, null)
  assert.equal(changes.length, 2)

  store.fillFavoriteFavicons('sem-host', 'data:image/png;base64,X')
  assert.equal(changes.length, 2)
})
