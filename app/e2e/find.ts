// Buscar na página (⌘F) de ponta a ponta, com teclas e cliques reais: abrir com o foco no campo e
// nada vazando para a página, contar (sem diferenciar maiúsculas nem acentos), próximo e anterior
// (↵, ⇧↵, ⌘G, ⇧⌘G), destaques pintados e limpos, esc, clicar na página sem fechar a barra (e a
// página recebendo o clique), seleção da página pré-preenchendo, "Aa", "Nenhum resultado", acento
// (tecla morta), digitar logo depois do atalho, trocar e fechar a aba, aba suspensa, navegação com
// a barra aberta, o menu Editar, o layout seguindo a janela e o processo da barra indo embora; e
// ainda: clicar e rolar na margem da sombra, ⌘F com a paleta aberta, a página de erro, abrir e
// fechar 30 vezes sem sobrar nada, a barra medida contra o design no claro e as cores do escuro, e
// nenhuma exceção no main nem erro no console da shell ou da barra.
// Pré-requisito: npm run build. Uso: npm run e2e:find. Usa o teclado e o mouse de verdade: não rode
// junto com outro teste e2e nem mexa no Mac durante a execução (E2E_CDP, E2E_INSPECT e E2E_SRV
// mudam as portas).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFixture } from './fixture.ts'
import * as L from './lib.ts'

const { K, sleep } = L

const FIND = {
  cmdF: 'keystroke "f" using {command down}',
  cmdG: 'keystroke "g" using {command down}',
  cmdShiftG: 'keystroke "g" using {command down, shift down}',
  shiftEnter: 'key code 36 using {shift down}',
  deadAcute: 'keystroke "e" using {option down}',
  deadTilde: 'keystroke "n" using {option down}',
  cmd: (key: string) => `keystroke "${key}" using {command down}`
}

// perfil: as abas f1 e f2 (find.test) vêm antes das do perfil padrão; f1 ativa
function fixture(profile: string): void {
  writeFixture(profile)
  const file = join(profile, 'session.json')
  const session = JSON.parse(readFileSync(file, 'utf8'))
  const tab = (id: string, url: string, title: string) => ({
    id,
    spaceId: 'personal',
    url,
    title,
    favicon: null,
    muted: false,
    lastActiveAt: Date.now()
  })
  session.tabs = [
    tab('f1', 'http://find.test/a?t=Busca%20A', 'Busca A'),
    tab('f2', 'http://find.test/b?t=Busca%20B&delay=1500', 'Busca B'),
    ...session.tabs
  ]
  session.window.activeTabBySpace.personal = 'f1'
  writeFileSync(file, JSON.stringify(session))
}

interface Bar {
  value: string
  focused: boolean
  hasFocus: boolean
  count: string
  pressed: string
  ready: string
  theme: string
}

// o que a barra de busca mostra (null = não existe)
async function bar(): Promise<Bar | null> {
  const target = await L.findBar()
  if (!target) return null
  try {
    return await L.ev(
      target,
      `(() => {
      const input = document.getElementById('find-input')
      const bar = document.querySelector('.find-bar')
      return {
        value: input.value,
        focused: document.activeElement === input,
        hasFocus: document.hasFocus(),
        count: document.querySelector('.find-count').innerText,
        pressed: document.querySelector('.find-case').getAttribute('aria-pressed'),
        ready: bar.dataset.ready,
        theme: document.querySelector('.root').dataset.theme
      }
    })()`
    )
  } catch {
    return null
  }
}

const waitCount = (expected: string | RegExp, ms = 6000) =>
  L.waitFor(async () => {
    const state = await bar()
    if (!state) return null
    const ok =
      typeof expected === 'string'
        ? state.count === expected
        : expected.test(state.count)
    return ok ? state : null
  }, ms)

// espera a barra mostrar o texto e o contador esperados (os dois: só o contador pode ser o da busca
// anterior)
const waitBar = (value: string, count: string | RegExp, ms = 6000) =>
  L.waitFor(async () => {
    const state = await bar()
    if (!state || state.value !== value) return null
    const ok =
      typeof count === 'string'
        ? state.count === count
        : count.test(state.count)
    return ok ? state : null
  }, ms)

const waitReady = () =>
  L.waitFor(async () => {
    const state = await bar()
    return state && state.ready === 'true' && state.focused ? state : null
  }, 4000)

const waitClosed = (ms = 3000) =>
  L.waitFor(async () => ((await L.findBar()) ? null : true), ms)

// quantos pixels da página têm as cores dos destaques do design: #FBE7A6 (resultados) e #F5B54A
// (o ativo). A página é capturada pelo próprio Chromium, com os destaques que ele pintou
async function highlights(fragment: string) {
  return L.mainEval(`(async () => {
    const { webContents } = process.mainModule.require('electron')
    const wc = webContents.getAllWebContents().find(w => w.getURL().includes(${JSON.stringify(fragment)}))
    const img = await wc.capturePage()
    const b = img.toBitmap()
    let results = 0, active = 0
    const near = (v, w, t) => Math.abs(v - w) <= t
    for (let i = 0; i < b.length; i += 4) {
      const B = b[i], G = b[i + 1], R = b[i + 2]
      if (near(R, 0xfb, 3) && near(G, 0xe7, 3) && near(B, 0xa6, 3)) results++
      else if (near(R, 0xf5, 4) && near(G, 0xb5, 4) && near(B, 0x4a, 4)) active++
    }
    return { results, active }
  })()`)
}

// uma barra nova, vazia e com o foco: fecha a que estiver aberta e abre de novo
async function openFresh(): Promise<Bar | null> {
  if (await L.findBar()) {
    await L.keys(K.esc)
    await waitClosed()
    await sleep(200)
  }
  await L.keys(FIND.cmdF)
  return waitReady()
}

const activeOf = (s: L.Json) => s.window.activeTabBySpace[s.window.spaceId]
const urlOf = (s: L.Json, id: string) =>
  s.tabs.find((t: L.Json) => t.id === id)?.url

async function activate(tabId: string): Promise<void> {
  if (await L.findBar()) {
    await L.keys(K.esc)
    await waitClosed()
  }
  await L.send('tab:activate', { tabId })
  await sleep(600)
}

async function focusPage(fragment: string): Promise<void> {
  await L.mainEval(`(() => {
    const { webContents } = process.mainModule.require('electron')
    webContents.getAllWebContents().find(w => w.getURL().includes(${JSON.stringify(fragment)})).focus()
  })()`)
  await sleep(150)
}

// janela, view da barra e o ponto da tela de um elemento da barra (para o clique real)
async function screenPoint(selector: string) {
  const geometry = await L.mainEval(`(() => {
    const { BaseWindow } = process.mainModule.require('electron')
    const win = BaseWindow.getAllWindows()[0]
    const view = win.contentView.children.find(c => c.webContents && c.webContents.getURL().includes('find.html'))
    return { content: win.getContentBounds(), view: view ? view.getBounds() : null }
  })()`)
  if (!geometry.view) return null
  const target = (await L.findBar()) as NonNullable<
    Awaited<ReturnType<typeof L.findBar>>
  >
  const rect = await L.ev(
    target,
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()`
  )
  return {
    x: geometry.content.x + geometry.view.x + rect.x + rect.w / 2,
    y: geometry.content.y + geometry.view.y + rect.y + rect.h / 2
  }
}

await L.runSuite(
  'find',
  async record => {
    // exceções do main e erros no console da shell e da barra, do começo ao fim
    await L.mainEval(`(() => {
      const { app, webContents } = process.mainModule.require('electron')
      global.__errors = []
      const push = text => global.__errors.push(String(text).slice(0, 400))
      process.on('uncaughtException', e => push('main: ' + (e && e.stack || e)))
      process.on('unhandledRejection', e => push('main (promessa): ' + (e && e.stack || e)))
      const error = console.error.bind(console)
      console.error = (...args) => { push('main console.error: ' + args.map(String).join(' ')); error(...args) }
      const watch = wc => wc.on('console-message', (event, level, message) => {
        const lv = event && event.level !== undefined ? event.level : level
        const text = event && event.message !== undefined ? event.message : message
        if ((lv === 'error' || lv === 3) && wc.getURL().startsWith('app://')) push(wc.getURL() + ': ' + text)
      })
      for (const wc of webContents.getAllWebContents()) watch(wc)
      app.on('web-contents-created', (_e, wc) => watch(wc))
      return true
    })()`)

    let s = await L.st()
    record(
      'preparação: abas f1 e f2 no Pessoal, f1 ativa',
      activeOf(s) === 'f1' && !!urlOf(s, 'f2'),
      { tabs: s.tabs.map((t: L.Json) => [t.id, t.dormant]) }
    )
    await L.waitFor(() => L.pageOf('find.test/a'), 8000)
    await sleep(800)

    // ---------- A. ⌘F abre com o foco no campo e nada vaza para a página ----------
    const procsBefore = L.countProcs()
    await L.resetKeys('find.test/a')
    const t0 = Date.now()
    await L.keys(FIND.cmdF)
    let state = await waitReady()
    const openMs = Date.now() - t0
    let page = await L.pageFocus('find.test/a')
    record(
      'A1 ⌘F abre a barra com o foco no campo vazio e nada chega à página',
      !!state &&
        state.value === '' &&
        state.hasFocus &&
        page.keys.length === 0 &&
        state.theme === 'light',
      { openMs, state, pageKeys: page.keys }
    )
    const procsOpen = L.countProcs()
    record(
      'A2 a barra é uma view própria (um processo a mais)',
      procsOpen > procsBefore,
      {
        procsBefore,
        procsOpen
      }
    )

    // ---------- B. digitar conta, sem diferenciar maiúsculas, e destaca ----------
    await L.keys(K.type('banana'))
    state = await waitCount('1 de 3')
    let marks = await highlights('find.test/a')
    record(
      'B1 "banana" conta "1 de 3" (Banana, banana e BANANA) e a página tem os destaques do design',
      !!state &&
        state.value === 'banana' &&
        marks.results > 0 &&
        marks.active > 0,
      { count: state?.count, marks }
    )

    // ---------- C. próximo e anterior ----------
    const steps: [string, string, string][] = [
      ['↵', K.enter, '2 de 3'],
      ['↵', K.enter, '3 de 3'],
      ['↵ (dá a volta)', K.enter, '1 de 3'],
      ['⇧↵ (dá a volta)', FIND.shiftEnter, '3 de 3'],
      ['⌘G', FIND.cmdG, '1 de 3'],
      ['⇧⌘G', FIND.cmdShiftG, '3 de 3']
    ]
    const failed: unknown[] = []
    for (const [label, script, expected] of steps) {
      await L.keys(script)
      const got = await waitCount(expected, 3000)
      if (!got) failed.push({ label, expected, count: (await bar())?.count })
    }
    record(
      'C1 ↵, ⇧↵, ⌘G e ⇧⌘G andam pelos resultados e dão a volta',
      failed.length === 0,
      {
        failed
      }
    )

    // ---------- D. a página tem o foco: ⌘G segue valendo e a barra continua ----------
    await focusPage('find.test/a')
    await L.keys(FIND.cmdG)
    state = await waitCount('1 de 3', 3000)
    record(
      'D1 com o foco na página, ⌘G anda e a barra continua aberta',
      !!state,
      { count: (await bar())?.count }
    )

    // clicar na página: a barra fica e a página recebe o clique
    await L.mainEval(`(() => {
      const { webContents } = process.mainModule.require('electron')
      return webContents.getAllWebContents().find(w => w.getURL().includes('find.test/a')).executeJavaScript('window.clicks = []; true')
    })()`)
    await L.click(900, 40 + 500)
    await sleep(400)
    page = await L.ev(
      (await L.pageOf('find.test/a')) as NonNullable<
        Awaited<ReturnType<typeof L.pageOf>>
      >,
      `({ clicks: window.clicks, hasFocus: document.hasFocus() })`
    )
    state = await bar()
    record(
      'D2 clicar na página: a página recebe o clique, ganha o foco e a barra continua aberta com o mesmo contador',
      page.clicks.length === 1 &&
        page.hasFocus &&
        !!state &&
        state.count === '1 de 3',
      { page, count: state?.count }
    )

    // um clique logo ao lado da barra (fora dela e da margem da sombra) também é da página
    const bounds = await L.mainEval(`(() => {
      const { BaseWindow } = process.mainModule.require('electron')
      const win = BaseWindow.getAllWindows()[0]
      const view = win.contentView.children.find(c => c.webContents && c.webContents.getURL().includes('find.html'))
      return { content: win.getContentBounds(), view: view.getBounds() }
    })()`)
    await L.mainEval(`(() => {
      const { webContents } = process.mainModule.require('electron')
      return webContents.getAllWebContents().find(w => w.getURL().includes('find.test/a')).executeJavaScript('window.clicks = []; true')
    })()`)
    await L.click(
      bounds.content.x + bounds.view.x - 30,
      bounds.content.y + bounds.view.y + 40
    )
    await sleep(400)
    page = await L.ev(
      (await L.pageOf('find.test/a')) as NonNullable<
        Awaited<ReturnType<typeof L.pageOf>>
      >,
      `({ clicks: window.clicks })`
    )
    record(
      'D3 clique a 30 pt da margem da barra chega à página',
      page.clicks.length === 1,
      { page }
    )

    // a margem transparente da sombra (10 pt abaixo da barra, no meio dela) também é da página: o
    // clique chega no mesmo ponto, a página ganha o foco e a barra fica
    const pageBounds = await L.mainEval(`(() => {
      const { BaseWindow } = process.mainModule.require('electron')
      const win = BaseWindow.getAllWindows()[0]
      const view = win.contentView.children.find(c => c.webContents && c.webContents.getURL().includes('find.test/a'))
      return view.getBounds()
    })()`)
    const barBox = await L.ev(
      (await L.findBar()) as NonNullable<Awaited<ReturnType<typeof L.findBar>>>,
      `(() => { const r = document.querySelector('.find-bar').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()`
    )
    const inView = { x: barBox.x + barBox.w / 2, y: barBox.y + barBox.h + 10 }
    await L.mainEval(`(() => {
      const { webContents } = process.mainModule.require('electron')
      return webContents.getAllWebContents().find(w => w.getURL().includes('find.test/a')).executeJavaScript('window.clicks = []; true')
    })()`)
    await L.click(
      bounds.content.x + bounds.view.x + inView.x,
      bounds.content.y + bounds.view.y + inView.y
    )
    await sleep(500)
    page = await L.ev(
      (await L.pageOf('find.test/a')) as NonNullable<
        Awaited<ReturnType<typeof L.pageOf>>
      >,
      `({ clicks: window.clicks, hasFocus: document.hasFocus() })`
    )
    const expectedClick = [
      bounds.view.x + inView.x - pageBounds.x,
      bounds.view.y + inView.y - pageBounds.y
    ]
    state = await bar()
    record(
      'D4 clique na margem da sombra (10 pt abaixo da barra) chega à página no mesmo ponto, com o foco, e a barra fica',
      page.clicks.length === 1 &&
        Math.abs(page.clicks[0][0] - expectedClick[0]) <= 2 &&
        Math.abs(page.clicks[0][1] - expectedClick[1]) <= 2 &&
        page.hasFocus &&
        !!state &&
        state.count === '1 de 3',
      { page, expectedClick, count: state?.count }
    )

    // rolar com o ponteiro na margem rola a página
    const pageA = (await L.pageOf('find.test/a')) as NonNullable<
      Awaited<ReturnType<typeof L.pageOf>>
    >
    await L.ev(pageA, 'scrollTo(0, 0); true')
    await L.scroll(
      bounds.content.x + bounds.view.x + inView.x,
      bounds.content.y + bounds.view.y + inView.y,
      -240
    )
    const scrolled = await L.waitFor(
      async () => ((await L.ev(pageA, 'scrollY')) > 0 ? true : null),
      2000
    )
    record(
      'D5 rolar com o ponteiro na margem da sombra rola a página',
      !!scrolled,
      {
        scrollY: await L.ev(pageA, 'scrollY')
      }
    )
    await L.ev(pageA, 'scrollTo(0, 0); true')

    // ---------- E. esc fecha e limpa os destaques ----------
    await L.keys(K.esc)
    const closedByPage = await waitClosed()
    await sleep(400)
    marks = await highlights('find.test/a')
    record(
      'E1 esc com o foco na página fecha a barra e limpa os destaques',
      !!closedByPage && marks.results === 0 && marks.active === 0,
      { marks }
    )
    await L.keys(FIND.cmdF)
    await waitReady()
    await L.keys(K.type('banana'))
    await waitCount('1 de 3')
    await L.keys(K.esc)
    const closedByBar = await waitClosed()
    await sleep(500)
    marks = await highlights('find.test/a')
    page = await L.pageFocus('find.test/a')
    record(
      'E2 esc com o foco na barra fecha, limpa os destaques e devolve o foco à página',
      !!closedByBar &&
        marks.results === 0 &&
        marks.active === 0 &&
        page.hasFocus,
      { marks, hasFocus: page.hasFocus }
    )
    await sleep(1200)
    record(
      'E3 fechada a barra, o processo dela vai embora',
      L.countProcs() === procsBefore,
      { procsBefore, procsNow: L.countProcs() }
    )

    // ---------- F. ⌘F com texto selecionado na página pré-preenche ----------
    await L.mainEval(`(() => {
      const { webContents } = process.mainModule.require('electron')
      return webContents.getAllWebContents().find(w => w.getURL().includes('find.test/a')).executeJavaScript(
        "const r = document.createRange(); r.selectNodeContents(document.getElementById('pick')); getSelection().removeAllRanges(); getSelection().addRange(r); true")
    })()`)
    await focusPage('find.test/a')
    await L.keys(FIND.cmdF)
    state = await waitCount('1 de 1')
    record(
      'F1 ⌘F com "abacaxi" selecionado abre a busca já com "abacaxi" e "1 de 1"',
      !!state && state.value === 'abacaxi',
      { state }
    )
    // o texto vem selecionado: digitar substitui
    await L.keys(K.type('banana'))
    state = await waitCount('1 de 3')
    record(
      'F2 digitar substitui o texto pré-preenchido',
      !!state && state.value === 'banana',
      {
        value: state?.value
      }
    )

    // ---------- G. ⌘F de novo seleciona o texto da caixa ----------
    await focusPage('find.test/a')
    await L.keys(FIND.cmdF)
    await sleep(500)
    await L.keys(K.type('cafe'))
    state = await waitBar('cafe', '1 de 3')
    record(
      'G1 ⌘F com a barra aberta foca e seleciona o texto: o que se digita substitui ("cafe" acha Cafe, café e CAFÉ)',
      !!state && state.value === 'cafe',
      { state }
    )

    // ---------- H. "Aa" ----------
    await openFresh()
    await L.keys(K.type('banana'))
    await waitBar('banana', /^\d de 3$/)
    const aa = await screenPoint('.find-case')
    if (aa) await L.click(aa.x, aa.y)
    state = await waitBar('banana', '1 de 1', 4000)
    record(
      'H1 clicar em "Aa" liga a diferenciação: "banana" só acha 1 e o botão fica pressionado',
      !!state && state.pressed === 'true' && state.focused,
      { state }
    )
    if (aa) await L.click(aa.x, aa.y)
    state = await waitBar('banana', /^\d de 3$/, 4000)
    record(
      'H2 clicar de novo desliga: volta a achar os 3',
      !!state && state.pressed === 'false',
      { state, now: await bar() }
    )
    // o "Aa" ligado vale para a próxima vez que a barra abre
    if (aa) await L.click(aa.x, aa.y)
    await waitBar('banana', '1 de 1', 4000)
    await L.keys(K.esc)
    await waitClosed()
    await L.keys(FIND.cmdF)
    state = await waitReady()
    record(
      'H3 o "Aa" ligado fica ligado na próxima vez que a barra abre',
      !!state && state.pressed === 'true',
      { state }
    )
    // desliga, para os outros testes
    const aaAgain = await screenPoint('.find-case')
    if (aaAgain) await L.click(aaAgain.x, aaAgain.y)
    await L.waitFor(async () => (await bar())?.pressed === 'false', 3000)

    // ---------- I. sem resultado ----------
    await openFresh()
    await L.keys(K.type('zzz'))
    state = await waitBar('zzz', 'Nenhum resultado')
    record('I1 "zzz" mostra "Nenhum resultado"', !!state, {
      count: state?.count
    })
    await L.keys(`${K.backspace}\n${K.backspace}\n${K.backspace}`)
    state = await waitBar('', '')
    await sleep(300)
    marks = await highlights('find.test/a')
    record(
      'I2 apagar o texto some o contador e os destaques',
      !!state && state.value === '' && marks.results === 0,
      { state, marks }
    )

    // ---------- J. acento (teclas mortas, como no teclado do Mac) ----------
    await openFresh()
    await L.keys(`${K.type('caf')}\n${FIND.deadAcute}\n${K.type('e')}`)
    state = await waitBar('café', /^\d de 3$/)
    record(
      'J1 tecla morta ⌥E e depois E escreve "é" na caixa, e a busca acha os 3 "café" (com e sem acento, em qualquer caixa)',
      !!state,
      { state, now: await bar() }
    )
    await openFresh()
    await L.keys(
      `${K.type('aç')}\n${FIND.deadTilde}\n${K.type('a')}\n${K.type('o')}`
    )
    state = await waitBar('ação', /^\d de 2$/)
    record(
      'J2 "ç" direto e "ã" por tecla morta (⌥N e depois A): "ação" acha "ação" e "acao"',
      !!state,
      { state, now: await bar() }
    )
    await L.keys(K.esc)
    await waitClosed()

    // ---------- K. digitar logo depois do atalho, sem pausa ----------
    const fails: unknown[] = []
    for (let i = 0; i < 8; i++) {
      await activate('f1')
      await L.resetKeys('find.test/a')
      await L.keys(`${FIND.cmdF}\n${K.type('banana')}`)
      await sleep(900)
      const s2 = await bar()
      const keysSeen = (await L.pageFocus('find.test/a'))?.keys ?? []
      if (!(
        s2 &&
        s2.value === 'banana' &&
        s2.count === '1 de 3' &&
        keysSeen.filter((key: string) => key.length === 1).length === 0
      ))
        fails.push({
          value: s2?.value,
          count: s2?.count,
          keysSeen,
          selection: await L.ev(
            (await L.pageOf('find.test/a')) as NonNullable<
              Awaited<ReturnType<typeof L.pageOf>>
            >,
            `String(getSelection()) + '|' + (document.activeElement && document.activeElement.id)`
          )
        })
      await L.keys(K.esc)
      await waitClosed()
    }
    record(
      'K1 ⌘F + "banana" sem pausa: texto completo na barra, contagem certa e nada na página (8 rodadas)',
      fails.length === 0,
      { falhas: fails }
    )
    await L.keys(`${FIND.cmdF}\n${K.type('banana')}\n${K.enter}\n${K.enter}`)
    state = await waitCount('3 de 3')
    record(
      'K2 ↵ digitado logo depois do texto também anda pelos resultados',
      !!state,
      {
        count: state?.count
      }
    )

    // ---------- L. trocar de aba fecha e limpa ----------
    await L.keys(FIND.cmd('2'))
    const closedBySwitch = await waitClosed()
    s = await L.st()
    record(
      'L1 trocar de aba (⌘2) fecha a barra',
      !!closedBySwitch && activeOf(s) === 'f2',
      { active: activeOf(s) }
    )
    await L.keys(FIND.cmd('1'))
    await sleep(700)
    marks = await highlights('find.test/a')
    record(
      'L2 de volta à primeira aba, ela não tem destaques nem barra',
      !(await L.findBar()) && marks.results === 0 && marks.active === 0,
      { marks }
    )

    // ---------- M. aba suspensa: acorda, e a busca roda quando a página carrega ----------
    await L.send('tab:suspend', { tabId: 'f2' })
    await sleep(600)
    s = await L.st()
    const dormantBefore = s.tabs.find((t: L.Json) => t.id === 'f2').dormant
    const t1 = Date.now()
    await L.keys(FIND.cmd('2'))
    await L.waitFor(async () => activeOf(await L.st()) === 'f2', 3000)
    await L.keys(`${FIND.cmdF}\n${K.type('banana')}`)
    state = await waitBar('banana', '1 de 3', 8000)
    const wokeMs = Date.now() - t1
    s = await L.st()
    await sleep(300)
    const wokeMarks = await highlights('find.test/b')
    record(
      'M1 aba suspensa: ⌘2 acorda, ⌘F abre, a busca conta quando a página termina de carregar e pinta com as cores do design',
      dormantBefore === true &&
        !!state &&
        state.value === 'banana' &&
        activeOf(s) === 'f2' &&
        s.tabs.find((t: L.Json) => t.id === 'f2').dormant === false &&
        wokeMarks.results > 0 &&
        wokeMarks.active > 0,
      { dormantBefore, wokeMs, state, bar: await bar(), wokeMarks }
    )

    // ---------- N. a página navega com a barra aberta ----------
    await L.send('tab:navigate', {
      tabId: 'f2',
      input: 'http://find.test/c?t=Busca%20C'
    })
    await L.waitFor(async () => {
      const x = await L.st()
      return urlOf(x, 'f2')?.includes('find.test/c')
    }, 5000)
    await sleep(1500)
    state = await waitCount('1 de 3', 6000)
    marks = await highlights('find.test/c')
    record(
      'N1 página nova com a barra aberta: a barra fica, a busca recomeça do primeiro resultado e os destaques têm as cores do design',
      !!state &&
        state.value === 'banana' &&
        marks.results > 0 &&
        marks.active > 0,
      { state, now: await bar(), marks }
    )

    // ---------- O. menu Editar ----------
    const menu = await L.mainEval(`(() => {
      const { Menu } = process.mainModule.require('electron')
      const edit = Menu.getApplicationMenu().items.find(i => i.label === 'Editar')
      return edit.submenu.items.filter(i => i.label).map(i => [i.label, i.accelerator || ''])
    })()`)
    const labels = menu.map((item: string[]) => item[0])
    const findItems = menu.filter((item: string[]) => /^Buscar/.test(item[0]))
    record(
      'O1 menu Editar: Buscar na Página… ⌘F, Buscar Próximo ⌘G e Buscar Anterior ⇧⌘G (e o resto do Editar segue)',
      JSON.stringify(findItems) ===
        JSON.stringify([
          ['Buscar na Página…', 'CmdOrCtrl+F'],
          ['Buscar Próximo', 'CmdOrCtrl+G'],
          ['Buscar Anterior', 'CmdOrCtrl+Shift+G']
        ]) &&
        [
          /^(Copiar|Copy)/,
          /^(Colar|Paste)/,
          /^(Selecionar Tudo|Select All)/
        ].every(pattern => labels.some((name: string) => pattern.test(name))),
      { menu }
    )

    // ---------- P. o layout acompanha a janela ----------
    const geo = async () =>
      L.mainEval(`(() => {
        const { BaseWindow } = process.mainModule.require('electron')
        const win = BaseWindow.getAllWindows()[0]
        const view = win.contentView.children.find(c => c.webContents && c.webContents.getURL().includes('find.html'))
        return { width: win.getContentSize()[0], view: view.getBounds() }
      })()`)
    let g = await geo()
    const rightOk = (x: L.Json) => x.view.x + x.view.width === x.width
    const first = { ...g }
    await L.mainEval(`(() => {
      const { BaseWindow } = process.mainModule.require('electron')
      const win = BaseWindow.getAllWindows()[0]
      const [w, h] = win.getContentSize()
      win.setContentSize(w - 240, h)
    })()`)
    await sleep(500)
    g = await geo()
    const resized = { ...g }
    await L.keys(FIND.cmd('s'))
    await sleep(500)
    g = await geo()
    record(
      'P1 a barra fica no canto do painel ao redimensionar a janela e ao ocultar a sidebar (a direita dela é sempre a da janela)',
      rightOk(first) &&
        rightOk(resized) &&
        rightOk(g) &&
        resized.view.x < first.view.x,
      { first, resized, hidden: g }
    )
    await L.keys(FIND.cmd('s'))
    await sleep(400)

    // ---------- Q. fechar a aba com a barra aberta ----------
    await L.keys(FIND.cmd('w'))
    const closedByTab = await waitClosed()
    record('Q1 fechar a aba (⌘W) fecha a barra', !!closedByTab, {})

    // ---------- R. ⌘F com a paleta aberta ----------
    await activate('f1')
    await L.keys(K.cmdK)
    await L.waitFor(async () => (await L.pal()).open, 3000)
    await L.keys(FIND.cmdF)
    state = await waitReady()
    await sleep(300)
    s = await L.st()
    record(
      'R1 ⌘F com a paleta aberta: a paleta fecha e a barra abre com o foco',
      !!state && !(await L.pal()).open && !s.overlay.includes('palette'),
      { state, overlay: s.overlay }
    )

    // ---------- S. página de erro com a barra aberta ----------
    await L.keys(K.type('banana'))
    await waitCount('1 de 3')
    await L.send('tab:navigate', { tabId: 'f1', input: 'http://127.0.0.1:1/' })
    const closedByError = await waitClosed(6000)
    s = await L.st()
    record(
      'S1 a página de erro (da shell) fecha a barra',
      !!closedByError && !!s.tabs.find((t: L.Json) => t.id === 'f1').error,
      { error: s.tabs.find((t: L.Json) => t.id === 'f1').error }
    )
    await L.send('tab:navigate', {
      tabId: 'f1',
      input: 'http://find.test/a?t=Busca%20A'
    })
    await L.waitFor(async () => {
      const x = await L.st()
      return !x.tabs.find((t: L.Json) => t.id === 'f1').error
    }, 6000)
    await sleep(800)

    // ---------- T. abrir e fechar 30 vezes: nada sobra ----------
    const stats = () =>
      L.mainEval(`(() => {
        const { webContents, BaseWindow, ipcMain, app } = process.mainModule.require('electron')
        const all = webContents.getAllWebContents()
        const pageWc = all.find(w => w.getURL().includes('find.test/a'))
        const win = BaseWindow.getAllWindows()[0]
        const events = ['found-in-page', 'did-navigate', 'did-stop-loading', 'before-input-event', 'destroyed']
        return {
          contents: all.length,
          children: win.contentView.children.length,
          page: events.map(e => pageWc.listenerCount(e)),
          ipc: ['find:ready', 'find:text', 'find:step', 'find:case', 'find:close', 'find:pointer'].map(c => ipcMain.listenerCount(c)),
          win: win.eventNames().map(n => win.listenerCount(n)).join(','),
          processes: app.getAppMetrics().length
        }
      })()`)
    await focusPage('find.test/a')
    const before = await stats()
    const cycles: number[] = []
    for (let i = 0; i < 30; i++) {
      const t = Date.now()
      await L.keys(FIND.cmdF)
      const opened = await waitReady()
      cycles.push(opened ? Date.now() - t : -1)
      await L.keys(K.esc)
      await waitClosed()
    }
    await sleep(2000)
    const after = await stats()
    record(
      'T1 abrir e fechar a barra 30 vezes com teclas reais: nenhum listener, view, webContents ou processo sobra',
      JSON.stringify(before) === JSON.stringify(after) &&
        cycles.every(ms => ms > 0),
      { before, after, cycles }
    )

    // ---------- U. a barra mede e pinta como o design (Busca.dc.html) ----------
    const source = readFileSync(
      join(L.APP, '..', 'design', 'fonte', 'Busca.dc.html'),
      'utf8'
    )
    const designBar = source.slice(
      source.indexOf('<div role="search"'),
      source.indexOf('</main>')
    )
    await L.keys(FIND.cmdF)
    await waitReady()
    const measured = await L.ev(
      (await L.findBar()) as NonNullable<Awaited<ReturnType<typeof L.findBar>>>,
      `(() => {
        const describe = base => {
          const b = base.getBoundingClientRect()
          const els = [base, ...base.querySelectorAll('input, span, button, div')]
          return els.map(el => {
            const r = el.getBoundingClientRect()
            const cs = getComputedStyle(el)
            return {
              x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height,
              style: [cs.color, cs.backgroundColor, cs.fontSize, cs.fontWeight, cs.fontFamily, cs.borderRadius, cs.boxShadow, cs.padding].join(' | ')
            }
          })
        }
        // o mesmo texto do design na caixa e no contador
        document.getElementById('find-input').value = 'webcontents'
        document.querySelector('.find-count').textContent = '1 de 3'
        const host = document.createElement('div')
        host.style.cssText = 'position:absolute; left:20px; top:12px; width:600px; height:44px; color:#17181C'
        host.innerHTML = ${JSON.stringify(designBar)}
        document.body.appendChild(host)
        const design = host.querySelector('[role=search]')
        Object.assign(design.style, { position: 'absolute', left: '0', top: '0', right: 'auto' })
        const result = { ours: describe(document.querySelector('.find-bar')), design: describe(design) }
        host.remove()
        return result
      })()`
    )
    const mismatches = measured.ours
      .map((ours: L.Json, i: number) => {
        const design = measured.design[i]
        const off = ['x', 'y', 'w', 'h'].filter(
          key => Math.abs(ours[key] - design[key]) > 0.5
        )
        return off.length || ours.style !== design.style
          ? { i, ours, design }
          : null
      })
      .filter(Boolean)
    record(
      'U1 claro: cada elemento da barra na posição e no tamanho do design (meio ponto de folga) e com as mesmas cores, fonte, raio e sombra',
      measured.ours.length === measured.design.length &&
        mismatches.length === 0,
      { mismatches, count: measured.ours.length }
    )

    // ---------- V. escuro ----------
    await L.mainEval(
      `(process.mainModule.require('electron').nativeTheme.themeSource = 'dark', true)`
    )
    const dark = await L.waitFor(async () => {
      const target = await L.findBar()
      if (!target) return null
      const value = await L.ev(
        target,
        `(() => { const q = s => getComputedStyle(document.querySelector(s)); return { theme: document.querySelector('.root').dataset.theme, bar: q('.find-bar').backgroundColor, input: q('.find-input').color, count: q('.find-count').color, button: q('.find-button').color, close: q('.find-close').color, sep: q('.find-separator').backgroundColor } })()`
      )
      return value.theme === 'dark' ? value : null
    }, 3000)
    record(
      'V1 escuro com a barra aberta: ela troca para as cores do escuro (fundo da paleta escura, textos dos tokens)',
      !!dark &&
        dark.bar === 'rgba(38, 39, 45, 0.97)' &&
        dark.input === 'rgb(241, 241, 244)' &&
        dark.count === 'rgb(163, 164, 173)' &&
        dark.button === 'rgb(201, 202, 210)' &&
        dark.close === 'rgb(163, 164, 173)' &&
        dark.sep === 'rgba(255, 255, 255, 0.12)',
      { dark }
    )
    await L.mainEval(
      `(process.mainModule.require('electron').nativeTheme.themeSource = 'light', true)`
    )
    await L.keys(K.esc)
    await waitClosed()

    // ---------- W. nenhuma exceção ----------
    const errors = await L.mainEval('global.__errors')
    record(
      'W1 nenhuma exceção no main nem erro no console da shell ou da barra',
      errors.length === 0,
      { errors }
    )
  },
  { fixture }
)
