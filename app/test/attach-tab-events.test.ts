import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import { shouldFallbackToHttp } from '../src/main/functions/http-fallback-errors'
import { fakeContext } from './fake-main'

const FAIL = 'did-fail-load'

function setup() {
  const env = fakeContext(['https://expired.badssl.com/'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  const loaded: string[] = []
  const wc = Object.assign(live.wc, {
    session: {},
    navigationHistory: { canGoBack: () => false, canGoForward: () => false },
    loadURL: async (url: string) => void loaded.push(url),
    getTitle: () => ''
  })
  env.store.patchTab(tab.id, {
    title: 'Título do site anterior',
    favicon: 'data:image/png;base64,AAAA'
  })
  attachTabEvents(env.ctx, tab.id, wc as unknown as WebContents)
  return { ...env, tab, wc, loaded }
}

test('erros de servidor só-HTTP caem para http, inclusive ERR_EMPTY_RESPONSE e ERR_FAILED', () => {
  for (const code of [-2, -100, -101, -102, -107, -113, -324])
    assert.equal(shouldFallbackToHttp(code), true, `código ${code}`)
  for (const code of [-3, -105, -106, -200, -201, -501])
    assert.equal(shouldFallbackToHttp(code), false, `código ${code}`)
})

test('neverssl.com sem esquema: ERR_EMPTY_RESPONSE tenta http uma vez', () => {
  const { ctx, store, tab, wc, loaded } = setup()
  ctx.httpFallbacks.set(tab.id, {
    from: 'https://neverssl.com',
    to: 'http://neverssl.com'
  })
  wc.emit(FAIL, {}, -324, 'ERR_EMPTY_RESPONSE', 'https://neverssl.com/', true)
  assert.deepEqual(loaded, ['http://neverssl.com'])
  assert.equal(store.getTab(tab.id)?.error, null)

  // a segunda falha já é do http: vira página de erro, sem laço
  wc.emit(FAIL, {}, -324, 'ERR_EMPTY_RESPONSE', 'http://neverssl.com/', true)
  assert.equal(loaded.length, 1)
  assert.equal(store.getTab(tab.id)?.error?.code, -324)
})

test('endereço digitado com https explícito não cai para http', () => {
  const { store, tab, wc, loaded } = setup()
  wc.emit(FAIL, {}, -324, 'ERR_EMPTY_RESPONSE', 'https://neverssl.com/', true)
  assert.deepEqual(loaded, [])
  assert.equal(store.getTab(tab.id)?.error?.code, -324)
})

test('página de erro: título vira o host que falhou e o favicon volta ao padrão', () => {
  const { store, tab, wc } = setup()
  wc.emit(
    FAIL,
    {},
    -201,
    'ERR_CERT_DATE_INVALID',
    'https://expired.badssl.com/',
    true
  )
  const failed = store.getTab(tab.id)
  assert.equal(failed?.title, 'expired.badssl.com')
  assert.equal(failed?.favicon, null)
  assert.equal(failed?.error?.code, -201)

  // o documento de erro do Chromium não troca o título que a aba mostra
  wc.emit('page-title-updated', {}, 'Outro título')
  assert.equal(store.getTab(tab.id)?.title, 'expired.badssl.com')
})

test('subframe e ERR_ABORTED não viram erro de página', () => {
  const { store, tab, wc } = setup()
  wc.emit(FAIL, {}, -3, 'ERR_ABORTED', 'https://x.com/', true)
  wc.emit(FAIL, {}, -105, 'ERR_NAME_NOT_RESOLVED', 'https://ads.com/', false)
  assert.equal(store.getTab(tab.id)?.error, null)
  assert.equal(store.getTab(tab.id)?.title, 'Título do site anterior')
})
