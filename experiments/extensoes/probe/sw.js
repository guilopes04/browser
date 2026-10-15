// Service worker da sonda: testa de forma funcional as APIs que gerenciadores de senhas e bloqueadores usam.
const resultados = {}
const log = (...a) => console.log('SONDA', ...a)

importScripts('apis-lista.js')
const NAMESPACES = self.APIS_LISTA

// 1) Existência (typeof) de cada namespace e membro
const existencia = {}
for (const [ns, membros] of Object.entries(NAMESPACES)) {
  const o = chrome[ns]
  existencia[ns] = { definido: typeof o !== 'undefined' && o !== null }
  if (existencia[ns].definido) {
    existencia[ns].membros = {}
    for (const m of membros) existencia[ns].membros[m] = typeof o[m] === 'undefined' ? 'indefinido' : (typeof o[m] === 'function' ? 'funcao' : 'objeto')
  }
}
resultados.existencia = existencia

// 2) Testes funcionais, cada um isolado com timeout
const com = (nome, fn, ms = 4000) => {
  const t0 = Date.now()
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise(res => setTimeout(() => res({ __timeout: true }), ms))
  ]).then(
    v => { resultados[nome] = v && v.__timeout ? { ok: false, erro: 'timeout ' + ms + 'ms (promessa nunca resolveu)' } : { ok: true, valor: v, ms: Date.now() - t0 } },
    e => { resultados[nome] = { ok: false, erro: String(e && e.message || e) } }
  )
}

let alarmeDisparou = false
let mensagemRecebida = []
try { chrome.alarms.onAlarm.addListener(a => { alarmeDisparou = a.name; console.log('SONDA_ALARM ' + a.name + ' em ' + Date.now()) }) } catch (e) { resultados.alarmsListener = String(e) }
try { chrome.runtime.onMessage.addListener((m, s, send) => { mensagemRecebida.push({ m, tab: s.tab && s.tab.url, url: s.url }); send({ eco: m, sw: true }); return false }) } catch (e) { resultados.onMessageListener = String(e) }
try { chrome.commands.onCommand.addListener(c => log('comando', c)) } catch (e) {}
try { chrome.runtime.onInstalled.addListener(d => log('onInstalled', JSON.stringify(d))) } catch (e) {}
const eventosWebRequest = []
try { chrome.webRequest.onBeforeRequest.addListener(d => { eventosWebRequest.push(d.url); }, { urls: ['<all_urls>'] }) } catch (e) { resultados.webRequestListener = String(e) }
let webRequestBloqueante = null
try { chrome.webRequest.onBeforeRequest.addListener(d => d.url.includes('bloquear-isto') ? { cancel: true } : {}, { urls: ['<all_urls>'] }, ['blocking']); webRequestBloqueante = 'listener aceito sem erro' } catch (e) { webRequestBloqueante = 'erro: ' + String(e) }
resultados.webRequestBloqueante = webRequestBloqueante
const navegacao = []
try { chrome.webNavigation.onCommitted.addListener(d => navegacao.push(d.url)) } catch (e) {}

async function rodar() {
  await com('storage.local', async () => { await chrome.storage.local.set({ k: 'v' }); return await chrome.storage.local.get('k') })
  await com('storage.session', async () => { await chrome.storage.session.set({ k: 'v' }); return await chrome.storage.session.get('k') })
  await com('storage.sync', async () => { await chrome.storage.sync.set({ k: 'v' }); return await chrome.storage.sync.get('k') })
  await com('alarms.create', async () => { const antes = Date.now(); chrome.alarms.create('rapido-1_2s', { delayInMinutes: 0.02 }); chrome.alarms.create('lento-30s', { delayInMinutes: 0.5 }); chrome.alarms.create('um-minuto', { delayInMinutes: 1 }); console.log('SONDA_ALARM criados em ' + antes); return await chrome.alarms.getAll() })
  await com('runtime.getManifest', () => chrome.runtime.getManifest().name)
  await com('runtime.getPlatformInfo', () => chrome.runtime.getPlatformInfo())
  await com('runtime.getContexts', () => chrome.runtime.getContexts({}))
  await com('i18n.getUILanguage', () => chrome.i18n.getUILanguage())
  await com('tabs.query({})', async () => (await chrome.tabs.query({})).map(t => ({ id: t.id, url: t.url, active: t.active, windowId: t.windowId })))
  await com('tabs.query(active)', async () => (await chrome.tabs.query({ active: true, currentWindow: true })).map(t => t.url))
  await com('windows.getAll', async () => (await chrome.windows.getAll()).map(w => ({ id: w.id, focused: w.focused, type: w.type })))
  await com('windows.getCurrent', async () => { const w = await chrome.windows.getCurrent(); return { id: w.id } })
  await com('tabs.sendMessage', async () => {
    const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' })
    if (!t) throw new Error('nenhuma aba 127.0.0.1 visível via tabs.query')
    return await chrome.tabs.sendMessage(t.id, { tipo: 'sw-ola' })
  })
  await com('scripting.executeScript', async () => {
    const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' })
    if (!t) throw new Error('nenhuma aba 127.0.0.1 visível via tabs.query')
    return await chrome.scripting.executeScript({ target: { tabId: t.id }, func: () => document.title })
  })
  await com('scripting.registerContentScripts', async () => {
    await chrome.scripting.registerContentScripts([{ id: 'sonda-reg', js: ['content.js'], matches: ['http://127.0.0.1/*'], runAt: 'document_start' }])
    return await chrome.scripting.getRegisteredContentScripts()
  })
  await com('cookies.getAll', async () => (await chrome.cookies.getAll({})).length)
  await com('contextMenus.create', () => new Promise((res, rej) => { chrome.contextMenus.create({ id: 'sonda', title: 'Sonda', contexts: ['all'] }, () => chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res('criado')) }))
  await com('action.setBadgeText', async () => { await chrome.action.setBadgeText({ text: '7' }); return await chrome.action.getBadgeText({}) })
  await com('action.setIcon', async () => { await chrome.action.setIcon({ path: undefined, imageData: undefined }).catch(() => {}); return 'chamado' })
  await com('commands.getAll', () => chrome.commands.getAll())
  await com('notifications.create', () => new Promise((res, rej) => { chrome.notifications.create('n1', { type: 'basic', title: 'Sonda', message: 'Olá', iconUrl: 'icon.png' }, id => chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res(id)) }))
  await com('idle.queryState', () => chrome.idle.queryState(60))
  await com('management.getSelf', async () => { const s = await chrome.management.getSelf(); return { name: s.name, id: s.id } })
  await com('permissions.getAll', () => chrome.permissions.getAll())
  await com('offscreen.createDocument', async () => { await chrome.offscreen.createDocument({ url: 'popup.html', reasons: ['CLIPBOARD'], justification: 'teste' }); return await chrome.offscreen.hasDocument() })
  await com('sidePanel.setOptions', async () => { await chrome.sidePanel.setOptions({ path: 'popup.html', enabled: true }); return 'ok' })
  await com('declarativeNetRequest.updateDynamicRules', async () => {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{ id: 1, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'bloquear-dnr', resourceTypes: ['xmlhttprequest', 'main_frame'] } }] })
    return await chrome.declarativeNetRequest.getDynamicRules()
  })
  await com('tabs.create', async () => { const t = await chrome.tabs.create({ url: 'about:blank', active: false }); return { id: t.id } })
  await com('fetch (host_permissions)', async () => { const r = await fetch('http://127.0.0.1:28765/'); return r.status })

  // Espera o alarme (1,2 s) e os eventos assíncronos
  await new Promise(r => setTimeout(r, 2500))
  resultados.alarmeDisparouApos2500ms = alarmeDisparou
  resultados.mensagensRecebidas = mensagemRecebida
  resultados.webRequestEventos = eventosWebRequest.slice(0, 10)
  resultados.webNavigationEventos = navegacao.slice(0, 10)
  console.log('SONDA_RESULT ' + JSON.stringify(resultados))
}

self.addEventListener('install', () => log('install'))
self.addEventListener('activate', () => log('activate'))
log('sw iniciou')
setTimeout(() => rodar().catch(e => console.log('SONDA_FATAL ' + String(e && e.stack || e))), 2500)
