import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import {
  GESTURE_WINDOW_MS,
  getLastGesture,
  hasRecentGesture,
  isActivationKey,
  isActivationPointer,
  markGesture
} from '../src/main/functions/user-gesture'
import { createWebGuard, resetViewState } from '../src/main/web-guard'
import { fakeContext } from './fake-main'

const key = (over: Partial<Parameters<typeof isActivationKey>[0]> = {}) => ({
  type: 'keyDown',
  key: 'a',
  meta: false,
  isAutoRepeat: false,
  ...over
})

test('só tecla de digitação vale como gesto: sem modificador, sem repetição, sem ⌘', () => {
  assert.equal(isActivationKey(key()), true)
  assert.equal(isActivationKey(key({ key: 'Enter' })), true)
  assert.equal(isActivationKey(key({ key: ' ' })), true)
  for (const modifier of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
    assert.equal(isActivationKey(key({ key: modifier })), false, modifier)
  assert.equal(isActivationKey(key({ key: 'Escape' })), false)
  assert.equal(isActivationKey(key({ isAutoRepeat: true })), false)
  assert.equal(isActivationKey(key({ meta: true })), false)
  assert.equal(isActivationKey(key({ type: 'keyUp' })), false)
})

test('clique e toque valem; mover o mouse e rolar não', () => {
  for (const type of ['mouseDown', 'mouseUp', 'touchEnd'])
    assert.equal(isActivationPointer(type), true, type)
  for (const type of ['mouseMove', 'mouseWheel', 'gestureScrollBegin', 'char'])
    assert.equal(isActivationPointer(type), false, type)
})

test('o gesto vale por 5 segundos, por aba', () => {
  const guard = createWebGuard()
  assert.equal(hasRecentGesture(guard, 'a', 1000), false)
  markGesture(guard, 'a', 1000)
  assert.equal(getLastGesture(guard, 'a'), 1000)
  assert.equal(hasRecentGesture(guard, 'a', 1000 + GESTURE_WINDOW_MS), true)
  assert.equal(hasRecentGesture(guard, 'a', 1001 + GESTURE_WINDOW_MS), false)
  assert.equal(hasRecentGesture(guard, 'b', 1000), false)
  // relógio que anda para trás não cria gesto no futuro
  assert.equal(hasRecentGesture(guard, 'a', 500), false)
})

test('a view destruída zera os gestos da aba', () => {
  const guard = createWebGuard()
  markGesture(guard, 'a', 10)
  resetViewState(guard, 'a')
  assert.equal(getLastGesture(guard, 'a'), undefined)
})

test('os eventos da aba registram gesto: tecla que chegou à página e clique', () => {
  const env = fakeContext(['https://a.com'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  const wc = Object.assign(live.wc, {
    session: {},
    navigationHistory: { canGoBack: () => false, canGoForward: () => false },
    getTitle: () => ''
  })
  attachTabEvents(env.ctx, tab.id, wc as unknown as WebContents)
  const input = (over: object = {}) => ({
    type: 'keyDown',
    key: 'x',
    code: 'KeyX',
    meta: false,
    shift: false,
    control: false,
    alt: false,
    isAutoRepeat: false,
    ...over
  })
  const event = (defaultPrevented = false) => ({
    defaultPrevented,
    preventDefault() {
      this.defaultPrevented = true
    }
  })

  // ⌘C é comando, não digitação: não é gesto
  wc.emit('before-input-event', event(), input({ key: 'c', meta: true }))
  assert.equal(getLastGesture(env.ctx.guard, tab.id), undefined)

  wc.emit('before-input-event', event(), input())
  assert.ok(getLastGesture(env.ctx.guard, tab.id) !== undefined)

  env.ctx.guard.gestures.clear()
  wc.emit('input-event', {}, { type: 'mouseMove' })
  assert.equal(getLastGesture(env.ctx.guard, tab.id), undefined)
  wc.emit('input-event', {}, { type: 'mouseDown' })
  assert.ok(getLastGesture(env.ctx.guard, tab.id) !== undefined)

  // a paleta abrindo repassa a tecla à shell (preventDefault): a página não a recebeu
  env.ctx.guard.gestures.clear()
  env.ctx.keyGate = {
    target: { kind: 'palette' },
    openedAt: Date.now(),
    readyAt: null
  }
  wc.emit('before-input-event', event(), input())
  assert.equal(getLastGesture(env.ctx.guard, tab.id), undefined)
})
