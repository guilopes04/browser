import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import type { WebContents } from 'electron'
import {
  FULLSCREEN_NOTICE,
  FULLSCREEN_NOTICE_MS,
  FULLSCREEN_NOTICE_TEXT
} from '@shared/tokens'
import { attachFullscreenEvents } from '../src/main/functions/attach-fullscreen-events'
import { computeLayout } from '../src/main/functions/compute-layout'
import {
  hideFullscreenNotice,
  showFullscreenNotice
} from '../src/main/functions/show-fullscreen-notice'
import { fakeContext } from './fake-main'

test('aviso de tela cheia: a shell encolhe para a faixa do aviso, no topo e no centro', () => {
  const base = {
    width: 1440,
    height: 900,
    sidebar: 'open' as const,
    videoFullscreen: true
  }
  assert.deepEqual(computeLayout(base).shell, {
    x: 0,
    y: 0,
    width: 1440,
    height: 900
  })
  const layout = computeLayout({ ...base, fullscreenNotice: true })
  assert.deepEqual(layout.shell, {
    x: (1440 - FULLSCREEN_NOTICE.width) / 2,
    y: FULLSCREEN_NOTICE.top,
    width: FULLSCREEN_NOTICE.width,
    height: FULLSCREEN_NOTICE.height
  })
  // a página continua ocupando a janela inteira, com raio 0
  assert.deepEqual(layout.page, { x: 0, y: 0, width: 1440, height: 900 })
  assert.equal(layout.pageRadius, 0)
  // janela mais estreita que o aviso: ele não passa da janela
  assert.equal(
    computeLayout({ ...base, width: 200, fullscreenNotice: true }).shell.width,
    200
  )
  // fora da tela cheia o aviso não existe
  assert.deepEqual(
    computeLayout({ ...base, videoFullscreen: false, fullscreenNotice: true })
      .shell,
    { x: 0, y: 0, width: 1440, height: 900 }
  )
  assert.equal(FULLSCREEN_NOTICE_TEXT, 'Site em tela cheia. Esc para sair')
  assert.equal(FULLSCREEN_NOTICE_MS, 3000)
})

function noticeEnv() {
  const env = fakeContext(['https://a.com'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab, 'https://a.com/')
  env.ctx.attached.tabId = tab.id
  const shellBounds: unknown[] = []
  ;(env.ctx.shell as any).setBounds = (rect: unknown) =>
    void shellBounds.push(rect)
  attachFullscreenEvents(env.ctx, tab.id, live.wc as unknown as WebContents)
  return { ...env, tab, live, shellBounds }
}

test('entrar em tela cheia mostra o aviso por 3 s e a shell desce sozinha', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { ctx, store, live, added, shellBounds } = noticeEnv()
    live.wc.emit('enter-html-full-screen')

    assert.equal(store.state.fullscreen, true)
    assert.ok(store.state.overlay.includes('notice'))
    assert.equal(ctx.shellRaised, true, 'a shell subiu por cima da página')
    assert.ok(added.includes(ctx.shell as never))
    assert.deepEqual(shellBounds[shellBounds.length - 1], {
      x: (1300 - FULLSCREEN_NOTICE.width) / 2,
      y: FULLSCREEN_NOTICE.top,
      width: FULLSCREEN_NOTICE.width,
      height: FULLSCREEN_NOTICE.height
    })

    mock.timers.tick(FULLSCREEN_NOTICE_MS - 1)
    assert.ok(
      store.state.overlay.includes('notice'),
      'ainda na tela aos 2,999 s'
    )
    mock.timers.tick(1)
    assert.equal(store.state.overlay.includes('notice'), false)
    assert.equal(ctx.shellRaised, false)
    assert.deepEqual(shellBounds[shellBounds.length - 1], {
      x: 0,
      y: 0,
      width: 1300,
      height: 800
    })
    assert.equal(store.state.fullscreen, true, 'a tela cheia continua')
  } finally {
    mock.timers.reset()
  }
})

test('sair da tela cheia derruba o aviso na hora; entrar de novo reinicia os 3 s', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { store, live, ctx } = noticeEnv()
    live.wc.emit('enter-html-full-screen')
    mock.timers.tick(1000)
    live.wc.emit('leave-html-full-screen')
    assert.equal(store.state.fullscreen, false)
    assert.equal(store.state.overlay.includes('notice'), false)
    assert.equal(ctx.shellRaised, false)

    live.wc.emit('enter-html-full-screen')
    mock.timers.tick(2900)
    assert.ok(store.state.overlay.includes('notice'))
    mock.timers.tick(100)
    assert.equal(store.state.overlay.includes('notice'), false)

    // o aviso só existe em tela cheia
    showFullscreenNotice(ctx)
    hideFullscreenNotice(ctx)
    store.setFullscreen(false)
    showFullscreenNotice(ctx)
    assert.equal(store.state.overlay.includes('notice'), false)
  } finally {
    mock.timers.reset()
  }
})
