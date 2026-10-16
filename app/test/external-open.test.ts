import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WebContents } from 'electron'
import { app, dialog } from 'electron'
import { describeLoadError } from '../src/shared/describe-load-error'
import { externalSchemeOf } from '../src/main/functions/external-scheme'
import { requestExternalOpen } from '../src/main/functions/handle-external-open'
import { markFrameGesture } from '../src/main/functions/frame-gesture'
import { markGesture } from '../src/main/functions/user-gesture'
import { fakeContext } from './fake-main'

test('esquema externo: o que o navegador abre por conta própria não conta', () => {
  assert.equal(externalSchemeOf('mailto:a@b.com'), 'mailto')
  assert.equal(externalSchemeOf('TEL:+5511999999999'), 'tel')
  assert.equal(
    externalSchemeOf('x-apple.systempreferences:com.apple.Network'),
    'x-apple.systempreferences'
  )
  assert.equal(externalSchemeOf('gilasnope:abc'), 'gilasnope')
  for (const url of [
    'https://a.com',
    'http://a.com',
    'file:///x',
    'about:blank',
    'javascript:alert(1)',
    'data:text/html,x',
    'blob:https://a/x',
    'app://shell'
  ])
    assert.equal(externalSchemeOf(url), null, url)
  assert.equal(externalSchemeOf('sem esquema'), null)
  assert.equal(externalSchemeOf(''), null)
})

test('página de erro de esquema desconhecido, em português', () => {
  const text = describeLoadError(-302, 'gilasnope')
  assert.equal(text.title, 'Nenhum app abre este tipo de link')
  assert.ok(text.body.includes('"gilasnope"'))
})

interface Asked {
  message?: string
  detail?: string
  buttons?: string[]
  defaultId?: number
  cancelId?: number
}

function setup(handlerName = 'Mail') {
  const env = fakeContext(['https://pagina.test/'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab)
  env.store.setActiveTab('personal', tab.id)
  env.ctx.attached.tabId = tab.id
  env.ctx.attached.view = live.view as never
  const wc = Object.assign(live.wc, { getURL: () => 'https://pagina.test/x' })
  const asked: Asked[] = []
  let response = 0
  ;(
    dialog as unknown as {
      showMessageBox: (...a: unknown[]) => Promise<unknown>
    }
  ).showMessageBox = async (...args: unknown[]) => {
    asked.push(args[args.length - 1] as Asked)
    return { response, checkboxChecked: false }
  }
  ;(
    app as unknown as { getApplicationNameForProtocol: (url: string) => string }
  ).getApplicationNameForProtocol = () => handlerName
  const request = (url: string | undefined, requestingUrl?: string) =>
    new Promise<boolean>(done =>
      requestExternalOpen(
        env.ctx,
        wc as unknown as WebContents,
        url,
        done,
        requestingUrl
      )
    )
  return {
    ...env,
    tab,
    wc,
    asked,
    request,
    answer: (n: number) => void (response = n)
  }
}

test('mailto: com gesto pergunta "Abrir mailto em outro app?", com Cancelar como padrão', async () => {
  const env = setup()
  markGesture(env.ctx.guard, env.tab.id)
  const allowed = await env.request('mailto:teste@example.com')
  assert.equal(allowed, false, 'Cancelar (padrão) não abre')
  assert.equal(env.asked.length, 1)
  assert.equal(env.asked[0].message, 'Abrir mailto em outro app?')
  assert.deepEqual(env.asked[0].buttons, ['Cancelar', 'Abrir'])
  assert.equal(env.asked[0].defaultId, 0)
  assert.equal(env.asked[0].cancelId, 0)
  assert.ok(env.asked[0].detail?.includes('Mail'))
  assert.ok(env.asked[0].detail?.includes('pagina.test'))
  assert.ok(env.asked[0].detail?.includes('mailto:teste@example.com'))
})

test('só abre se o usuário escolher Abrir', async () => {
  const env = setup('FaceTime')
  markGesture(env.ctx.guard, env.tab.id)
  env.answer(1)
  assert.equal(await env.request('tel:+5511999999999'), true)
})

test('sem gesto do usuário nunca abre, nem pergunta', async () => {
  const env = setup()
  env.answer(1)
  assert.equal(await env.request('mailto:silencio@example.com'), false)
  assert.equal(env.asked.length, 0)
})

test('esquema que nenhum app trata: página de erro na aba, sem diálogo', async () => {
  const env = setup('')
  markGesture(env.ctx.guard, env.tab.id)
  assert.equal(await env.request('gilasnope:abc'), false)
  assert.equal(env.asked.length, 0)
  const error = env.store.getTab(env.tab.id)?.error
  assert.equal(error?.code, -302)
  assert.equal(error?.description, 'ERR_UNKNOWN_URL_SCHEME')
  assert.equal(error?.target, 'gilasnope')
})

test('uma pergunta por vez em cada aba', async () => {
  const env = setup()
  markGesture(env.ctx.guard, env.tab.id)
  let release: (value: unknown) => void = () => {}
  ;(
    dialog as unknown as { showMessageBox: () => Promise<unknown> }
  ).showMessageBox = () =>
    new Promise(done => {
      release = done
    })
  const first = env.request('mailto:um@example.com')
  assert.equal(await env.request('mailto:dois@example.com'), false)
  release({ response: 1, checkboxChecked: false })
  assert.equal(await first, true)
  assert.equal(env.ctx.guard.externalPending.has(env.tab.id), false)
})

test('endereço inválido, esquema do navegador ou contents que não é aba: recusa', async () => {
  const env = setup()
  markGesture(env.ctx.guard, env.tab.id)
  assert.equal(await env.request(undefined), false)
  assert.equal(await env.request('https://a.com'), false)
  assert.equal(
    await new Promise<boolean>(done =>
      requestExternalOpen(env.ctx, {} as WebContents, 'mailto:a@b.com', done)
    ),
    false
  )
  assert.equal(env.asked.length, 0)
})

test('janela escondida: não há como perguntar, não abre', async () => {
  const env = setup()
  markGesture(env.ctx.guard, env.tab.id)
  env.ctx.win.hide()
  env.answer(1)
  assert.equal(await env.request('mailto:a@b.com'), false)
})

test('o clique na página não vale para o iframe de outra origem abrir um app', async () => {
  const env = setup()
  const page = {
    processId: 1,
    frameToken: 'page',
    origin: 'https://pagina.test',
    url: 'https://pagina.test/x',
    parent: null
  }
  const ad = {
    processId: 2,
    frameToken: 'ad',
    origin: 'https://ads.test',
    url: 'https://ads.test/banner',
    parent: page
  }
  Object.assign(env.wc, { mainFrame: { framesInSubtree: [page, ad] } })
  markFrameGesture(env.ctx.guard, env.tab.id, {
    key: '1:page',
    origin: page.origin
  })
  env.answer(1)
  // pedido do anúncio (requestingUrl é do quadro dele): recusado sem perguntar
  assert.equal(
    await env.request('mailto:ad@example.com', 'https://ads.test/banner'),
    false
  )
  assert.equal(env.asked.length, 0)
  // a página, com o mesmo clique, pergunta
  assert.equal(
    await env.request('mailto:pagina@example.com', 'https://pagina.test/x'),
    true
  )
  assert.equal(env.asked.length, 1)
})
