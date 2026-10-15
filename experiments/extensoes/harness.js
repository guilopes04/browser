// Harness: carrega uma extensão MV3 real no Electron e mede o que funciona.
// Uso (a partir de app/):  EXT_DIR=... EXT_NAME=bitwarden PROFILE_DIR=... ./node_modules/.bin/electron ../experiments/extensoes/harness.js
const { app, BrowserWindow, session } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')
const APIS_LISTA = require('./apis-lista.js')

const RAIZ = __dirname
const EXT_DIR = path.resolve(process.env.EXT_DIR || path.join(RAIZ, 'bitwarden'))
const NOME = process.env.EXT_NAME || 'bitwarden'
const POPUP = process.env.POPUP_PATH || 'popup/index.html'
const ESPERA_MS = Number(process.env.WAIT_MS || 5000)
const PERFIL = path.resolve(process.env.PROFILE_DIR || path.join(RAIZ, 'perfil-tmp', NOME))
const PORTA_SITE = 28765
const PORTA_CDP = 29339
const SAIDA = path.join(RAIZ, NOME === 'bitwarden' ? 'resultado.json' : `resultado-${NOME}.json`)
const USADAS_JSON = process.env.APIS_USADAS || path.join(RAIZ, `apis-usadas-${NOME}.json`)

fs.rmSync(PERFIL, { recursive: true, force: true })
fs.mkdirSync(PERFIL, { recursive: true })
fs.mkdirSync(path.join(RAIZ, 'capturas'), { recursive: true })
app.setPath('userData', PERFIL)
app.setPath('sessionData', PERFIL)
app.commandLine.appendSwitch('remote-debugging-port', String(PORTA_CDP))
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1')

const t0 = Date.now()
const agora = () => Date.now() - t0
const resultado = {
  extensao: NOME,
  pasta: EXT_DIR,
  electron: process.versions.electron,
  chromium: process.versions.chrome,
  node: process.versions.node,
  quando: new Date().toISOString(),
  carregou: false,
  erroCarregar: null,
  eventos: [],
  serviceWorker: { registrado: false, iniciou: false, registros: [], status: [], alvosCdp: [], emExecucao: null },
  logsConsole: [],
  errosConsole: [],
  popup: {},
  contentScript: {},
  apis: {},
  passos: {},
  capturas: []
}

// ---------- utilidades ----------
const esperar = ms => new Promise(r => setTimeout(r, ms))
async function passo(nome, fn, ms = 15000) {
  const ini = Date.now()
  console.log(`[harness] ${agora()}ms passo ${nome}: início`)
  try {
    const v = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout de ${ms}ms no passo ${nome}`)), ms))])
    resultado.passos[nome] = { ok: true, ms: Date.now() - ini }
    console.log(`[harness] ${agora()}ms passo ${nome}: ok`)
    return v
  } catch (e) {
    resultado.passos[nome] = { ok: false, ms: Date.now() - ini, erro: String(e && e.stack || e) }
    console.log(`[harness] ${agora()}ms passo ${nome}: FALHOU ${String(e && e.message || e).slice(0, 200)}`)
    return undefined
  }
}
const NIVEIS = ['verbose', 'info', 'warning', 'error']
function registrarLog(origem, nivel, texto, url, linha) {
  const entrada = { t: agora(), origem, nivel, texto: String(texto), url: url || '', linha: linha || 0 }
  resultado.logsConsole.push(entrada)
  if (nivel === 'error' || nivel === 'warning') resultado.errosConsole.push(entrada)
}
function iniciarServidor() {
  const html = fs.readFileSync(path.join(RAIZ, 'site', 'index.html'))
  const servidor = http.createServer((req, res) => {
    if (req.method === 'POST') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('recebido'); return }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  return new Promise((ok, falha) => {
    servidor.once('error', falha)
    servidor.listen(PORTA_SITE, '127.0.0.1', () => ok(servidor))
  })
}

// ---------- CDP direto no service worker (via remote-debugging-port local) ----------
async function cdpAlvos() {
  const r = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/list`)
  return await r.json()
}
function cdpAvaliar(wsUrl, expressao, ms = 8000) {
  return new Promise((ok, falha) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => { try { ws.close() } catch (_) {} ; falha(new Error('timeout CDP')) }, ms)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expressao, returnByValue: true, awaitPromise: true } }))
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.id === 1) { clearTimeout(timer); ws.close(); m.result && m.result.exceptionDetails ? falha(new Error(m.result.exceptionDetails.exception?.description || m.result.exceptionDetails.text)) : ok(m.result && m.result.result ? m.result.result.value : m.error) }
    }
    ws.onerror = e => { clearTimeout(timer); falha(new Error('erro websocket CDP')) }
  })
}

// Captura PNG via CDP (renderiza mesmo se a janela estiver coberta por outras)
function cdpCaptura(wsUrl, ms = 8000) {
  return new Promise((ok, falha) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => { try { ws.close() } catch (_) {} ; falha(new Error('timeout CDP captura')) }, ms)
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }))
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id === 1) { clearTimeout(timer); ws.close(); m.result ? ok(Buffer.from(m.result.data, 'base64')) : falha(new Error(JSON.stringify(m.error))) } }
    ws.onerror = () => { clearTimeout(timer); falha(new Error('erro websocket CDP captura')) }
  })
}

// Lista os contextos de execução (incluindo mundos isolados de content scripts) e avalia neles
function cdpContextos(wsUrl, ms = 8000) {
  return new Promise((ok, falha) => {
    const ws = new WebSocket(wsUrl)
    const contextos = []
    const avaliacoes = []
    const timer = setTimeout(() => { try { ws.close() } catch (_) {} ; falha(new Error('timeout CDP contextos')) }, ms)
    let proximo = 10
    const pendentes = new Map()
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }))
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.method === 'Runtime.executionContextCreated') {
        const c = m.params.context
        contextos.push({ id: c.id, nome: c.name, origem: c.origin, tipo: c.auxData && c.auxData.type, isDefault: c.auxData && c.auxData.isDefault })
      } else if (m.id === 1) {
        setTimeout(() => {
          const daExt = contextos.filter(c => (c.origem || '').startsWith('chrome-extension://'))
          if (!daExt.length) { clearTimeout(timer); ws.close(); return ok({ contextos, contextosDaExtensao: [], avaliacoesNoMundoIsolado: [] }) }
          for (const c of daExt) {
            const id = proximo++
            pendentes.set(id, c.id)
            ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { contextId: c.id, returnByValue: true, expression: "({ chaves: typeof chrome !== 'undefined' ? Object.keys(chrome) : null, runtimeId: typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.id : null, atributosHtml: [...document.documentElement.attributes].map(a => a.name) })" } }))
          }
          pendentes.daExt = daExt
        }, 600)
      } else if (pendentes.has(m.id)) {
        avaliacoes.push({ contexto: pendentes.get(m.id), valor: m.result && m.result.result && m.result.result.value, erro: m.result && m.result.exceptionDetails && m.result.exceptionDetails.text })
        pendentes.delete(m.id)
        if (pendentes.size === 0) { clearTimeout(timer); ws.close(); ok({ contextos, contextosDaExtensao: contextos.filter(c => (c.origem || '').startsWith('chrome-extension://')), avaliacoesNoMundoIsolado: avaliacoes }) }
      }
    }
    ws.onerror = () => { clearTimeout(timer); falha(new Error('erro websocket CDP contextos')) }
  })
}

// Expressão que checa existência de APIs dentro de qualquer contexto (SW ou página da extensão)
function expressaoApis(usadas) {
  return `(async () => {
    const lista = ${JSON.stringify(APIS_LISTA)}
    const usadas = ${JSON.stringify(usadas)}
    const tipo = v => typeof v === 'undefined' ? 'indefinido' : (v === null ? 'nulo' : typeof v)
    const r = { temChrome: typeof chrome !== 'undefined', chaves: typeof chrome !== 'undefined' ? Object.keys(chrome).sort() : [], lista: {}, usadasIndefinidas: [], usadasDefinidas: 0, extensaoId: null, contexto: typeof window !== 'undefined' ? 'pagina' : 'worker' }
    if (!r.temChrome) return r
    try { r.extensaoId = chrome.runtime && chrome.runtime.id } catch (e) {}
    for (const [ns, membros] of Object.entries(lista)) {
      const o = chrome[ns]
      r.lista[ns] = { definido: tipo(o) !== 'indefinido' && tipo(o) !== 'nulo', membros: {} }
      if (r.lista[ns].definido) for (const m of membros) r.lista[ns].membros[m] = tipo(o[m])
    }
    for (const caminho of usadas) {
      let o = chrome, quebrou = null
      for (const parte of caminho.split('.')) {
        try { o = o == null ? undefined : o[parte] } catch (e) { o = undefined }
        if (typeof o === 'undefined') { quebrou = parte; break }
      }
      if (quebrou) r.usadasIndefinidas.push(caminho); else r.usadasDefinidas++
    }
    return r
  })()`
}

// ---------- principal ----------
app.whenReady().then(async () => {
  console.log(`[harness] ${agora()}ms app pronto`)
  const watchdog = setTimeout(() => { resultado.watchdog = 'estourou 130s'; finalizar(2) }, 130000)
  const ses = session.defaultSession
  let servidor
  const usadas = fs.existsSync(USADAS_JSON) ? Object.keys(JSON.parse(fs.readFileSync(USADAS_JSON, 'utf8'))) : []
  resultado.apis.totalUsadasAnalisadas = usadas.length

  async function finalizar(codigo) {
    clearTimeout(watchdog)
    resultado.duracaoMs = agora()
    fs.writeFileSync(SAIDA, JSON.stringify(resultado, null, 2))
    try { servidor && servidor.close() } catch (_) {}
    setTimeout(() => app.exit(codigo), 200)
  }

  // Console de qualquer webContents (popup, páginas, offscreen, background pages)
  app.on('web-contents-created', (_e, wc) => {
    wc.on('console-message', (...a) => {
      let nivel, texto, linha, fonte
      if (a[0] && typeof a[0] === 'object' && 'message' in a[0]) { nivel = NIVEIS[a[0].level] ?? a[0].level; texto = a[0].message; linha = a[0].lineNumber; fonte = a[0].sourceId } else { nivel = NIVEIS[a[1]] ?? a[1]; texto = a[2]; linha = a[3]; fonte = a[4] }
      registrarLog(`wc:${wc.getType()}`, nivel, texto, fonte || wc.getURL(), linha)
    })
    wc.on('did-fail-load', (_ev, codigo, desc, url) => registrarLog(`wc:${wc.getType()}`, 'error', `did-fail-load ${codigo} ${desc}`, url, 0))
    wc.on('render-process-gone', (_ev, d) => registrarLog(`wc:${wc.getType()}`, 'error', `render-process-gone ${JSON.stringify(d)}`, wc.getURL(), 0))
    wc.on('preload-error', (_ev, p, err) => registrarLog(`wc:${wc.getType()}`, 'error', `preload-error ${p} ${err}`, '', 0))
  })

  // Eventos de extensão e de service worker
  const ext = ses.extensions
  for (const nome of ['extension-loaded', 'extension-ready', 'extension-unloaded']) {
    ext.on(nome, (_e, x) => resultado.eventos.push({ t: agora(), evento: nome, id: x.id, nome: x.name, versao: x.version }))
  }
  ses.serviceWorkers.on('console-message', (_e, d) => registrarLog('service-worker', NIVEIS[d.level] ?? d.level, d.message, d.sourceUrl, d.lineNumber))
  ses.serviceWorkers.on('registration-completed', (_e, d) => { resultado.serviceWorker.registrado = true; resultado.serviceWorker.registros.push({ t: agora(), ...d }) })
  ses.serviceWorkers.on('running-status-changed', (_e, d) => {
    resultado.serviceWorker.status.push({ t: agora(), versionId: d.versionId, status: d.runningStatus })
    if (d.runningStatus === 'running' || d.runningStatus === 'starting') resultado.serviceWorker.iniciou = true
  })

  servidor = await passo('servidor-local', iniciarServidor)
  const urlSite = `http://127.0.0.1:${PORTA_SITE}/`

  // 1) carregar a extensão
  let extensao = await passo('loadExtension', () => ses.extensions.loadExtension(EXT_DIR, { allowFileAccess: true }), 30000)
  if (!extensao) {
    const falha = resultado.passos.loadExtension
    resultado.erroCarregar = falha && falha.erro
    return finalizar(1)
  }
  resultado.carregou = true
  await esperar(800)
  resultado.extensaoId = extensao.id
  resultado.extensaoNome = extensao.name
  resultado.extensaoVersao = extensao.version
  resultado.manifestVersion = extensao.manifest && extensao.manifest.manifest_version
  resultado.extensaoUrl = extensao.url
  resultado.permissoesDeclaradas = { permissions: extensao.manifest?.permissions, host_permissions: extensao.manifest?.host_permissions, optional: extensao.manifest?.optional_permissions }

  // 2) janela do site de login
  const winSite = new BrowserWindow({ width: 760, height: 600, x: 20, y: 60, show: false, title: 'Site de teste', webPreferences: { sandbox: true } })
  winSite.showInactive()
  await passo('carregar-site', () => winSite.loadURL(urlSite))

  // 3) popup em outra janela 380x600
  const winPopup = new BrowserWindow({ width: 380, height: 600, x: 800, y: 60, show: false, title: 'Popup da extensão', webPreferences: { sandbox: true } })
  winPopup.showInactive()
  const urlPopup = `chrome-extension://${extensao.id}/${POPUP}`
  resultado.popup.url = urlPopup
  await passo('carregar-popup', () => winPopup.loadURL(urlPopup))

  console.log(`[harness] ${agora()}ms extensão ${extensao.name} ${extensao.version} id=${extensao.id}; aguardando ${ESPERA_MS}ms`)
  await esperar(ESPERA_MS)

  // 4) estado do service worker
  await passo('service-worker', async () => {
    try { resultado.serviceWorker.emExecucao = ses.serviceWorkers.getAllRunning() } catch (e) { resultado.serviceWorker.erroGetAllRunning = String(e) }
    const alvos = await cdpAlvos()
    resultado.serviceWorker.alvosCdp = alvos.map(a => ({ type: a.type, url: a.url, title: a.title }))
    const sw = alvos.find(a => a.type === 'service_worker' && a.url.includes(extensao.id))
    if (sw) {
      resultado.serviceWorker.iniciou = true
      resultado.serviceWorker.url = sw.url
      resultado.apis.sw = await cdpAvaliar(sw.webSocketDebuggerUrl, expressaoApis(usadas))
      try {
        resultado.serviceWorker.chavesStorageLocal = await cdpAvaliar(sw.webSocketDebuggerUrl, `chrome.storage.local.get(null).then(o => Object.keys(o).sort())`)
        resultado.serviceWorker.manifestNoSw = await cdpAvaliar(sw.webSocketDebuggerUrl, `chrome.runtime.getManifest().version`)
      } catch (e) { resultado.serviceWorker.erroStorage = String(e) }
    }
  })

  // 5) popup: renderizou, APIs, digitação
  await passo('popup', async () => {
    const wc = winPopup.webContents
    resultado.popup.urlFinal = wc.getURL()
    resultado.popup.titulo = wc.getTitle()
    const info = await wc.executeJavaScript(`(() => {
      const t = document.body ? document.body.innerText : ''
      return { innerTextLength: t.length, innerTextAmostra: t.slice(0, 500), elementos: document.querySelectorAll('*').length, readyState: document.readyState,
        inputs: [...document.querySelectorAll('input')].map(i => ({ tipo: i.type, id: i.id, nome: i.name, visivel: !!(i.offsetWidth || i.offsetHeight) })),
        botoes: [...document.querySelectorAll('button')].map(b => (b.innerText || b.ariaLabel || '').trim().slice(0, 40)).filter(Boolean).slice(0, 15) }
    })()`)
    Object.assign(resultado.popup, info)
    resultado.popup.renderizouAlemDeBranco = info.innerTextLength > 0
    resultado.apis.popup = await wc.executeJavaScript(expressaoApis(usadas))
    // captura do estado inicial da popup, antes de qualquer interação
    try {
      const img0 = await wc.capturePage()
      fs.writeFileSync(path.join(RAIZ, 'capturas', `${NOME}-popup-inicial.png`), img0.toPNG())
      resultado.capturas.push({ arquivo: `capturas/${NOME}-popup-inicial.png`, tamanho: img0.getSize() })
    } catch (e) { resultado.popup.erroCapturaInicial = String(e) }
    // se não há campo de texto, tenta clicar em "Log in"/"Entrar" (tela de boas-vindas do Bitwarden)
    const semCampo = await wc.executeJavaScript(`![...document.querySelectorAll('input')].some(i => ['text', 'email'].includes(i.type) && (i.offsetWidth || i.offsetHeight))`)
    if (semCampo) {
      resultado.popup.cliqueEmBotao = await wc.executeJavaScript(`(() => {
        const b = [...document.querySelectorAll('button, a')].find(x => /^\\s*(log in|login|entrar|sign in)\\s*$/i.test(x.innerText || ''))
        if (!b) return null
        b.click(); return (b.innerText || '').trim()
      })()`)
      if (resultado.popup.cliqueEmBotao) await esperar(2500)
      resultado.popup.textoAposClique = await wc.executeJavaScript(`document.body.innerText.slice(0, 400)`)
    }
    // digitação: foca o primeiro input de texto/e-mail visível e insere texto fictício (não envia nada)
    const foco = await wc.executeJavaScript(`(() => {
      const el = [...document.querySelectorAll('input')].find(i => ['text', 'email'].includes(i.type) && (i.offsetWidth || i.offsetHeight))
      if (!el) return null
      el.focus(); return { id: el.id, tipo: el.type }
    })()`)
    resultado.popup.campoFocado = foco
    if (foco) {
      await wc.insertText('teste@exemplo.invalid')
      await esperar(300)
      resultado.popup.valorDigitado = await wc.executeJavaScript(`document.activeElement ? document.activeElement.value : null`)
      resultado.popup.aceitouDigitacao = resultado.popup.valorDigitado === 'teste@exemplo.invalid'
      try {
        const alvos = await cdpAlvos()
        const alvoPopup = alvos.find(x => x.type === 'page' && x.url.startsWith('chrome-extension://' + extensao.id))
        const png = await cdpCaptura(alvoPopup.webSocketDebuggerUrl)
        fs.writeFileSync(path.join(RAIZ, 'capturas', `${NOME}-popup-digitando.png`), png)
        resultado.capturas.push({ arquivo: `capturas/${NOME}-popup-digitando.png`, via: 'CDP Page.captureScreenshot' })
      } catch (e) { resultado.popup.erroCapturaDigitando = String(e) }
    } else {
      resultado.popup.aceitouDigitacao = null
    }
  })

  // 6) content script na página de login (contextos de execução via CDP no alvo da página)
  await passo('content-script', async () => {
    const wc = winSite.webContents
    const alvos = await cdpAlvos()
    const alvo = alvos.find(x => x.type === 'page' && x.url === urlSite)
    if (alvo) Object.assign(resultado.contentScript, await cdpContextos(alvo.webSocketDebuggerUrl))
    resultado.contentScript.injetou = (resultado.contentScript.contextosDaExtensao || []).some(c => (c.origem || '').includes(extensao.id))
    resultado.contentScript.pagina = await wc.executeJavaScript(`(() => {
      const base = new Set(['html', 'head', 'meta', 'title', 'style', 'body', 'form', 'h1', 'input', 'button'])
      const todos = [...document.querySelectorAll('*')]
      return {
        atributosHtml: [...document.documentElement.attributes].map(a => a.name + '=' + a.value.slice(0, 60)),
        elementosAlemDoOriginal: todos.map(e => e.tagName.toLowerCase()).filter(t => !base.has(t)),
        elementosCustom: todos.filter(e => e.tagName.includes('-')).map(e => e.tagName.toLowerCase()),
        iframes: [...document.querySelectorAll('iframe')].map(f => f.src),
        folhasDeEstilo: [...document.styleSheets].map(s => s.href || (s.ownerNode ? 'inline:' + s.ownerNode.tagName : 'sem-dono')),
        atributosDoInput: [...document.querySelectorAll('input')].map(i => [...i.attributes].map(a => a.name)),
        sombrasAbertas: todos.filter(e => e.shadowRoot).length,
        totalElementos: todos.length
      }
    })()`)
    // Se for a sonda: o atributo marcado pelo content script e a mensagem trocada com o service worker
    resultado.contentScript.atributoSonda = await wc.executeJavaScript(`document.documentElement.getAttribute('data-sonda-content')`)
  })

  // 7) capturas
  for (const [nome, win] of [['site', winSite], ['popup', winPopup]]) {
    await passo(`captura-${nome}`, async () => {
      const img = await win.webContents.capturePage()
      const arq = path.join('capturas', `${NOME}-${nome}.png`)
      fs.writeFileSync(path.join(RAIZ, arq), img.toPNG())
      resultado.capturas.push({ arquivo: arq, tamanho: img.getSize() })
    })
  }

  // 7b) rede: bloqueio por DNR e por webRequest bloqueante (a sonda registra regras para estas URLs)
  await passo('teste-rede', async () => {
    const wc = winSite.webContents
    const buscar = caminho => wc.executeJavaScript(`fetch('/${caminho}').then(r => 'status ' + r.status).catch(e => 'bloqueado: ' + e.message)`)
    resultado.testeRede = {
      controle: await buscar('livre'),
      declarativeNetRequest: await buscar('bloquear-dnr'),
      webRequestBloqueante: await buscar('bloquear-isto')
    }
    // regras estáticas (ex.: uBlock Origin Lite): domínio de anúncios real versus domínio neutro, sem credenciais (no-cors)
    const externo = url => wc.executeJavaScript(`fetch('${url}', { mode: 'no-cors', cache: 'no-store' }).then(r => 'resolveu (' + r.type + ')').catch(e => 'bloqueado: ' + e.message)`)
    resultado.testeRede.anuncioDoubleclick = await externo('https://googleads.g.doubleclick.net/pagead/id')
    resultado.testeRede.controleExemploCom = await externo('https://example.com/')
  })

  // 8) esperar mais um pouco o resultado final da sonda (se houver), tirar do log
  if (process.env.AGUARDAR_SONDA) {
    await esperar(Number(process.env.AGUARDAR_SONDA))
    const linha = resultado.logsConsole.find(l => l.texto.startsWith('SONDA_RESULT '))
    if (linha) resultado.sonda = JSON.parse(linha.texto.slice('SONDA_RESULT '.length))
    resultado.sondaAlarmes = resultado.logsConsole.filter(l => l.texto.startsWith('SONDA_ALARM')).map(l => ({ t: l.t, texto: l.texto }))
  }
  resultado.errosConsoleTotal = resultado.errosConsole.length
  await finalizar(0)
}).catch(e => { console.error('[harness] erro fatal', e); resultado.erroFatal = String(e && e.stack || e); try { fs.writeFileSync(SAIDA, JSON.stringify(resultado, null, 2)) } catch (_) {} ; app.exit(3) })
