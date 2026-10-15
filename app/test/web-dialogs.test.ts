import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IpcMainEvent, WebContents } from 'electron'
import { dialog } from 'electron'
import {
  DIALOGS_BEFORE_OFFER,
  DIALOG_WINDOW_MS,
  decideDialog,
  recordDialogShown
} from '../src/main/functions/decide-dialog'
import { describeDialogOrigin } from '../src/main/functions/describe-dialog-origin'
import { attachTabEvents } from '../src/main/functions/attach-tab-events'
import {
  defaultAnswer,
  readDialogRequest
} from '../src/main/functions/read-dialog-request'
import { answerScriptDialog } from '../src/main/services/script-dialogs'
import { fakeContext } from './fake-main'

test('só a aba ativa mostra diálogo; ao fundo é descartado', () => {
  const now = 100_000
  assert.deepEqual(
    decideDialog(undefined, { isActive: true, windowVisible: true, now }),
    { action: 'show', offerBlock: false }
  )
  assert.deepEqual(
    decideDialog(undefined, { isActive: false, windowVisible: true, now }),
    { action: 'drop', reason: 'background' }
  )
  assert.deepEqual(
    decideDialog(undefined, { isActive: true, windowVisible: false, now }),
    { action: 'drop', reason: 'hidden' }
  )
  assert.deepEqual(
    decideDialog(
      { shownAt: [], blocked: true },
      { isActive: true, windowVisible: true, now }
    ),
    { action: 'drop', reason: 'blocked' }
  )
})

test('depois de 3 diálogos em 10 s, o próximo oferece "bloquear mais"', () => {
  let state = undefined as ReturnType<typeof recordDialogShown> | undefined
  const facts = (now: number) => ({ isActive: true, windowVisible: true, now })
  for (let n = 0; n < DIALOGS_BEFORE_OFFER; n++) {
    const decision = decideDialog(state, facts(1000 + n * 1000))
    assert.deepEqual(
      decision,
      { action: 'show', offerBlock: false },
      `diálogo ${n + 1}`
    )
    state = recordDialogShown(state, 1000 + n * 1000)
  }
  assert.deepEqual(decideDialog(state, facts(4000)), {
    action: 'show',
    offerBlock: true
  })
  // os primeiros saem da janela de 10 s: volta ao normal
  assert.deepEqual(decideDialog(state, facts(1000 + DIALOG_WINDOW_MS + 1500)), {
    action: 'show',
    offerBlock: false
  })
  assert.deepEqual(recordDialogShown(state, 20_000), {
    shownAt: [20_000],
    blocked: false
  })
})

test('origem do diálogo: host e porta do quadro, nunca algo que a página escolha', () => {
  const frame = (origin: string, url = '') => ({ origin, url })
  assert.equal(
    describeDialogOrigin(frame('http://127.0.0.1:9601')),
    '127.0.0.1:9601'
  )
  assert.equal(
    describeDialogOrigin(frame('https://app.exemplo.com.br')),
    'app.exemplo.com.br'
  )
  // origem opaca (sandbox): o endereço do quadro
  assert.equal(
    describeDialogOrigin(frame('null', 'https://a.test/x?y=1')),
    'a.test'
  )
  assert.equal(
    describeDialogOrigin(frame('file://', 'file:///tmp/a.html')),
    'Arquivo local'
  )
  assert.equal(
    describeDialogOrigin(frame('null', 'data:text/html,x')),
    'Este site'
  )
  assert.equal(describeDialogOrigin(frame('', '')), 'Este site')
  assert.equal(describeDialogOrigin(null), 'Este site')
})

test('a mensagem do preload é validada e limitada', () => {
  assert.equal(readDialogRequest(null), null)
  assert.equal(readDialogRequest('x'), null)
  assert.equal(readDialogRequest({ kind: 'print', message: 'x' }), null)
  assert.deepEqual(
    readDialogRequest({ kind: 'alert', message: 'oi', fallback: '' }),
    {
      kind: 'alert',
      message: 'oi',
      fallback: ''
    }
  )
  const huge = readDialogRequest({
    kind: 'confirm',
    message: 'x'.repeat(10_000_000)
  })
  assert.equal(huge?.message.length, 2000)
  assert.equal(readDialogRequest({ kind: 'alert', message: 5 })?.message, '')
  assert.equal(defaultAnswer('confirm'), false)
  assert.equal(defaultAnswer('alert'), null)
  assert.equal(defaultAnswer('prompt'), null)
})

// ---- o serviço, com ctx, abas e diálogo de mentira ----

interface Shown {
  message?: string
  detail?: string
  buttons?: string[]
  checkboxLabel?: string
  signal?: AbortSignal
}

function setup() {
  const env = fakeContext(['https://ativa.test/', 'https://fundo.test/'])
  const [active, background] = env.store.getTabsOfSpace('personal')
  const liveActive = env.makeLive(active)
  const liveBack = env.makeLive(background)
  env.store.setActiveTab('personal', active.id)
  env.ctx.attached.tabId = active.id
  const shown: Shown[] = []
  let next = { response: 0, checkboxChecked: false }
  const stub = dialog as unknown as {
    showMessageBox: (...args: unknown[]) => Promise<unknown>
  }
  stub.showMessageBox = async (...args: unknown[]) => {
    shown.push(args[args.length - 1] as Shown)
    return next
  }
  const wcOf = (live: { wc: object }) =>
    Object.assign(live.wc, {
      off() {},
      session: {},
      navigationHistory: { canGoBack: () => false, canGoForward: () => false },
      getTitle: () => ''
    })
  const eventFor = (
    live: { wc: object },
    origin = 'http://127.0.0.1:9601'
  ): IpcMainEvent =>
    ({
      sender: wcOf(live),
      senderFrame: { origin, url: `${origin}/pagina` }
    }) as unknown as IpcMainEvent
  const ask = (live: { wc: object }, kind: string, message = 'texto') =>
    answerScriptDialog(env.ctx, eventFor(live), { kind, message, fallback: '' })
  return {
    ...env,
    active,
    background,
    liveActive,
    liveBack,
    shown,
    ask,
    answer: (response: number, checkboxChecked = false) => {
      next = { response, checkboxChecked }
    }
  }
}

test('alert da aba ativa: diálogo nativo com a origem, um botão, e a página recebe null', async () => {
  const env = setup()
  const result = await env.ask(env.liveActive, 'alert', 'Olá do site')
  assert.equal(result, null)
  assert.equal(env.shown.length, 1)
  assert.equal(env.shown[0].message, '127.0.0.1:9601 diz:')
  assert.equal(env.shown[0].detail, 'Olá do site')
  assert.deepEqual(env.shown[0].buttons, ['OK'])
  assert.equal(env.shown[0].checkboxLabel, undefined)
})

test('confirm: OK devolve true, Cancelar devolve false', async () => {
  const env = setup()
  env.answer(0)
  assert.equal(await env.ask(env.liveActive, 'confirm'), true)
  assert.deepEqual(env.shown[0].buttons, ['OK', 'Cancelar'])
  env.answer(1)
  assert.equal(await env.ask(env.liveActive, 'confirm'), false)
})

test('aba em segundo plano: nada aparece, a página recebe o retorno padrão e a aba ganha o marcador', async () => {
  const env = setup()
  env.answer(0)
  assert.equal(await env.ask(env.liveBack, 'confirm'), false)
  assert.equal(await env.ask(env.liveBack, 'alert'), null)
  assert.equal(env.shown.length, 0)
  assert.equal(env.store.getTab(env.background.id)?.dialogBlocked, true)
  assert.equal(env.store.getTab(env.active.id)?.dialogBlocked, false)
})

test('janela escondida (botão vermelho): o diálogo é descartado, sem travar o app', async () => {
  const env = setup()
  env.ctx.win.hide()
  assert.equal(await env.ask(env.liveActive, 'confirm'), false)
  assert.equal(env.shown.length, 0)
})

test('depois de 3 em 10 s, a caixa "Bloquear mais diálogos deste site"; marcada, a aba se cala até recarregar', async () => {
  const env = setup()
  for (let n = 0; n < 3; n++)
    await env.ask(env.liveActive, 'alert', `alerta ${n}`)
  assert.equal(env.shown.length, 3)
  assert.ok(env.shown.every(box => box.checkboxLabel === undefined))

  env.answer(0, true)
  await env.ask(env.liveActive, 'alert', 'quarto')
  assert.equal(env.shown.length, 4)
  assert.equal(env.shown[3].checkboxLabel, 'Bloquear mais diálogos deste site')

  // bloqueado: nada mais aparece, nem marcador (foi o usuário quem pediu)
  assert.equal(await env.ask(env.liveActive, 'confirm'), false)
  assert.equal(env.shown.length, 4)
  assert.equal(env.store.getTab(env.active.id)?.dialogBlocked, false)

  // recarregou: volta ao normal
  attachTabEvents(
    env.ctx,
    env.active.id,
    env.liveActive.wc as unknown as WebContents
  )
  env.liveActive.wc.emit('did-navigate')
  env.answer(0)
  await env.ask(env.liveActive, 'alert', 'depois de recarregar')
  assert.equal(env.shown.length, 5)
  assert.equal(env.shown[4].checkboxLabel, undefined)
})

test('a caixa desmarcada não cala a aba', async () => {
  const env = setup()
  for (let n = 0; n < 5; n++) await env.ask(env.liveActive, 'alert')
  assert.equal(env.shown.length, 5)
})

test('prompt não tem campo de texto no diálogo nativo: devolve null, sem diálogo', async () => {
  const env = setup()
  assert.equal(await env.ask(env.liveActive, 'prompt', 'seu nome?'), null)
  assert.equal(env.shown.length, 0)
})

test('mensagem inválida ou de quem não é aba: null, nunca um diálogo', async () => {
  const env = setup()
  assert.equal(
    await answerScriptDialog(env.ctx, eventOf({}), { kind: 'alert' }),
    null
  )
  assert.equal(await env.ask(env.liveActive, 'print'), null)
  assert.equal(
    await answerScriptDialog(env.ctx, eventOf(env.liveActive.wc), 'lixo'),
    null
  )
  assert.equal(env.shown.length, 0)
})

function eventOf(sender: object): IpcMainEvent {
  return { sender, senderFrame: null } as unknown as IpcMainEvent
}

test('a aba que morre com o diálogo na tela o fecha e a página recebe o padrão', async () => {
  const env = setup()
  const stub = dialog as unknown as {
    showMessageBox: (...args: unknown[]) => Promise<unknown>
  }
  stub.showMessageBox = (...args: unknown[]) =>
    new Promise(done => {
      const options = args[args.length - 1] as Shown
      options.signal?.addEventListener('abort', () =>
        done({ response: 1, checkboxChecked: false })
      )
    })
  const pending = env.ask(env.liveActive, 'confirm', 'vai sumir')
  await new Promise(done => setTimeout(done, 10))
  env.liveActive.wc.emit('destroyed')
  assert.equal(await pending, false)
})
