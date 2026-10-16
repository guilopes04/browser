import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IpcMainEvent, WebContents } from 'electron'
import {
  LINK_CLICK_WINDOW_MS,
  MAX_FRAME_GESTURES,
  hasLinkClick,
  markFrameGesture,
  markLinkClick,
  readLinkUrl
} from '../src/main/functions/frame-gesture'
import { frameKey } from '../src/main/functions/snapshot-frames'
import {
  GESTURE_WINDOW_MS,
  hasRecentGesture
} from '../src/main/functions/user-gesture'
import {
  recordFrameGesture,
  recordLinkClick
} from '../src/main/services/frame-gestures'
import { createWebGuard, resetDocumentState } from '../src/main/web-guard'
import { fakeContext } from './fake-main'

test('o relato de um quadro guarda quando e onde, um por quadro, e é o gesto da aba', () => {
  const guard = createWebGuard()
  markFrameGesture(guard, 't1', { key: '1:a', origin: 'https://a.test' }, 1000)
  markFrameGesture(guard, 't1', { key: '2:b', origin: 'https://b.test' }, 1500)
  // o mesmo quadro de novo troca o relato em vez de acumular
  markFrameGesture(guard, 't1', { key: '1:a', origin: 'https://a.test' }, 2000)
  assert.deepEqual(guard.frameGestures.get('t1'), [
    { at: 1500, key: '2:b', origin: 'https://b.test' },
    { at: 2000, key: '1:a', origin: 'https://a.test' }
  ])
  // o iframe de outra origem recebe o clique direto: o main só sabe por este relato
  assert.equal(hasRecentGesture(guard, 't1', 2500), true)
  assert.equal(
    hasRecentGesture(guard, 't1', 2000 + GESTURE_WINDOW_MS + 1),
    false
  )
  // outra aba não é afetada
  assert.equal(guard.frameGestures.has('t2'), false)
})

test('os relatos vencidos saem e a lista tem teto', () => {
  const guard = createWebGuard()
  markFrameGesture(
    guard,
    't',
    { key: '1:velho', origin: 'https://v.test' },
    1000
  )
  markFrameGesture(
    guard,
    't',
    { key: '1:novo', origin: 'https://n.test' },
    1000 + GESTURE_WINDOW_MS + 1
  )
  assert.deepEqual(
    guard.frameGestures.get('t')?.map(gesture => gesture.key),
    ['1:novo']
  )
  for (let n = 0; n < MAX_FRAME_GESTURES + 10; n++)
    markFrameGesture(
      guard,
      'cheia',
      { key: `1:q${n}`, origin: 'https://x.test' },
      5000 + n
    )
  assert.equal(guard.frameGestures.get('cheia')?.length, MAX_FRAME_GESTURES)
  // ficam os mais novos
  assert.equal(
    guard.frameGestures.get('cheia')?.at(-1)?.key,
    `1:q${MAX_FRAME_GESTURES + 9}`
  )
})

test('o clique em link vale para aquela URL, por pouco tempo', () => {
  const guard = createWebGuard()
  markLinkClick(guard, 't', 'https://externo.test/a', 10_000)
  assert.equal(hasLinkClick(guard, 't', 'https://externo.test/a', 10_500), true)
  assert.equal(
    hasLinkClick(guard, 't', 'https://externo.test/b', 10_500),
    false
  )
  assert.equal(
    hasLinkClick(guard, 'outra', 'https://externo.test/a', 10_500),
    false
  )
  assert.equal(
    hasLinkClick(
      guard,
      't',
      'https://externo.test/a',
      10_000 + LINK_CLICK_WINDOW_MS + 1
    ),
    false
  )
  // relógio para trás não vale
  assert.equal(hasLinkClick(guard, 't', 'https://externo.test/a', 9_000), false)
})

test('a mensagem do preload vem da página: só texto, e curto', () => {
  assert.equal(readLinkUrl({ url: 'https://a.test/x' }), 'https://a.test/x')
  assert.equal(readLinkUrl({ url: 'x'.repeat(5000) })?.length, 2048)
  for (const bad of [
    null,
    undefined,
    'texto',
    42,
    {},
    { url: '' },
    { url: 7 },
    { url: {} }
  ])
    assert.equal(readLinkUrl(bad), null, JSON.stringify(bad))
})

test('o documento novo da aba apaga o relato de quadro e o clique em link', () => {
  const guard = createWebGuard()
  markFrameGesture(guard, 't', { key: '1:a', origin: 'https://a.test' })
  markLinkClick(guard, 't', 'https://x.test/')
  resetDocumentState(guard, 't')
  assert.equal(guard.frameGestures.has('t'), false)
  assert.equal(guard.linkClicks.has('t'), false)
  assert.equal(guard.gestures.has('t'), false)
})

function setup() {
  const env = fakeContext(['https://pagina.test/'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  const frame = {
    processId: 7,
    frameToken: 'TOKEN',
    origin: 'https://anuncio.test',
    url: 'https://anuncio.test/x',
    parent: null
  }
  const event = (sender: unknown, senderFrame: unknown = frame) =>
    ({ sender, senderFrame }) as unknown as IpcMainEvent
  return { ...env, tab, live, frame, event }
}

test('IPC do preload: o quadro vem do Chromium (senderFrame) e a aba, do webContents', () => {
  const env = setup()
  recordFrameGesture(env.ctx, env.event(env.live.wc))
  assert.equal(frameKey(env.frame), '7:TOKEN')
  const [gesture] = env.ctx.guard.frameGestures.get(env.tab.id) ?? []
  assert.equal(gesture.key, '7:TOKEN')
  assert.equal(gesture.origin, 'https://anuncio.test')
  assert.equal(hasRecentGesture(env.ctx.guard, env.tab.id), true)

  recordLinkClick(env.ctx, env.event(env.live.wc), {
    url: 'https://dest.test/p'
  })
  assert.equal(
    env.ctx.guard.linkClicks.get(env.tab.id)?.url,
    'https://dest.test/p'
  )
})

test('IPC do preload: webContents que não é de aba, quadro sumido e mensagem torta não registram nada', () => {
  const env = setup()
  const shell = {} as unknown as WebContents
  recordFrameGesture(env.ctx, env.event(shell))
  recordFrameGesture(env.ctx, env.event(env.live.wc, null))
  recordLinkClick(env.ctx, env.event(shell), { url: 'https://dest.test/p' })
  recordLinkClick(env.ctx, env.event(env.live.wc), { url: 42 })
  recordLinkClick(env.ctx, env.event(env.live.wc), null)
  assert.equal(env.ctx.guard.frameGestures.size, 0)
  assert.equal(env.ctx.guard.linkClicks.size, 0)
  assert.equal(env.ctx.guard.gestures.size, 0)
})
