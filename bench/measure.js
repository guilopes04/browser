#!/usr/bin/env node
// Bancada de medição: abre um navegador com as dez abas de tabs.json e mede tempo de abertura e RAM.
// Uso: node bench/measure.js <chrome|zen|nosso|nosso-todas> [--rodadas=3] [--teste] [--preparar]
//   --teste     uma rodada de teste: grava só results/<nome>-teste.png e results/<nome>-teste.json
//   --preparar  recria o perfil-base e sai
// Variável BENCH_WORK: pasta temporária dos perfis (padrão: <tmp>/navegador-bench).
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const sys = require('./lib/system')
const { createBrowser, hostOf } = require('./lib/browsers')

const args = process.argv.slice(2)
const kind = args.find(arg => !arg.startsWith('--'))
const option = name => {
  const found = args.find(arg => arg.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}
const rounds = Number(option('rodadas') || 3)
const testMode = args.includes('--teste')
const prepareOnly = args.includes('--preparar')

const WORK = process.env.BENCH_WORK || path.join(os.tmpdir(), 'navegador-bench')
const TABS_FILE = path.join(sys.BENCH, 'tabs.json')
const RESULTS = path.join(sys.BENCH, 'results')
const tabsConfig = JSON.parse(fs.readFileSync(TABS_FILE, 'utf8'))
const TABS = tabsConfig.abas

const LOAD_TIMEOUT_MS = 180000
const SETTLE_MS = 30000
const IDLE_CPU_PCT = 10
const IDLE_HOLD_MS = 3000
const SAMPLE_MS = 500
const IDLE_MAX_WAIT_MS = 120000

if (!kind) {
  console.error('uso: node bench/measure.js <chrome|zen|nosso|nosso-todas> [--rodadas=3] [--teste] [--preparar]')
  process.exit(2)
}

fs.mkdirSync(WORK, { recursive: true })
fs.mkdirSync(RESULTS, { recursive: true })
const browser = createBrowser(kind, { work: WORK, tabs: TABS, tabsFile: TABS_FILE })

const shortUrl = url => {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`.slice(0, 60)
  } catch (e) {
    return String(url).slice(0, 60)
  }
}

const log = message => console.log(`[${browser.id}] ${message}`)

// Amostrador de CPU/RSS da árvore: %CPU vem da variação do tempo de CPU (ps time) entre amostras.
// (o %CPU do ps no macOS é média de vida inteira do processo, por isso não serve para detectar ociosidade)
function startSampler(state) {
  let running = true
  let previous = null
  const loop = (async () => {
    while (running) {
      const started = Date.now()
      const procs = await sys.snapshotProcesses()
      const middle = (started + Date.now()) / 2
      const tree = state.rootPid ? sys.collectTree(procs, state.rootPid, browser.marker) : []
      state.treePids = new Set(tree.map(proc => proc.pid))
      const current = new Map(tree.map(proc => [proc.pid, proc.cpuSeconds]))
      let cpu = null
      if (previous) {
        const elapsed = (middle - previous.at) / 1000
        let delta = 0
        for (const [pid, seconds] of current) {
          const before = previous.cpu.get(pid)
          delta += before === undefined ? seconds : Math.max(0, seconds - before)
        }
        cpu = (delta / elapsed) * 100
      }
      state.samples.push({
        at: middle,
        cpu,
        pcpu: tree.reduce((sum, proc) => sum + proc.pcpu, 0),
        rssKB: tree.reduce((sum, proc) => sum + proc.rssKB, 0),
        procs: tree.length
      })
      previous = { at: middle, cpu: current }
      await sys.sleep(Math.max(0, SAMPLE_MS - (Date.now() - started)))
    }
  })()
  return {
    stop: async () => {
      running = false
      await loop
    }
  }
}

// Primeiro instante (ms desde t0, não antes de fromMs) em que a CPU da árvore fica abaixo do limite por IDLE_HOLD_MS seguidos.
function findIdle(samples, t0, fromMs) {
  let start = null
  let previousAt = null
  for (const sample of samples) {
    const intervalStart = previousAt
    previousAt = sample.at
    if (sample.cpu === null || sample.at - t0 < fromMs) {
      start = null
      continue
    }
    if (sample.cpu < IDLE_CPU_PCT) {
      if (start === null) start = Math.max(intervalStart === null ? sample.at : intervalStart, t0 + fromMs)
      if (sample.at - start >= IDLE_HOLD_MS) return Math.round(start - t0)
    } else {
      start = null
    }
  }
  return null
}

async function waitLoaded(probe, state) {
  const deadline = Date.now() + LOAD_TIMEOUT_MS
  let lastPages = []
  let lastError = null
  let okSince = null
  const timeline = new Map()
  while (Date.now() < deadline) {
    if (state.exited) throw new Error(`o navegador terminou antes de carregar (código ${state.exitCode})`)
    try {
      const pages = await probe.pages()
      lastPages = pages
      for (const page of pages) {
        if (page.readyState === 'complete' && !timeline.has(page.id)) timeline.set(page.id, { url: page.url, at: Date.now() })
      }
      const done = pages.length >= browser.expectedPages && pages.every(page => page.readyState === 'complete')
      if (done) {
        const at = Date.now()
        if (okSince === null) okSince = at
        if (browser.grace === 0 || at - okSince >= browser.grace) return { at: okSince, pages, timeline, erro: null }
      } else {
        okSince = null
      }
    } catch (error) {
      lastError = error.message
      okSince = null
    }
    await sys.sleep(100)
  }
  return { at: null, pages: lastPages, timeline, erro: lastError || 'timeout esperando as páginas' }
}

async function systemLoad() {
  const { stdout } = await sys.run('sh', ['-c', 'top -l 2 -n 0 -s 1 | grep "CPU usage" | tail -1'])
  return { loadavg: os.loadavg().map(value => Number(value.toFixed(2))), cpu: stdout.trim() }
}

function spawnBrowser(args, state) {
  const child = spawn(browser.binary, args, { cwd: browser.cwd, stdio: 'ignore' })
  state.rootPid = child.pid
  child.on('exit', code => {
    state.exited = true
    state.exitCode = code
  })
  child.on('error', error => {
    state.exited = true
    state.exitCode = error.message
  })
  return child
}

// Abre o navegador sem abas, só para criar o perfil (primeira execução, preferências, avisos).
async function prepareBase() {
  log('preparando perfil-base')
  await sys.run('pkill', ['-f', browser.baseMarker])
  if (browser.prepareBaseDir) browser.prepareBaseDir()
  const port = await sys.freePort()
  const state = { rootPid: null, exited: false, treePids: new Set(), samples: [] }
  spawnBrowser(browser.baseArgs(port), state)
  await sys.sleep(20000)
  const closed = await sys.shutdown(state.rootPid, browser.baseMarker)
  if (closed.sobraram > 0) log(`atenção: sobraram ${closed.sobraram} processos do perfil-base`)
  browser.cleanBase()
}

async function runRound(number) {
  const label = testMode ? 'teste' : `rodada${number}`
  log(`--- ${label} ---`)
  await sys.run('pkill', ['-f', browser.marker])
  browser.prepareProfile()
  const port = await sys.freePort()
  const state = {
    rootPid: null,
    exited: false,
    exitCode: null,
    treePids: new Set(),
    samples: [],
    windowAt: null,
    windowEvent: null
  }
  const round = { rodada: number, porta: port }
  const sampler = startSampler(state)
  const watcher = sys.watchWindows(event => {
    if (state.windowAt !== null || !state.rootPid) return
    const mine = event.pid === state.rootPid || state.treePids.has(event.pid)
    if (mine && event.width >= 400 && event.height >= 300) {
      state.windowAt = event.at
      state.windowEvent = event
      sys.bringToFront(event.pid)
    }
  })
  let probe = null
  try {
    await sys.sleep(1500)
    round.cargaAntes = await systemLoad()
    const t0 = Date.now()
    spawnBrowser(browser.args(port, TABS), state)
    log(`pid ${state.rootPid}, porta ${port}`)

    probe = browser.makeProbe(port)
    const loaded = await waitLoaded(probe, state)
    round.tempoCarregadoMs = loaded.at === null ? null : loaded.at - t0
    if (loaded.erro) round.erroCarga = loaded.erro
    round.paginasCompletasMs = [...loaded.timeline.values()]
      .map(item => ({ pagina: shortUrl(item.url), ms: item.at - t0 }))
      .sort((a, b) => a.ms - b.ms)
    // todas menos a mais lenta: mostra o quanto uma única página (carga eterna) puxa o tempo total
    round.tempoNovePaginasMs = browser.expectedPages > 1 && round.paginasCompletasMs.length >= browser.expectedPages - 1 ? round.paginasCompletasMs[browser.expectedPages - 2].ms : null
    log(`carregado em ${round.tempoCarregadoMs} ms (${loaded.pages.length} páginas)`)

    log(`aguardando ${SETTLE_MS / 1000} s`)
    await sys.sleep(SETTLE_MS)

    // RAM: soma da árvore (ps rss) e do phys_footprint
    const procs = await sys.snapshotProcesses()
    const tree = sys.collectTree(procs, state.rootPid, browser.marker)
    round.processos = tree.length
    round.rssMB = Number((tree.reduce((sum, proc) => sum + proc.rssKB, 0) / 1024).toFixed(1))
    const footprint = await sys.measureFootprint(
      tree.map(proc => proc.pid),
      WORK
    )
    round.footprintMB = footprint.totalMB === null ? null : Number(footprint.totalMB.toFixed(1))
    round.footprintDetalhe = { medidos: footprint.medidos, pedidos: footprint.pedidos, erros: footprint.erros, erro: footprint.erro }
    round.maioresProcessos = tree
      .slice()
      .sort((a, b) => b.rssKB - a.rssKB)
      .slice(0, 5)
      .map(proc => `${(proc.rssKB / 1024).toFixed(0)} MB ${path.basename(proc.command.split(' --')[0]).slice(0, 60)}`)
    log(`RAM: rss ${round.rssMB} MB, footprint ${round.footprintMB} MB, ${round.processos} processos`)

    try {
      round.paginas = (await probe.pages()).map(page => ({ url: page.url, titulo: page.title, estado: page.readyState }))
    } catch (error) {
      round.paginas = []
      round.erroPaginas = error.message
    }

    // Janela e captura (primeira aba ativa)
    round.tempoJanelaMs = state.windowAt === null ? null : state.windowAt - t0
    round.janelaPrimeira = state.windowEvent
      ? { x: state.windowEvent.x, y: state.windowEvent.y, largura: state.windowEvent.width, altura: state.windowEvent.height }
      : null
    try {
      round.primeiraAbaAtivada = await probe.activateFirst()
    } catch (error) {
      round.primeiraAbaAtivada = false
      round.erroAtivar = error.message
    }
    await sys.bringToFront(state.rootPid)
    await sys.sleep(2500)
    const windows = (await sys.listWindows())
      .filter(item => item.pid === state.rootPid || state.treePids.has(item.pid))
      .sort((a, b) => b.width * b.height - a.width * a.height)
    if (windows.length > 0) {
      const main = windows[0]
      round.janela = { id: main.id, dono: main.owner, titulo: main.title, x: main.x, y: main.y, largura: main.width, altura: main.height }
      const file = path.join(RESULTS, `${browser.id}-${label}.png`)
      await sys.captureWindow(main.id, file)
      round.captura = path.relative(sys.ROOT, file)
      log(`captura: ${round.captura} (${main.width}x${main.height})`)
    } else {
      round.erroCaptura = 'nenhuma janela do navegador na tela'
    }

    // Ociosidade (CPU da árvore < 10% por 3 s seguidos): segue observando até achar, no máximo IDLE_MAX_WAIT_MS após carregar
    const loadedRef = loaded.at === null ? Date.now() : loaded.at
    while (findIdle(state.samples, t0, round.tempoJanelaMs || 0) === null && Date.now() - loadedRef < IDLE_MAX_WAIT_MS && !state.exited) {
      await sys.sleep(1000)
    }
    round.tempoOciosoMs = findIdle(state.samples, t0, round.tempoJanelaMs || 0)
    round.tempoOciosoPosCargaMs = round.tempoCarregadoMs === null ? null : findIdle(state.samples, t0, round.tempoCarregadoMs)
    // CPU média nos 10 s anteriores à medição de RAM (regime de repouso com tudo carregado)
    if (loaded.at !== null) {
      const from = loaded.at + SETTLE_MS - 10000
      const resting = state.samples.filter(sample => sample.cpu !== null && sample.at >= from && sample.at <= loaded.at + SETTLE_MS)
      round.cpuRepousoPct = resting.length ? Number((resting.reduce((sum, sample) => sum + sample.cpu, 0) / resting.length).toFixed(1)) : null
    }
    round.cpuAmostras = state.samples.filter(sample => sample.cpu !== null && sample.at >= t0).map(sample => [Math.round(sample.at - t0), Number(sample.cpu.toFixed(1))])
  } finally {
    if (probe) probe.close()
    watcher.stop()
    await sampler.stop()
    const closed = await sys.shutdown(state.rootPid, browser.marker)
    round.sobraramProcessos = closed.sobraram
    if (closed.sobraram > 0) round.processosRestantes = closed.restantes
    log(closed.sobraram === 0 ? 'encerrado, sem processos restantes' : `ATENÇÃO: sobraram ${closed.sobraram} processos`)
  }
  return round
}

// Só o Zen: repete a abertura sem o agente remoto (ele liga navigator.webdriver e o Google devolve a tela de captcha
// no lugar da busca). Sem sondagem: espera o tempo de carga medido na rodada automatizada e mede a RAM igual.
async function runCleanRam(round) {
  log('RAM sem automação (sem --remote-debugging-port)')
  await sys.run('pkill', ['-f', browser.marker])
  browser.prepareProfile()
  const state = { rootPid: null, exited: false, exitCode: null, treePids: new Set(), samples: [] }
  const watcher = sys.watchWindows(event => {
    if (state.rootPid && event.pid === state.rootPid && event.width >= 400 && event.height >= 300) sys.bringToFront(event.pid)
  })
  try {
    const waitMs = Math.max(round.tempoCarregadoMs || 0, 15000) + SETTLE_MS
    spawnBrowser(browser.argsSemAutomacao(TABS), state)
    await sys.sleep(waitMs)
    const procs = await sys.snapshotProcesses()
    const tree = sys.collectTree(procs, state.rootPid, browser.marker)
    const footprint = await sys.measureFootprint(
      tree.map(proc => proc.pid),
      WORK
    )
    round.semAutomacao = {
      esperaMs: waitMs,
      processos: tree.length,
      rssMB: Number((tree.reduce((sum, proc) => sum + proc.rssKB, 0) / 1024).toFixed(1)),
      footprintMB: footprint.totalMB === null ? null : Number(footprint.totalMB.toFixed(1))
    }
    log(`sem automação: rss ${round.semAutomacao.rssMB} MB, footprint ${round.semAutomacao.footprintMB} MB, ${tree.length} processos`)
  } finally {
    watcher.stop()
    const closed = await sys.shutdown(state.rootPid, browser.marker)
    if (closed.sobraram > 0) round.sobraramProcessos = (round.sobraramProcessos || 0) + closed.sobraram
  }
}

function buildNotes(results) {
  const first = results[0] || {}
  const notes = []
  const size = first.janela ? `${first.janela.largura}x${first.janela.altura} em (${first.janela.x},${first.janela.y})` : 'desconhecida'
  notes.push(`Janela pedida: 1440x900 em (0,0). O macOS limita à área útil (abaixo da barra de menus e acima do Dock): janela real ${size}.`)
  notes.push('O macOS está no tema escuro (não alterado, é configuração do sistema); o tema claro foi forçado nas preferências do perfil temporário de cada navegador.')
  notes.push('footprintMB = soma do phys_footprint (/usr/bin/footprint) de toda a árvore; rssMB = soma do RSS do ps. Com a máquina em pressão de memória (swap quase cheio) o RSS cai muito porque o macOS comprime/troca páginas; o footprint conta o comprimido e é o número estável.')
  notes.push(`tempoCarregadoMs: de antes do spawn até todas as ${browser.expectedPages} páginas com document.readyState === 'complete' no mesmo instante de consulta (${browser.id === 'zen' ? 'WebDriver BiDi' : 'CDP'}). tempoJanelaMs: primeira janela da árvore com pelo menos 400x300 no CGWindowList (vigia a 25 ms). tempoOciosoMs: início do primeiro trecho de 3 s com CPU da árvore abaixo de 10% (um núcleo = 100%, medida pela variação do tempo de CPU do ps a cada 500 ms), depois da janela aparecer; null = não ficou ocioso em até 120 s após carregar.`)
  const loads = results.map(round => round.cargaAntes && round.cargaAntes.cpu).filter(Boolean)
  if (loads.length) notes.push(`Máquina com outros processos ativos (outros agentes, apps abertos); CPU antes de cada rodada: ${loads.join(' | ')}.`)
  const sorry = results.filter(round => (round.paginas || []).some(page => /google\.com\/sorry/.test(page.url))).length
  if (sorry) notes.push(`Em ${sorry} de ${results.length} rodadas a busca do Google virou a tela "google.com/sorry" (captcha)${browser.id === 'zen' ? ': o agente remoto do Firefox liga navigator.webdriver. A busca real é mais pesada; por isso a RAM foi medida de novo sem automação (medianaSemAutomacao)' : ', o que deixa essa aba mais leve que a busca real'}.`)
  if (results.some(round => round.erroCarga)) notes.push(`Rodadas com erro/timeout ao carregar: ${results.filter(round => round.erroCarga).map(round => `${round.rodada} (${round.erroCarga})`).join('; ')}.`)
  if (browser.id !== 'chrome' && browser.id !== 'zen') notes.push(`Modo ${browser.id}: espera ${browser.expectedPages} página(s) completas (${browser.expectedPages === 1 ? 'só a aba ativa; as outras ficam suspensas' : 'todas as abas'}).`)
  // notas escritas à mão sobre fatos do ambiente (results/<nome>-notas-extras.json, lista de textos)
  const extras = path.join(RESULTS, `${browser.id}-notas-extras.json`)
  if (fs.existsSync(extras)) notes.push(...JSON.parse(fs.readFileSync(extras, 'utf8')))
  return notes
}

async function main() {
  if (prepareOnly || !browser.baseExists()) await prepareBase()
  if (prepareOnly) return
  const count = testMode ? 1 : rounds
  const results = []
  for (let number = 1; number <= count; number++) {
    const round = await runRound(number)
    if (browser.argsSemAutomacao) await runCleanRam(round)
    results.push(round)
    if (testMode) fs.writeFileSync(path.join(RESULTS, `${browser.id}-teste.json`), JSON.stringify(round, null, 2) + '\n')
    await sys.sleep(3000)
  }
  if (testMode) return
  const metric = name => sys.median(results.map(round => round[name]))
  const output = {
    navegador: browser.id,
    versao: await browser.version(),
    quando: new Date().toISOString(),
    maquina: { modelo: 'MacBook Air M2', ram: '8 GB', so: `macOS ${os.release()}` },
    janela: tabsConfig.janela,
    abas: TABS,
    rodadas: results.map(({ cpuAmostras, ...rest }) => rest),
    mediana: {
      tempoCarregadoMs: metric('tempoCarregadoMs'),
      tempoJanelaMs: metric('tempoJanelaMs'),
      tempoOciosoMs: metric('tempoOciosoMs'),
      tempoNovePaginasMs: metric('tempoNovePaginasMs'),
      cpuRepousoPct: metric('cpuRepousoPct'),
      rssMB: metric('rssMB'),
      footprintMB: metric('footprintMB')
    },
    capturas: results.map(round => round.captura).filter(Boolean),
    notas: buildNotes(results)
  }
  if (browser.argsSemAutomacao) {
    const clean = name => sys.median(results.map(round => round.semAutomacao && round.semAutomacao[name]))
    output.medianaSemAutomacao = { rssMB: clean('rssMB'), footprintMB: clean('footprintMB') }
  }
  fs.writeFileSync(path.join(RESULTS, `${browser.id}-amostras-cpu.json`), JSON.stringify(results.map(round => ({ rodada: round.rodada, amostras: round.cpuAmostras })), null, 0) + '\n')
  const file = path.join(RESULTS, `${browser.id}.json`)
  fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n')
  log(`gravado ${path.relative(sys.ROOT, file)}`)
  console.log(JSON.stringify(output.mediana))
}

// Ctrl+C ou SIGTERM: não deixa navegador nem vigia de janelas para trás.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await sys.run('pkill', ['-f', browser.marker])
    sys.stopAllWatchers()
    process.exit(130)
  })
}

main().catch(async error => {
  console.error(error)
  await sys.run('pkill', ['-f', browser.marker])
  process.exit(1)
})
