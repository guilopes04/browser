import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Input, WebContents, WebContentsView } from 'electron'
import {
  keyOf,
  matchShortcut,
  type KeyInput
} from '../src/shared/match-shortcut'
import {
  FIXED_SHORTCUTS,
  getSpaceShortcuts,
  getTabShortcuts
} from '../src/shared/shortcuts'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import { handleEarlyShortcut } from '../src/main/functions/handle-early-shortcut'
import { fakeContext } from './fake-main'

const ALL = [...FIXED_SHORTCUTS, ...getTabShortcuts(), ...getSpaceShortcuts(9)]

const key = (over: Partial<KeyInput>): KeyInput => ({
  key: '',
  code: '',
  shift: false,
  control: false,
  alt: false,
  meta: false,
  ...over
})

const command = (input: Partial<KeyInput>) =>
  matchShortcut(key(input), ALL)?.command ?? null

test('todo atalho da tabela casa com a própria tecla (o menu e o main usam a mesma lista)', () => {
  for (const shortcut of ALL) {
    const parts = shortcut.accelerator.split('+')
    const last = parts[parts.length - 1] === '' ? '-' : parts[parts.length - 1]
    const name = last === 'Plus' ? '+' : last === 'Tab' ? 'Tab' : last
    const input = key({
      key: name,
      meta: parts.includes('CmdOrCtrl'),
      control: parts.includes('Ctrl'),
      shift: parts.includes('Shift')
    })
    assert.equal(
      matchShortcut(input, ALL)?.command,
      shortcut.command,
      shortcut.accelerator
    )
  }
})

test('os atalhos da lista da frente: ⌘W ⌘R ⌘[ ⌘] ⌘S ⌘1…⌘9 ⌃Tab ⌃⇧Tab ⇧⌘T ⌘K ⌘L ⌘T ⌘+ ⌘- ⌘0', () => {
  assert.equal(command({ key: 'w', code: 'KeyW', meta: true }), 'close-tab')
  assert.equal(command({ key: 'r', code: 'KeyR', meta: true }), 'reload')
  assert.equal(command({ key: '[', code: 'BracketLeft', meta: true }), 'back')
  assert.equal(
    command({ key: ']', code: 'BracketRight', meta: true }),
    'forward'
  )
  assert.equal(
    command({ key: 's', code: 'KeyS', meta: true }),
    'toggle-sidebar'
  )
  assert.equal(
    command({ key: 'T', code: 'KeyT', meta: true, shift: true }),
    'reopen-tab'
  )
  assert.equal(command({ key: 't', code: 'KeyT', meta: true }), 'new-tab')
  assert.equal(command({ key: 'k', code: 'KeyK', meta: true }), 'palette')
  assert.equal(command({ key: 'l', code: 'KeyL', meta: true }), 'focus-address')
  assert.equal(command({ key: 'Tab', code: 'Tab', control: true }), 'next-tab')
  assert.equal(
    command({ key: 'Tab', code: 'Tab', control: true, shift: true }),
    'prev-tab'
  )
  for (let n = 1; n <= 9; n++) {
    assert.equal(
      command({ key: String(n), code: `Digit${n}`, meta: true }),
      `tab-${n}`
    )
    assert.equal(
      command({ key: String(n), code: `Digit${n}`, control: true }),
      `space-${n}`
    )
  }
  assert.equal(command({ key: '0', code: 'Digit0', meta: true }), 'zoom-reset')
  assert.equal(command({ key: '-', code: 'Minus', meta: true }), 'zoom-out')
})

test('zoom: ⌘+ (com ⇧), ⌘= e ⌘− aumentam e diminuem', () => {
  assert.equal(
    command({ key: '+', code: 'Equal', meta: true, shift: true }),
    'zoom-in'
  )
  assert.equal(command({ key: '=', code: 'Equal', meta: true }), 'zoom-in')
  assert.equal(command({ key: '-', code: 'Minus', meta: true }), 'zoom-out')
})

test('o que não é atalho passa para a página', () => {
  // sem ⌘
  assert.equal(command({ key: 'w', code: 'KeyW' }), null)
  assert.equal(command({ key: 'Tab', code: 'Tab' }), null)
  assert.equal(command({ key: '1', code: 'Digit1' }), null)
  // ⌥ nunca
  assert.equal(command({ key: 'w', code: 'KeyW', meta: true, alt: true }), null)
  // ⇧⌘W não é atalho (⌘W é)
  assert.equal(
    command({ key: 'W', code: 'KeyW', meta: true, shift: true }),
    null
  )
  // ⌘Tab é do sistema; ⌘C é da página
  assert.equal(command({ key: 'Tab', code: 'Tab', meta: true }), null)
  assert.equal(command({ key: 'c', code: 'KeyC', meta: true }), null)
  // ⌃W não é ⌘W
  assert.equal(command({ key: 'w', code: 'KeyW', control: true }), null)
})

test('teclado não latino: vale a posição física da tecla', () => {
  assert.equal(keyOf({ key: 'ц', code: 'KeyW' }), 'w')
  assert.equal(command({ key: 'ц', code: 'KeyW', meta: true }), 'close-tab')
  assert.equal(keyOf({ key: 'ç', code: 'Semicolon' }), 'ç')
})

// ---- o tratamento de ponta a ponta, com contexto de mentira ----

const input = (over: Partial<Input> = {}) =>
  ({
    type: 'keyDown',
    key: 'w',
    code: 'KeyW',
    meta: true,
    shift: false,
    control: false,
    alt: false,
    isAutoRepeat: false,
    isComposing: false,
    location: 0,
    modifiers: [],
    ...over
  }) as Input

function setup() {
  const env = fakeContext([
    'https://a.test/',
    'https://b.test/',
    'https://c.test/'
  ])
  const [a, b, c] = env.store.getTabsOfSpace('personal')
  const liveA = env.makeLive(a)
  env.store.setActiveTab('personal', a.id)
  env.ctx.attached.tabId = a.id
  env.ctx.attached.view = liveA.view as unknown as WebContentsView
  const events = { prevented: 0 }
  const event = {
    defaultPrevented: false,
    preventDefault() {
      events.prevented++
      this.defaultPrevented = true
    }
  }
  return { ...env, a, b, c, liveA, event, events }
}

test('⌘W na página: consumido (a página não o vê) e a aba fecha pelo app', () => {
  const env = setup()
  assert.equal(handleEarlyShortcut(env.ctx, env.event, input()), true)
  assert.equal(env.events.prevented, 1)
  assert.equal(env.ctx.closing.has(env.a.id), true)
  assert.equal(env.liveA.wc.closeCalls.length, 1)
})

test('o keyUp do atalho também some para a página, sem repetir o comando', () => {
  const env = setup()
  assert.equal(
    handleEarlyShortcut(env.ctx, env.event, input({ type: 'keyUp' })),
    true
  )
  assert.equal(env.events.prevented, 1)
  assert.equal(env.ctx.closing.size, 0)
})

test('segurar ⌘W não fecha uma pilha de abas; segurar ⌘+ continua dando zoom', () => {
  const env = setup()
  assert.equal(
    handleEarlyShortcut(env.ctx, env.event, input({ isAutoRepeat: true })),
    true
  )
  assert.equal(env.ctx.closing.size, 0)
  assert.equal(env.events.prevented, 1)

  let zoom = 0
  const wc = env.liveA.wc as unknown as {
    getZoomLevel(): number
    setZoomLevel(n: number): void
  }
  wc.getZoomLevel = () => zoom
  wc.setZoomLevel = level => void (zoom = level)
  const plus = input({
    key: '+',
    code: 'Equal',
    shift: true,
    isAutoRepeat: true
  })
  handleEarlyShortcut(env.ctx, env.event, plus)
  handleEarlyShortcut(env.ctx, env.event, plus)
  assert.equal(zoom, 1)
})

test('⌘2 e ⌃Tab trocam de aba pela entrada da tecla', () => {
  const env = setup()
  env.makeLive(env.b)
  assert.equal(
    handleEarlyShortcut(
      env.ctx,
      env.event,
      input({ key: '2', code: 'Digit2' })
    ),
    true
  )
  assert.equal(env.store.getActiveTabId('personal'), env.b.id)
  assert.equal(
    handleEarlyShortcut(
      env.ctx,
      env.event,
      input({ key: 'Tab', code: 'Tab', meta: false, control: true })
    ),
    true
  )
  assert.notEqual(env.store.getActiveTabId('personal'), env.b.id)
})

test('tecla comum e ⌘C seguem para a página', () => {
  const env = setup()
  assert.equal(
    handleEarlyShortcut(
      env.ctx,
      env.event,
      input({ key: 'a', code: 'KeyA', meta: false })
    ),
    false
  )
  assert.equal(
    handleEarlyShortcut(env.ctx, env.event, input({ key: 'c', code: 'KeyC' })),
    false
  )
  assert.equal(env.events.prevented, 0)
})

test('composição de texto (tecla morta, IME) nunca é atalho', () => {
  const env = setup()
  assert.equal(
    handleEarlyShortcut(env.ctx, env.event, input({ isComposing: true })),
    false
  )
})

test('a página captura ⌘W, ⌘R e ⌃Tab com preventDefault: o app trata antes e ela não vê nada', () => {
  const env = setup()
  const wc = Object.assign(env.liveA.wc, {
    session: {},
    navigationHistory: { canGoBack: () => false, canGoForward: () => false },
    getTitle: () => '',
    reload() {}
  })
  attachTabEvents(env.ctx, env.a.id, wc as unknown as WebContents)
  const seenByPage: string[] = []
  // o before-input-event roda primeiro; o que não foi consumido vai para a página
  const deliver = (typed: Input) => {
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true
      }
    }
    wc.emit('before-input-event', event, typed)
    if (!event.defaultPrevented) seenByPage.push(`${typed.type}:${typed.key}`)
  }
  deliver(input())
  deliver(input({ type: 'keyUp' }))
  deliver(input({ key: 'r', code: 'KeyR' }))
  deliver(input({ key: 'Tab', code: 'Tab', meta: false, control: true }))
  // uma tecla comum chega
  deliver(input({ key: 'x', code: 'KeyX', meta: false }))
  assert.deepEqual(seenByPage, ['keyDown:x'])
  assert.equal(env.ctx.closing.has(env.a.id), true)
})
