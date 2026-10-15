import assert from 'node:assert/strict'
import { test } from 'node:test'
import { app, dialog, session } from 'electron'
import type { Certificate, Session } from 'electron'
import {
  describeCertificates,
  MAX_LISTED_CERTIFICATES,
  pickCertificate
} from '../src/main/functions/describe-certificates'
import { hardenSession } from '../src/main/functions/harden-session'
import {
  isPermissionAllowed,
  NO_PERMISSIONS,
  PAGE_PERMISSIONS
} from '../src/main/functions/permission-policy'
import { getSpaceSession } from '../src/main/functions/get-space-session'
import {
  enableAppSandbox,
  hardenDefaultSession,
  installAppHardening
} from '../src/main/services/app-hardening'
import {
  chooseClientCertificate,
  installClientCertificateDialog
} from '../src/main/services/client-certificate'

type Listener = (...args: any[]) => void

// sessão de mentira que guarda cada handler e ouvinte registrado
function recordingSession() {
  const handlers: Record<string, any> = {}
  const listeners: Record<string, Listener[]> = {}
  const ses = {
    getUserAgent: () => 'Mozilla/5.0 Chrome/1 Safari/1',
    setUserAgent() {},
    setPermissionRequestHandler: (fn: unknown) => (handlers.request = fn),
    setPermissionCheckHandler: (fn: unknown) => (handlers.check = fn),
    setDevicePermissionHandler: (fn: unknown) => (handlers.device = fn),
    setBluetoothPairingHandler: (fn: unknown) => (handlers.pairing = fn),
    resolveHost: async () => ({ endpoints: [] }),
    webRequest: {
      onBeforeRequest: (...args: unknown[]) => (handlers.before = args),
      onHeadersReceived: (...args: unknown[]) => (handlers.headers = args)
    },
    on: (event: string, fn: Listener) => {
      ;(listeners[event] ??= []).push(fn)
    }
  }
  return { ses: ses as unknown as Session, handlers, listeners }
}

function ask(handlers: Record<string, any>, permission: string): boolean {
  let answer: boolean | null = null
  handlers.request({}, permission, (granted: boolean) => (answer = granted))
  assert.notEqual(answer, null, 'o handler respondeu na hora')
  return answer as unknown as boolean
}

test('política de permissões: só tela cheia, copiar e travar o ponteiro passam nas páginas', () => {
  for (const permission of [
    'fullscreen',
    'clipboard-sanitized-write',
    'pointerLock'
  ])
    assert.equal(isPermissionAllowed(permission, PAGE_PERMISSIONS), true)
  for (const permission of [
    'media',
    'geolocation',
    'notifications',
    'clipboard-read',
    'midi',
    'midiSysex',
    'bluetooth',
    'hid',
    'usb',
    'serial',
    'display-capture',
    'openExternal',
    'idle-detection',
    'window-management',
    'unknown'
  ]) {
    assert.equal(
      isPermissionAllowed(permission, PAGE_PERMISSIONS),
      false,
      permission
    )
    assert.equal(isPermissionAllowed(permission, NO_PERMISSIONS), false)
  }
  // sessão que não é de página: nem tela cheia
  assert.equal(isPermissionAllowed('fullscreen', NO_PERMISSIONS), false)
})

test('hardenSession nega permissões, dispositivos e pareamento Bluetooth', () => {
  const { ses, handlers, listeners } = recordingSession()
  hardenSession(ses, NO_PERMISSIONS)

  assert.equal(ask(handlers, 'media'), false)
  assert.equal(ask(handlers, 'fullscreen'), false)
  assert.equal(handlers.check({}, 'geolocation'), false)
  assert.equal(handlers.device({ deviceType: 'usb' }), false)

  let pairing: unknown = null
  handlers.pairing({}, (response: unknown) => (pairing = response))
  assert.deepEqual(pairing, { confirmed: false })

  // HID, USB e porta serial: a escolha é cancelada sem diálogo
  for (const [event, args] of [
    ['select-hid-device', [{}, {}]],
    ['select-usb-device', [{}, {}]],
    ['select-serial-port', [{}, [{ portId: '1' }], {}]]
  ] as const) {
    let prevented = false
    let chosen: unknown = 'não chamado'
    const callback = (value?: unknown) => (chosen = value ?? null)
    const [first, ...rest] = args
    void first
    listeners[event][0](
      { preventDefault: () => (prevented = true) },
      ...rest,
      callback
    )
    assert.equal(prevented, true, event)
    assert.ok(chosen === null || chosen === '', `${event} não escolhe nada`)
  }
})

test('hardenSession de novo troca as permissões sem repetir os ouvintes', () => {
  const { ses, handlers, listeners } = recordingSession()
  hardenSession(ses, NO_PERMISSIONS)
  hardenSession(ses, PAGE_PERMISSIONS)
  assert.equal(ask(handlers, 'fullscreen'), true)
  assert.equal(ask(handlers, 'media'), false)
  assert.equal(listeners['select-hid-device'].length, 1)
})

test('sessão de espaço: permissões de página, sem câmera nem localização', () => {
  const { ses, handlers } = recordingSession()
  const original = session.fromPartition
  ;(session as any).fromPartition = () => ses
  try {
    getSpaceSession('espaco-teste-permissoes')
  } finally {
    ;(session as any).fromPartition = original
  }
  assert.equal(ask(handlers, 'fullscreen'), true)
  assert.equal(ask(handlers, 'clipboard-sanitized-write'), true)
  assert.equal(ask(handlers, 'pointerLock'), true)
  assert.equal(ask(handlers, 'media'), false)
  assert.equal(ask(handlers, 'geolocation'), false)
  assert.equal(ask(handlers, 'notifications'), false)
  assert.equal(handlers.check({}, 'media'), false)
  assert.equal(handlers.device({}), false)
})

test('app: sandbox antes do ready, sessões novas e a padrão sem permissão, sem webview nem Bluetooth', () => {
  const registered: Record<string, Listener> = {}
  const original = { on: app.on, enableSandbox: (app as any).enableSandbox }
  let sandboxed = 0
  ;(app as any).on = (event: string, fn: Listener) =>
    void (registered[event] = fn)
  ;(app as any).enableSandbox = () => void sandboxed++
  const defaults = recordingSession()
  const originalDefault = Object.getOwnPropertyDescriptor(
    session,
    'defaultSession'
  )
  Object.defineProperty(session, 'defaultSession', {
    value: defaults.ses,
    configurable: true
  })
  try {
    enableAppSandbox()
    installAppHardening()
    hardenDefaultSession()

    assert.equal(sandboxed, 1)
    assert.equal(
      ask(defaults.handlers, 'fullscreen'),
      false,
      'a sessão padrão não concede nada'
    )
    assert.equal(ask(defaults.handlers, 'media'), false)

    const created = recordingSession()
    registered['session-created'](created.ses)
    assert.equal(ask(created.handlers, 'geolocation'), false)

    // cada webContents novo: Bluetooth cancelado antes do TCC e <webview> proibido
    const contents: Record<string, Listener> = {}
    registered['web-contents-created'](
      {},
      { on: (e: string, fn: Listener) => void (contents[e] = fn) }
    )
    let prevented = 0
    let chosen: unknown = 'não chamado'
    contents['select-bluetooth-device'](
      { preventDefault: () => void prevented++ },
      [{ deviceId: 'AA:BB', deviceName: 'Fone' }],
      (id: string) => (chosen = id)
    )
    assert.equal(prevented, 1)
    assert.equal(chosen, '', 'callback("") cancela sem escolher dispositivo')
    contents['will-attach-webview']({ preventDefault: () => void prevented++ })
    assert.equal(prevented, 2)
  } finally {
    ;(app as any).on = original.on
    ;(app as any).enableSandbox = original.enableSandbox
    if (originalDefault)
      Object.defineProperty(session, 'defaultSession', originalDefault)
    else delete (session as any).defaultSession
  }
})

function cert(name: string, issuer: string): Certificate {
  return {
    subjectName: name,
    issuerName: issuer,
    subject: { commonName: name },
    issuer: { commonName: issuer }
  } as unknown as Certificate
}

test('diálogo de certificado: nome e emissor, Cancelar é o padrão', () => {
  const list = [cert('Gilas', 'AC Corp'), cert('Gilas Pessoal', 'AC Pessoal')]
  const dialogOptions = describeCertificates(
    'https://banco.example.com/login',
    list
  )
  assert.equal(
    dialogOptions.message,
    'banco.example.com pede um certificado para identificar você'
  )
  assert.deepEqual(dialogOptions.buttons, [
    'Gilas (emitido por AC Corp)',
    'Gilas Pessoal (emitido por AC Pessoal)',
    'Cancelar'
  ])
  assert.equal(dialogOptions.defaultId, 2)
  assert.equal(dialogOptions.cancelId, 2)
  assert.equal(pickCertificate(list, 1, dialogOptions.listed), list[1])
  assert.equal(pickCertificate(list, 2, dialogOptions.listed), undefined)
  assert.equal(pickCertificate(list, -1, dialogOptions.listed), undefined)
})

test('diálogo de certificado: lista longa mostra só os primeiros', () => {
  const list = Array.from({ length: 10 }, (_, i) => cert(`C${i}`, 'AC'))
  const options = describeCertificates('https://x.example/', list)
  assert.equal(options.listed, MAX_LISTED_CERTIFICATES)
  assert.equal(options.buttons.length, MAX_LISTED_CERTIFICATES + 1)
  assert.ok(options.detail.includes('4 certificados não aparecem'))
  // o botão de Cancelar nunca vira um certificado
  assert.equal(
    pickCertificate(list, MAX_LISTED_CERTIFICATES, options.listed),
    undefined
  )
})

test('select-client-certificate: preventDefault e só entrega o que o usuário escolhe', async () => {
  const registered: Record<string, Listener> = {}
  const originalOn = app.on
  ;(app as any).on = (event: string, fn: Listener) =>
    void (registered[event] = fn)
  const original = dialog.showMessageBox
  const shown: any[] = []
  let answer = 1
  ;(dialog as any).showMessageBox = async (...args: any[]) => {
    shown.push(args[args.length - 1])
    return { response: answer }
  }
  try {
    installClientCertificateDialog(() => null)
    const list = [cert('Gilas', 'AC Corp'), cert('Gilas 2', 'AC Corp')]

    // escolhe o segundo
    answer = 1
    let prevented = false
    let delivered: unknown = 'não chamado'
    registered['select-client-certificate'](
      { preventDefault: () => (prevented = true) },
      {},
      'https://mtls.example.com/',
      list,
      (certificate?: Certificate) => (delivered = certificate ?? null)
    )
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(prevented, true)
    assert.equal(delivered, list[1])

    // Cancelar (o padrão): nenhum certificado sai
    answer = 2
    delivered = 'não chamado'
    registered['select-client-certificate'](
      { preventDefault() {} },
      {},
      'https://mtls.example.com/',
      list,
      (certificate?: Certificate) => (delivered = certificate ?? null)
    )
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(delivered, null)
    assert.equal(shown.length, 2)

    // sem certificado na keychain: nem pergunta
    delivered = 'não chamado'
    registered['select-client-certificate'](
      { preventDefault() {} },
      {},
      'https://mtls.example.com/',
      [],
      (certificate?: Certificate) => (delivered = certificate ?? null)
    )
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(delivered, null)
    assert.equal(shown.length, 2)
  } finally {
    ;(app as any).on = originalOn
    ;(dialog as any).showMessageBox = original
  }
})

test('vários pedidos do mesmo site compartilham um diálogo só', async () => {
  const original = dialog.showMessageBox
  let shown = 0
  ;(dialog as any).showMessageBox = async () => {
    shown++
    await new Promise(resolve => setTimeout(resolve, 20))
    return { response: 0 }
  }
  try {
    const list = [cert('Gilas', 'AC')]
    const results = await Promise.all([
      chooseClientCertificate(null, 'https://mtls.example.com/a', list),
      chooseClientCertificate(null, 'https://mtls.example.com/b', list),
      chooseClientCertificate(null, 'https://mtls.example.com/c', list)
    ])
    assert.equal(shown, 1)
    assert.deepEqual(results, [list[0], list[0], list[0]])
    // outro site tem a própria pergunta
    await chooseClientCertificate(null, 'https://outro.example.com/', list)
    assert.equal(shown, 2)
  } finally {
    ;(dialog as any).showMessageBox = original
  }
})
