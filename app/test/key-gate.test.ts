import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Input } from 'electron'
import type { KeyGateTarget } from '@shared/early-key'
import { createFindState, focusFind, replaceFindText } from '@shared/find-state'
import type { MainContext } from '../src/main/context'
import { forwardEarlyKey } from '../src/main/functions/forward-early-key'
import {
  closeKeyGate,
  getOpenKeyGate,
  markKeyGateReady,
  openKeyGate
} from '../src/main/functions/key-gate'

const PALETTE: KeyGateTarget = { kind: 'palette' }
const NEW_TAB: KeyGateTarget = { kind: 'new-tab', tabId: 'n1' }
const FIND: KeyGateTarget = { kind: 'find' }

function fakeContext() {
  const sent: { channel: string; payload: unknown }[] = []
  const ctx = {
    keyGate: null,
    broadcaster: {
      send: (channel: string, payload: unknown) =>
        sent.push({ channel, payload })
    }
  } as unknown as MainContext
  return { ctx, sent }
}

function press(key: string, extra: Partial<Input> = {}): Input {
  return {
    type: 'keyDown',
    key,
    meta: false,
    control: false,
    alt: false,
    shift: false,
    isComposing: false,
    ...extra
  } as Input
}

// devolve se a tecla foi consumida (preventDefault)
function feed(ctx: MainContext, input: Input): boolean {
  let consumed = false
  forwardEarlyKey(ctx, { preventDefault: () => (consumed = true) }, input)
  return consumed
}

test('o portão fica aberto até o teto de 600 ms', () => {
  const { ctx } = fakeContext()
  assert.equal(getOpenKeyGate(ctx), null)
  openKeyGate(ctx, NEW_TAB)
  const openedAt = ctx.keyGate?.openedAt ?? 0
  assert.deepEqual(getOpenKeyGate(ctx, openedAt + 599), NEW_TAB)
  assert.equal(getOpenKeyGate(ctx, openedAt + 601), null)
})

test('o portão da busca espera até 2 s: a barra é um renderer novo a cada ⌘F', () => {
  const { ctx } = fakeContext()
  openKeyGate(ctx, FIND)
  const openedAt = ctx.keyGate?.openedAt ?? 0
  assert.deepEqual(getOpenKeyGate(ctx, openedAt + 1500), FIND)
  assert.equal(getOpenKeyGate(ctx, openedAt + 2001), null)
  // pronta a caixa, fecha 100 ms depois, como os outros
  markKeyGateReady(ctx, FIND)
  const readyAt = ctx.keyGate?.readyAt ?? 0
  assert.equal(getOpenKeyGate(ctx, readyAt + 110), null)
})

test('com o aviso da shell, fecha 100 ms depois', () => {
  const { ctx } = fakeContext()
  openKeyGate(ctx, PALETTE)
  markKeyGateReady(ctx, PALETTE)
  const readyAt = ctx.keyGate?.readyAt ?? 0
  assert.notEqual(readyAt, 0)
  assert.deepEqual(getOpenKeyGate(ctx, readyAt + 90), PALETTE)
  assert.equal(getOpenKeyGate(ctx, readyAt + 110), null)
})

test('o aviso de outro alvo não fecha o portão (a Nova aba que já estava na tela)', () => {
  const { ctx } = fakeContext()
  openKeyGate(ctx, NEW_TAB)
  markKeyGateReady(ctx, PALETTE)
  markKeyGateReady(ctx, { kind: 'new-tab', tabId: 'outra' })
  assert.equal(ctx.keyGate?.readyAt, null)
  markKeyGateReady(ctx, NEW_TAB)
  assert.notEqual(ctx.keyGate?.readyAt, null)
})

test('closeKeyGate sem tipo fecha qualquer portão; com tipo, só o desse tipo', () => {
  const { ctx } = fakeContext()
  openKeyGate(ctx, NEW_TAB)
  closeKeyGate(ctx, 'palette')
  assert.deepEqual(getOpenKeyGate(ctx), NEW_TAB)
  closeKeyGate(ctx, 'new-tab')
  assert.equal(ctx.keyGate, null)
  openKeyGate(ctx, PALETTE)
  closeKeyGate(ctx)
  assert.equal(ctx.keyGate, null)
})

test('com o portão aberto, a tecla é consumida e repassada com o alvo', () => {
  const { ctx, sent } = fakeContext()
  openKeyGate(ctx, NEW_TAB)
  assert.equal(feed(ctx, press('a')), true)
  assert.equal(feed(ctx, press('Enter')), true)
  assert.deepEqual(sent, [
    {
      channel: 'keys:early',
      payload: {
        target: NEW_TAB,
        key: { key: 'a', alt: false, meta: false, shift: false }
      }
    },
    {
      channel: 'keys:early',
      payload: {
        target: NEW_TAB,
        key: { key: 'Enter', alt: false, meta: false, shift: false }
      }
    }
  ])
})

test('portão fechado: nenhuma tecla é tocada', () => {
  const { ctx, sent } = fakeContext()
  assert.equal(feed(ctx, press('a')), false)
  assert.equal(feed(ctx, press('ArrowLeft')), false)
  assert.deepEqual(sent, [])
})

test('← → Delete Home End são descartados (nem a página nem a shell as veem)', () => {
  const { ctx, sent } = fakeContext()
  openKeyGate(ctx, PALETTE)
  for (const key of ['ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'])
    assert.equal(feed(ctx, press(key)), true)
  assert.deepEqual(sent, [])
})

test('atalhos, modificadores e soltar de tecla seguem o caminho normal', () => {
  const { ctx, sent } = fakeContext()
  openKeyGate(ctx, PALETTE)
  assert.equal(feed(ctx, press('c', { meta: true })), false)
  assert.equal(feed(ctx, press('Shift', { shift: true })), false)
  assert.equal(feed(ctx, press('a', { type: 'keyUp' })), false)
  assert.deepEqual(sent, [])
  assert.deepEqual(getOpenKeyGate(ctx), PALETTE)
})

test('tecla morta ou IME fecha o portão: o resto da palavra é do campo', () => {
  const { ctx, sent } = fakeContext()
  openKeyGate(ctx, PALETTE)
  assert.equal(feed(ctx, press('Dead')), false)
  assert.equal(ctx.keyGate, null)
  assert.equal(feed(ctx, press('a')), false)
  assert.deepEqual(sent, [])
})

// a busca na página aberta, sem view nem aba (o estado da busca é o que importa aqui)
function findContext() {
  const { ctx, sent } = fakeContext()
  Object.assign(ctx, {
    views: new Map(),
    store: { state: { theme: 'light' } },
    win: { isDestroyed: () => true },
    attached: { tabId: null, view: null },
    find: {
      tabId: 't1',
      view: { webContents: { isDestroyed: () => true } },
      state: createFindState(),
      ready: false,
      cssKey: null,
      refreshOnLoad: false,
      lastSent: ''
    }
  })
  return { ctx, sent }
}

test('portão da busca: as teclas entram no texto da busca, no main, e não vão à shell', () => {
  const { ctx, sent } = findContext()
  openKeyGate(ctx, FIND)
  for (const key of ['c', 'a', 'f']) assert.equal(feed(ctx, press(key)), true)
  assert.equal(ctx.find?.state.text, 'caf')
  assert.equal(feed(ctx, press('é', { alt: true })), true)
  assert.equal(feed(ctx, press('Backspace')), true)
  assert.equal(ctx.find?.state.text, 'caf')
  // cada troca de texto pelo main vira revisão nova para a caixa adotar
  assert.equal(ctx.find?.state.textRevision, 5)
  assert.deepEqual(sent, [])
})

test('portão da busca: esc fecha a busca; ← é descartada; ⌘ segue o caminho normal', () => {
  const { ctx } = findContext()
  openKeyGate(ctx, FIND)
  assert.equal(feed(ctx, press('ArrowLeft')), true)
  assert.equal(feed(ctx, press('c', { meta: true })), false)
  assert.notEqual(ctx.find, null)
  assert.equal(feed(ctx, press('Escape')), true)
  assert.equal(ctx.find, null)
})

test('portão da busca: o texto selecionado (seleção da página) é substituído pela primeira tecla', () => {
  const { ctx } = findContext()
  openKeyGate(ctx, FIND)
  const session = ctx.find as NonNullable<typeof ctx.find>
  session.state = focusFind(replaceFindText(session.state, 'abacaxi'))
  assert.equal(feed(ctx, press('b')), true)
  assert.equal(session.state.text, 'b')
  assert.equal(feed(ctx, press('a')), true)
  assert.equal(session.state.text, 'ba')
})
