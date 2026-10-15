// Portão de teclas da Nova aba: ⌘T com digitação imediata (nada pode vazar para a página anterior
// nem se perder), com pausas diferentes, com Backspace, com ← → Delete logo depois, e o cursor
// depois da abertura. Pré-requisito: npm run build. Uso: npm run e2e:new-tab [rodadas]
import * as L from './lib.ts'

const { K, sleep } = L
const ROUNDS = Number(process.argv[2] || 10)
const activeOf = (s: L.Json) =>
  s.tabs.find(
    (t: L.Json) => t.id === s.window.activeTabBySpace[s.window.spaceId]
  )

interface Round {
  url: string | null
  ntValue: string | null
  paginaRecebeu: string
  campoDaPagina: string
}

// uma rodada: ⌘T, [pausa], teclas; devolve o que a Nova aba e a página anterior tiveram
async function round(script: string, waitMs = 1500): Promise<Round> {
  await L.send('tab:activate', { tabId: 'k1' })
  await sleep(600)
  const page = (await L.pageOf('keylog.test')) as NonNullable<
    Awaited<ReturnType<typeof L.pageOf>>
  >
  await L.ev(
    page,
    `window.keys = []; document.getElementById('field').value = ''; document.getElementById('field').focus(); true`
  )
  const ids = new Set((await L.st()).tabs.map((t: L.Json) => t.id))
  await L.keys(script)
  await sleep(waitMs)
  const s = await L.st()
  const created = s.tabs.find((t: L.Json) => !ids.has(t.id))
  const seen = await L.ev(
    page,
    `({ keys: window.keys, value: document.getElementById('field').value })`
  )
  const nt = await L.pal()
  if (created) await L.send('tab:close', { tabId: created.id })
  await sleep(350)
  return {
    url: created ? created.url : null,
    ntValue: nt.ntValue,
    paginaRecebeu: seen.keys.join(' '),
    campoDaPagina: seen.value
  }
}

await L.runSuite('new-tab', async record => {
  const navigates = (r: Round, fragment: string) =>
    !!r.url && r.url.includes(fragment) && r.paginaRecebeu === ''

  let fails: Round[] = []
  for (let i = 0; i < ROUNDS; i++) {
    const r = await round(`${K.cmdT}\n${K.type('alpha.test/four')}\n${K.enter}`)
    if (!navigates(r, 'alpha.test/four')) fails.push(r)
  }
  record(
    `N1 ⌘T + "alpha.test/four" + ↵ sem pausa navega a Nova aba e nada vaza (${ROUNDS} rodadas)`,
    fails.length === 0,
    { falhas: fails }
  )

  fails = []
  for (let i = 0; i < ROUNDS; i++) {
    const r = await round(`${K.cmdT}\n${K.type('segredo')}\n${K.enter}`)
    if (!navigates(r, 'q=segredo')) fails.push(r)
  }
  record(
    `N2 ⌘T + "segredo" + ↵ sem pausa vira busca e nada vaza (${ROUNDS} rodadas)`,
    fails.length === 0,
    { falhas: fails }
  )

  // a fronteira do portão: pausas diferentes entre o ⌘T e a digitação
  for (const ms of [0, 30, 80, 150, 250, 450, 700]) {
    fails = []
    for (let i = 0; i < 4; i++) {
      const r = await round(
        `${K.cmdT}\n${K.delay(ms)}\n${K.type('alpha.test/four')}\n${K.enter}`
      )
      if (!navigates(r, 'alpha.test/four')) fails.push(r)
    }
    record(
      `N3 pausa de ${ms} ms entre ⌘T e a digitação (4 rodadas)`,
      fails.length === 0,
      { falhas: fails }
    )
  }

  fails = []
  for (let i = 0; i < ROUNDS / 2; i++) {
    const r = await round(
      `${K.cmdT}\n${K.type('alphx')}\n${K.backspace}\n${K.type('a.test/four')}\n${K.enter}`
    )
    if (!navigates(r, 'alpha.test/four')) fails.push(r)
  }
  record(
    'N4 Backspace logo depois do ⌘T apaga a última letra repassada',
    fails.length === 0,
    { falhas: fails }
  )

  fails = []
  for (let i = 0; i < ROUNDS / 2; i++) {
    const keysScript = [
      K.cmdT,
      K.left,
      K.right,
      K.deleteForward,
      K.home,
      K.end,
      K.type('segredo'),
      K.enter
    ].join('\n')
    const r = await round(keysScript)
    if (
      /Arrow|Delete|Home|End/.test(r.paginaRecebeu) ||
      !(r.url && /q=segredo/.test(r.url))
    )
      fails.push(r)
  }
  record(
    'N5 ← → Delete Home End logo depois do ⌘T não vazam para a página',
    fails.length === 0,
    { falhas: fails }
  )

  // depois da abertura: digitação nativa, cursor no fim, ordem certa
  await L.send('tab:activate', { tabId: 'k1' })
  await sleep(600)
  await L.keys(
    [K.cmdT, K.delay(900), K.type('abc'), K.left, K.type('X')].join('\n')
  )
  await sleep(500)
  let p = await L.pal()
  record(
    'N6 depois da abertura, digitação nativa: "abc" ← "X" dá "abXc"',
    p.ntFocused && p.ntValue === 'abXc',
    { ntFocused: p.ntFocused, ntValue: p.ntValue }
  )

  // o começo passa pelo portão e o resto é nativo, na mesma digitação
  await L.send('tab:close', { tabId: activeOf(await L.st()).id })
  await sleep(400)
  await L.send('tab:activate', { tabId: 'k1' })
  await sleep(600)
  await L.keys(
    [K.cmdT, K.type('abcdef'), K.delay(800), K.type('XY')].join('\n')
  )
  await sleep(500)
  p = await L.pal()
  record(
    'N7 digitação que começa no portão e termina nativa: "abcdefXY" inteiro',
    p.ntFocused && p.ntValue === 'abcdefXY',
    { ntFocused: p.ntFocused, ntValue: p.ntValue }
  )

  // ⌘L numa Nova aba seleciona o texto; digitar o substitui
  await L.keys(K.cmdL)
  await sleep(400)
  p = await L.pal()
  record(
    'N8 ⌘L na Nova aba seleciona o texto do campo',
    p.ntFocused &&
      p.ntSelStart === 0 &&
      p.ntSelEnd === 8 &&
      p.ntValue === 'abcdefXY',
    { p }
  )
  await L.keys(K.type('zz'))
  await sleep(300)
  p = await L.pal()
  record('N8b digitar depois do ⌘L substitui a seleção', p.ntValue === 'zz', {
    ntValue: p.ntValue
  })

  // ⌘K e esc devolvem o foco ao campo, com o texto e o cursor no fim
  await L.keys(K.cmdK)
  await sleep(500)
  await L.keys(K.esc)
  await sleep(500)
  p = await L.pal()
  record(
    'N9 ⌘K e esc na Nova aba: o campo volta com o foco, texto "zz" e cursor no fim',
    p.ntFocused && p.ntValue === 'zz' && p.ntSelStart === 2 && p.ntSelEnd === 2,
    { p }
  )

  // ⌘T repetido cria duas abas, e a digitação vai para a última
  const before = (await L.st()).tabs.length
  await L.keys([K.cmdT, K.cmdT, K.type('segredo'), K.enter].join('\n'))
  await sleep(1500)
  const s = await L.st()
  record(
    'N10 ⌘T ⌘T + "segredo" + ↵: a digitação vai para a última aba criada',
    s.tabs.length === before + 2 && activeOf(s).url.includes('q=segredo'),
    { antes: before, depois: s.tabs.length, ativa: activeOf(s).url }
  )
})
