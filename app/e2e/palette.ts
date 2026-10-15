// Paleta ⌘K e ⌘L de ponta a ponta: abrir com o foco no campo, nada vaza para a página, filtro,
// setas, ↵ entre espaços, escopo, ⌘↵ e ⌥↵, modo endereço, Nova aba, histórico gravado e migrado,
// véu, vazamento de views e latência do ⌘K ao primeiro quadro. Pré-requisito: npm run build.
// Uso: npm run e2e:palette
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as L from './lib.ts'

const { K, sleep } = L
const activeOf = (s: L.Json) =>
  s.tabs.find(
    (t: L.Json) => t.id === s.window.activeTabBySpace[s.window.spaceId]
  )
const openPal = () =>
  L.waitFor(async () => {
    const p = await L.pal()
    return p.open && p.rows.length ? p : null
  }, 3000)
const closedPal = () =>
  L.waitFor(async () => {
    const p = await L.pal()
    return !p.open ? p : null
  }, 3000)
const lettersIn = async (fragment: string) =>
  ((await L.pageFocus(fragment))?.keys ?? []).filter(
    (key: string) => key.length === 1
  )

async function ensureClosed(): Promise<void> {
  if ((await L.pal()).open) {
    await L.send('palette:close', {})
    await sleep(300)
  }
}

async function activate(tabId: string): Promise<void> {
  await ensureClosed()
  await L.send('tab:activate', { tabId })
  await sleep(500)
}

await L.runSuite('palette', async (record, profile) => {
  let s = await L.st()
  record(
    'preparação: 5 abas, espaço Pessoal, aba keylog ativa',
    s.tabs.length === 5 && activeOf(s).id === 'k1',
    { tabs: s.tabs.map((t: L.Json) => [t.id, t.url]) }
  )

  // ---------- A. ⌘K abre, foco no campo, nada vaza para a página; esc fecha e devolve o foco ----------
  await activate('k1')
  await L.resetKeys('keylog.test')
  await L.keys(K.cmdK)
  let p = await openPal()
  let page = await L.pageFocus('keylog.test')
  record(
    'A1 ⌘K abre a paleta com o foco no campo e nada chega à página',
    !!p && p.inputFocused && page.keys.length === 0,
    { pageKeys: page.keys }
  )
  record(
    'A2 consulta vazia: Abas recentes (3), Ações, e todas as ações com atalho',
    !!p &&
      p.sections.join() === 'Abas recentes,Ações' &&
      p.selected === 0 &&
      p.rows.slice(3).every((row: string) => / \| .+$/.test(row)),
    { sections: p?.sections, rows: p?.rows }
  )
  await L.keys(K.esc)
  p = await closedPal()
  await sleep(300)
  page = await L.pageFocus('keylog.test')
  record(
    'A3 esc fecha e o foco volta à página (no campo em que estava)',
    !!p &&
      page.hasFocus &&
      page.active === 'field' &&
      !page.keys.includes('Escape'),
    { page }
  )

  // ---------- B. digitar logo depois do atalho, sem pausa ----------
  const failsK: unknown[] = []
  for (let i = 0; i < 10; i++) {
    await activate('k1')
    await L.resetKeys('keylog.test')
    await L.keys(`${K.cmdK}\n${K.type('linear')}`)
    await sleep(700)
    p = await L.pal()
    const leaked = await lettersIn('keylog.test')
    if (!(p.open && p.text === 'linear' && leaked.length === 0))
      failsK.push({ text: p.text, open: p.open, leaked })
    await L.keys(K.esc)
    await sleep(300)
  }
  record(
    'B1 ⌘K + "linear" sem pausa: texto completo na paleta e nada na página (10 rodadas)',
    failsK.length === 0,
    { falhas: failsK }
  )

  const failsL: unknown[] = []
  for (let i = 0; i < 5; i++) {
    await activate('k1')
    const n = (await L.st()).tabs.length
    await L.keys(`${K.cmdL}\n${K.type('beta.test')}\n${K.enter}`)
    const done = await L.waitFor(async () => {
      const x = await L.st()
      return x.tabs.find((t: L.Json) => t.id === 'k1').url.includes('beta.test')
        ? x
        : null
    }, 4000)
    const leaked = await lettersIn('keylog.test')
    if (!(done && done.tabs.length === n && !(await L.pal()).open))
      failsL.push({ tabs: (await L.st()).tabs.length, leaked })
    await L.send('tab:navigate', { tabId: 'k1', input: 'http://keylog.test/' })
    await L.waitFor(
      async () =>
        (await L.st()).tabs
          .find((t: L.Json) => t.id === 'k1')
          .url.includes('keylog.test'),
      4000
    )
    await sleep(500)
  }
  record(
    'B2 ⌘L + "beta.test" + ↵ sem pausa navega a mesma aba (5 rodadas)',
    failsL.length === 0,
    { falhas: failsL }
  )

  // ---------- C. filtrar, setas, ↵ abre aba de outro espaço ----------
  await activate('k1')
  await L.keys(`${K.cmdK}\n${K.type('linear')}`)
  p = await L.waitFor(async () => {
    const x = await L.pal()
    return x.text === 'linear' && x.rows.length ? x : null
  }, 3000)
  record(
    'C1 "linear": aba do Trabalho com selo, favorito e ações',
    !!p &&
      /Minhas issues no Linear/.test(p.rows[0]) &&
      /Trabalho/.test(p.rows[0]) &&
      p.sections.includes('Favoritos'),
    { sections: p?.sections, rows: p?.rows }
  )
  const total = p ? p.rows.length : 0
  const selectedAfter = async (key: string) => {
    await L.keys(key)
    await sleep(150)
    return (await L.pal()).selected
  }
  const d1 = await selectedAfter(K.down)
  const u0 = await selectedAfter(K.up)
  const wrap = await selectedAfter(K.up)
  const back = await selectedAfter(K.down)
  record(
    'C2 ↓ ↑ navegam e dão a volta',
    d1 === 1 && u0 === 0 && wrap === total - 1 && back === 0,
    { d1, u0, wrap, back, total }
  )
  await L.keys(K.enter)
  await closedPal()
  await sleep(700)
  s = await L.st()
  const lin = await L.pageFocus('linear.test/team')
  record(
    'C3 ↵ na aba de outro espaço troca para o Trabalho, ativa a aba e dá foco à página',
    s.window.spaceId === 'work' &&
      activeOf(s).id === 'w1' &&
      !!lin &&
      lin.hasFocus,
    { space: s.window.spaceId, ativa: activeOf(s).url, foco: lin }
  )
  await L.send('space:switch', { spaceId: 'personal' })
  await sleep(600)

  // ---------- D. ⇥ escopo ----------
  await activate('k1')
  await L.keys(`${K.cmdK}\n${K.type('linear')}`)
  await sleep(600)
  const beforeTab = await L.pal()
  await L.keys(K.tab)
  await sleep(500)
  const afterTab = await L.pal()
  record(
    'D1 ⇥ restringe ao Pessoal (some a aba do Trabalho) e o rodapé muda',
    /só no Pessoal/.test(beforeTab.footer) &&
      /todos os espaços/.test(afterTab.footer) &&
      !afterTab.rows.some((row: string) => row.includes('Minhas issues')),
    { antes: beforeTab.footer, depois: afterTab.footer }
  )
  await L.keys(K.esc)
  await sleep(300)

  // ---------- E. ⌘↵ e ⌥↵ ----------
  await activate('k1')
  let n = (await L.st()).tabs.length
  await L.keys(`${K.cmdK}\n${K.type('alpha.test/three')}`)
  await sleep(500)
  await L.keys(K.cmdEnter)
  let x = await L.waitFor(async () => {
    const y = await L.st()
    return y.tabs.find((t: L.Json) => t.url.includes('alpha.test/three'))
      ? y
      : null
  }, 4000)
  record(
    'E1 ⌘↵ abre o endereço digitado em aba nova',
    !!x &&
      x.tabs.length === n + 1 &&
      activeOf(x).url.includes('alpha.test/three'),
    { tabs: x?.tabs.length }
  )
  await activate('k1')
  n = (await L.st()).tabs.length
  await L.keys(`${K.cmdK}\n${K.type('termo xyz')}`)
  await sleep(500)
  await L.keys(K.optEnter)
  x = await L.waitFor(async () => {
    const y = await L.st()
    return y.tabs.find((t: L.Json) =>
      /google\.com\/search\?q=termo/.test(t.url)
    )
      ? y
      : null
  }, 4000)
  record('E2 ⌥↵ busca na web em aba nova', !!x && x.tabs.length === n + 1, {
    ativa: x && activeOf(x).url
  })

  // ---------- F. ⌘L: modo endereço ----------
  await activate('k1')
  await L.keys(K.cmdL)
  p = await openPal()
  record(
    'F1 ⌘L: URL da aba selecionada, nenhuma linha escolhida, rodapé "↵ para ir"',
    !!p &&
      p.text === 'http://keylog.test/' &&
      p.selStart === 0 &&
      p.selEnd === p.text.length &&
      p.selected === -1 &&
      /para ir/.test(p.footer),
    { text: p?.text, selected: p?.selected, footer: p?.footer }
  )
  await L.keys(K.esc)
  await closedPal()
  await sleep(300)
  page = await L.pageFocus('keylog.test')
  record('F2 esc no ⌘L devolve o foco à página', page.hasFocus, page)

  // ---------- H. histórico gravado, âncoras e migração do formato antigo ----------
  await activate('h1')
  const hist = (await L.pageOf('hist.test')) as NonNullable<
    Awaited<ReturnType<typeof L.pageOf>>
  >
  await L.ev(hist, `location.hash = 'a'; true`)
  await sleep(300)
  await L.ev(hist, `location.hash = 'b'; true`)
  await sleep(300)
  await L.send('tab:close', { tabId: 'h1' })
  await sleep(2800)
  const jsonl = readFileSync(join(profile, 'history.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line))
  const urls: string[] = jsonl
    .filter(line => line.visitedAt)
    .map(line => line.url)
  const histRows = (await L.query('Âncoras'))
    .filter(section => section.id === 'history')
    .flatMap(section => section.items)
  record(
    'H1 history.jsonl tem as visitas (beta, alpha/two, alpha/three)',
    ['beta.test', 'alpha.test/three'].every(u => urls.some(v => v.includes(u))),
    { linhas: jsonl.length, urls: [...new Set(urls)] }
  )
  record(
    'H2 âncoras #a e #b viram uma entrada só no histórico',
    histRows.length === 1,
    { histRows }
  )
  record(
    'H3 histórico antigo (history-personal.json) aparece na paleta',
    (await L.query('changelog')).some(section => section.id === 'history'),
    {}
  )

  // ---------- I. clique no véu fecha ----------
  await activate('k1')
  s = await L.st()
  await L.keys(K.cmdK)
  await openPal()
  await L.click(s.window.bounds.x + 1300, s.window.bounds.y + 760)
  p = await closedPal()
  await sleep(300)
  record(
    'I1 clique no véu fecha a paleta sem trocar de aba',
    !!p && activeOf(await L.st()).id === 'k1',
    {}
  )

  // ---------- J. ⌘K alterna ----------
  await activate('k1')
  await L.keys(K.cmdK)
  await openPal()
  await L.keys(K.cmdK)
  record('J1 ⌘K com a paleta aberta fecha', !!(await closedPal()), {})

  // ---------- K. vazamentos ----------
  await activate('k1')
  const t0 = (await L.targets()).length
  const p0 = L.countProcs()
  for (let i = 0; i < 15; i++) {
    await L.keys(K.cmdK)
    await sleep(250)
    await L.keys(K.esc)
    await sleep(250)
  }
  await sleep(800)
  const t1 = (await L.targets()).length
  const p1 = L.countProcs()
  record(
    'K1 15 aberturas da paleta não criam views nem processos',
    t1 === t0 && p1 === p0,
    { targets: [t0, t1], procs: [p0, p1] }
  )

  // ---------- L. latência: do ⌘K no main ao requestAnimationFrame da shell ----------
  await activate('k1')
  await L.mainEval(`(() => {
    const { webContents } = process.mainModule.require('electron')
    globalThis.__lat = []
    for (const wc of webContents.getAllWebContents()) {
      if (wc.__e2e) continue
      wc.__e2e = true
      wc.prependListener('before-input-event', (_e, i) => {
        if (i.type === 'keyDown' && i.meta && i.key.toLowerCase() === 'k') globalThis.__lat.push({ k: 'key', t: performance.timeOrigin + performance.now() })
      })
    }
    return true
  })()`)
  await L.ev(
    await L.shell(),
    `(() => {
    window.__raf = []
    new MutationObserver(() => {
      if (document.querySelector('.pal') && !window.__pending) {
        window.__pending = true
        requestAnimationFrame(() => { const a = performance.timeOrigin + performance.now(); requestAnimationFrame(() => { window.__raf.push({ raf1: a, raf2: performance.timeOrigin + performance.now() }); window.__pending = false }) })
      }
    }).observe(document.body, { childList: true, subtree: true })
    return true
  })()`
  )
  for (let i = 0; i < 12; i++) {
    await L.keys(K.cmdK)
    await sleep(500)
    await L.send('palette:close', {})
    await sleep(400)
  }
  const lat = JSON.parse(await L.mainEval(`JSON.stringify(globalThis.__lat)`))
  const rafs = await L.ev(await L.shell(), `window.__raf`)
  const keyTimes: number[] = lat
    .filter((e: L.Json) => e.k === 'key')
    .map((e: L.Json) => e.t)
  const toRaf1: number[] = keyTimes
    .map((k, i) => (rafs[i] ? rafs[i].raf1 - k : NaN))
    .filter(v => !Number.isNaN(v))
  const median = [...toRaf1].sort((a, b) => a - b)[
    Math.floor(toRaf1.length / 2)
  ]
  record(
    'L1 do ⌘K no main ao requestAnimationFrame da shell < 50 ms',
    toRaf1.length > 0 && Math.max(...toRaf1) < 50,
    {
      medianaMs: +median?.toFixed(1),
      maxMs: +Math.max(...toRaf1).toFixed(1),
      amostras: toRaf1.length
    }
  )
})
