import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dialog } from 'electron'
import { isDarkGlyph } from '../src/shared/favicon-tone'
import { formatErrorLog } from '../src/main/functions/format-error-log'
import { attachUnloadGuard } from '../src/main/functions/attach-unload-guard'
import { hideWindow } from '../src/main/actions/hide-window'
import { showWindow } from '../src/main/actions/show-window'
import { buildMenuTemplate } from '../src/main/services/app-menu'
import { isLoadFailureWarning } from '../src/main/services/error-log'
import { fakeContext } from './fake-main'
import type { WebContents } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'

function pixels(count: number, rgba: [number, number, number, number]) {
  const data = new Uint8ClampedArray(count * 4)
  for (let i = 0; i < count; i++) data.set(rgba, i * 4)
  return data
}

test('favicon: glifo preto sobre transparente é escuro; colorido e claro não', () => {
  const dark = pixels(256, [0, 0, 0, 0])
  for (let i = 0; i < 120; i++) dark.set([10, 10, 10, 255], i * 4)
  assert.equal(isDarkGlyph(dark), true)
  assert.equal(isDarkGlyph(pixels(256, [255, 255, 255, 255])), false)
  assert.equal(isDarkGlyph(pixels(256, [66, 133, 244, 255])), false)
  // o cinza-chumbo do GitHub (#24292f) é escuro; o vermelho do Netflix (#e50914) não
  assert.equal(isDarkGlyph(pixels(256, [36, 41, 47, 255])), true)
  assert.equal(isDarkGlyph(pixels(256, [229, 9, 20, 255])), false)
  // quase vazio ou vazio: nada a decidir
  assert.equal(isDarkGlyph(pixels(256, [0, 0, 0, 0])), false)
  assert.equal(isDarkGlyph(new Uint8ClampedArray(0)), false)
})

test('linha do main.log: data, tipo e rastro indentado', () => {
  const when = new Date('2026-10-15T12:00:00.000Z')
  const error = new Error('boom')
  error.stack = 'Error: boom\n    at a (x.js:1:1)'
  const line = formatErrorLog('uncaughtException', error, when)
  assert.ok(
    line.startsWith(
      '2026-10-15T12:00:00.000Z [Main][uncaughtException] Error: boom'
    )
  )
  assert.ok(line.includes('\n        at a'))
  assert.ok(line.endsWith('\n'))
  assert.ok(
    formatErrorLog('unhandledRejection', 'texto', when).includes('texto')
  )
  assert.ok(
    formatErrorLog('unhandledRejection', { a: 1 }, when).includes('{"a":1}')
  )
  assert.ok(formatErrorLog('warning', 'x'.repeat(10_000), when).length < 4200)
})

test('o aviso de loadURL que falha é reconhecido e os outros não', () => {
  const load = Object.assign(
    new Error('Failed to load URL: http://x/ with error: ERR_X'),
    {
      name: 'electron'
    }
  )
  assert.equal(isLoadFailureWarning(load), true)
  assert.equal(isLoadFailureWarning(new Error('Failed to load URL')), false)
})

function labelsOf(items: MenuItemConstructorOptions[]): string[] {
  return items.flatMap(item => [
    ...(item.label ? [item.label] : []),
    ...(Array.isArray(item.submenu) ? labelsOf(item.submenu) : [])
  ])
}

test('menus do app: todo item com texto próprio está em português', () => {
  const { ctx } = fakeContext()
  const template = buildMenuTemplate(ctx)
  const menus = template.map(item => item.label)
  assert.deepEqual(menus, [
    'Gilas Browser',
    'Arquivo',
    'Editar',
    'Visualizar',
    'Navegar',
    'Espaços',
    'Janela'
  ])
  // todo item com role tem rótulo explícito (sem ele o Electron usa o inglês)
  const walk = (items: MenuItemConstructorOptions[]): void => {
    for (const item of items) {
      if (item.type === 'separator') continue
      if (item.role && item.role !== 'window')
        assert.ok(item.label, `role ${item.role} sem rótulo`)
      if (Array.isArray(item.submenu)) walk(item.submenu)
    }
  }
  walk(template)
  const all = labelsOf(template)
  for (const wanted of [
    'Sobre o Gilas Browser',
    'Ocultar Outros',
    'Mostrar Tudo',
    'Desfazer',
    'Refazer',
    'Recortar',
    'Copiar',
    'Colar',
    'Colar e Combinar Estilo',
    'Apagar',
    'Selecionar Tudo',
    'Minimizar',
    'Zoom',
    'Trazer Todas para a Frente',
    'Tela Cheia'
  ])
    assert.ok(all.includes(wanted), `falta "${wanted}"`)
  for (const english of [
    'Edit',
    'Window',
    'Undo',
    'Redo',
    'Cut',
    'Paste',
    'Minimize',
    'Quit',
    'Hide',
    'Bring All to Front',
    'Select All',
    'Delete'
  ])
    assert.ok(!all.includes(english), `"${english}" em inglês`)
})

function unloadSetup() {
  const env = fakeContext(['https://a.com'])
  const [tab] = env.store.getTabsOfSpace('personal')
  const live = env.makeLive(tab, 'https://a.com/')
  env.ctx.attached.tabId = tab.id
  attachUnloadGuard(env.ctx, tab.id, live.wc as unknown as WebContents)
  return { ...env, tab, live }
}

test('beforeunload: Sair deixa a navegação seguir (preventDefault)', () => {
  const { ctx, tab, live } = unloadSetup()
  const asked: unknown[] = []
  ;(dialog as any).showMessageBoxSync = (...args: unknown[]) => {
    asked.push(args[args.length - 1])
    return 0
  }
  ctx.closing.add(tab.id)
  let prevented = false
  live.wc.emit('will-prevent-unload', {
    preventDefault: () => (prevented = true)
  })
  assert.equal(prevented, true)
  assert.ok(ctx.closing.has(tab.id), 'Sair mantém o fechamento em andamento')
  const options = asked[0] as {
    message: string
    detail: string
    buttons: string[]
  }
  assert.equal(options.message, 'Sair desta página?')
  assert.equal(options.detail, 'As alterações podem não ser salvas.')
  assert.deepEqual(options.buttons, ['Sair', 'Ficar'])
})

test('beforeunload: Ficar cancela o fechamento e devolve o endereço da aba', () => {
  const { ctx, store, tab, live } = unloadSetup()
  ;(dialog as any).showMessageBoxSync = () => 1
  ctx.closing.add(tab.id)
  ctx.httpFallbacks.set(tab.id, { from: 'x', to: 'y' })
  // a barra de endereço já tinha mudado a URL da aba antes de a página recusar
  store.patchTab(tab.id, { url: 'https://digitada.com/' })
  let prevented = false
  live.wc.emit('will-prevent-unload', {
    preventDefault: () => (prevented = true)
  })
  assert.equal(prevented, false)
  assert.equal(ctx.closing.has(tab.id), false)
  assert.equal(ctx.httpFallbacks.has(tab.id), false)
  assert.equal(store.getTab(tab.id)?.url, 'https://a.com/')
})

test('botão vermelho: a janela some, a aba sai da árvore e o Dock a traz de volta', () => {
  const { ctx, store, makeLive } = fakeContext(['https://a.com'])
  const [tab] = store.getTabsOfSpace('personal')
  const live = makeLive(tab)
  ctx.attached.tabId = tab.id
  ctx.attached.view = live.view as never

  hideWindow(ctx)
  assert.equal(ctx.win.isVisible(), false)
  assert.equal(
    ctx.attached.tabId,
    null,
    'a página deixa a janela (o timer pode suspendê-la)'
  )
  assert.ok(ctx.views.has(tab.id), 'a aba segue viva até o timer decidir')
  assert.ok(store.getTab(tab.id), 'a sessão fica inteira')

  showWindow(ctx)
  assert.equal(ctx.win.isVisible(), true)
  assert.equal(ctx.attached.tabId, tab.id)
})
