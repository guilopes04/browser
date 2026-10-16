// Servidor das páginas hostis do teste de segurança web (e2e/hostile-pages.ts). Todo host cai aqui
// por --host-resolver-rules, em http e em https (o servidor olha o primeiro byte da conexão: 0x16 é
// o começo de um TLS). Cada página registra o que a página dela viu em window.__out.
// Uso: node hostile-server.ts <porta> <pasta-do-certificado>
import {
  createServer as createHttp,
  type IncomingMessage,
  type ServerResponse
} from 'node:http'
import { createServer as createHttps } from 'node:https'
import { createServer as createTcp } from 'node:net'
import { createSecureContext } from 'node:tls'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const port = Number(process.argv[2] || 9601)
const certDir = process.argv[3] || '.'

const page = (title: string, body: string, head = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${head}</head>` +
  `<body style="margin:0;font:16px -apple-system"><h1 style="margin:24px">${title}</h1>` +
  `<button id="b" style="position:absolute;left:24px;top:100px;width:260px;height:80px;font-size:22px">clique</button>` +
  `<textarea id="t" style="position:absolute;left:24px;top:220px;width:260px;height:80px"></textarea>${body}</body></html>`

type Route = (query: URLSearchParams, host: string) => string

const routes: Record<string, Route> = {
  '/': (_q, host) =>
    page(`Página de ${host}`, '<script>window.__out = {}</script>'),
  '/p/title': q =>
    page(q.get('t') || 'titulo', '<script>window.__out = {}</script>'),

  // ---- downloads ----
  '/p/dl-auto': q =>
    page(
      'download sem gesto',
      `<script>window.__out = {}; setTimeout(() => { location.href = '/file?name=${q.get('name') || 'drive-by.bin'}&n=${q.get('n') || 3000}' }, 300)</script>`
    ),
  '/p/dl-click': q =>
    page(
      'download com clique',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { const a = document.createElement('a'); a.href = '/file?name=${q.get('name') || 'clicado.bin'}&n=${q.get('n') || 5000}'; a.download = ''; document.body.appendChild(a); a.click() }</script>`
    ),
  '/p/dl-flood': q =>
    page(
      'inunda downloads',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { for (let i = 0; i < ${q.get('n') || 25}; i++) { const f = document.createElement('iframe'); f.src = 'http://dl' + i + '.test:9601/slow?name=f' + i + '.bin'; document.body.appendChild(f) } }</script>`
    ),
  '/p/dl-many-nogesture': () =>
    page(
      'varios downloads sem gesto',
      `<script>window.__out = {}; setTimeout(() => { for (let i = 0; i < 4; i++) { const a = document.createElement('a'); a.href = '/file?name=sem' + i + '.bin&n=2000'; a.download = ''; document.body.appendChild(a); a.click() } }, 300)</script>`
    ),
  '/p/dl-same-name': () =>
    page(
      'mesmo nome em corrida',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { for (let i = 0; i < 3; i++) { const a = document.createElement('a'); a.href = '/slow?name=igual.bin'; a.download = ''; document.body.appendChild(a); a.click() } }</script>`
    ),

  // ---- pop-ups ----
  '/p/popup-auto': () =>
    page(
      'pop-up sem gesto',
      `<script>window.__out = { opened: [] }; setTimeout(() => { for (let i = 0; i < 3; i++) window.__out.opened.push(!!window.open('/p/title?t=popup-auto-' + i)) }, 400)</script>`
    ),
  '/p/popup-click': q =>
    page(
      'pop-ups com clique',
      `<script>window.__out = { opened: [] }; document.getElementById('b').onclick = () => { for (let i = 0; i < ${q.get('n') || 5}; i++) window.__out.opened.push(!!window.open('/p/title?t=popup-click-' + i)) }</script>`
    ),
  '/p/popup-later': () =>
    page(
      'pop-up depois do clique',
      `<script>window.__out = { opened: [] }; document.getElementById('b').onclick = () => { setTimeout(() => window.__out.opened.push(!!window.open('/p/title?t=popup-later')), 1500) }</script>`
    ),
  '/p/oauth-opener': () =>
    page(
      'abre o pop-up de login',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { window.__child = window.open('/p/oauth-child'); }</script>`
    ),
  '/p/oauth-child': () =>
    page(
      'login em pop-up',
      `<script>window.__out = { opener: !!window.opener }; document.title = 'oauth-child opener=' + !!window.opener</script>`
    ),

  // ---- diálogos ----
  '/p/confirm': () =>
    page(
      'confirm',
      `<script>window.__out = {}; setTimeout(() => { window.__out.r = confirm('Apagar tudo?'); document.title = 'confirm:' + window.__out.r }, 400)</script>`
    ),
  '/p/alert-loop': q =>
    page(
      'alert em loop',
      `<script>window.__out = { shown: 0 }; setTimeout(() => { for (let i = 0; i < ${q.get('n') || 6}; i++) { window.__out.shown++; alert('alerta hostil ' + i) } document.title = 'fim-alertas' }, ${q.get('delay') || 400})</script>`
    ),
  '/p/alert-timer': q =>
    page(
      'alert por timer',
      `<script>window.__out = { r: null }; setTimeout(() => { window.__out.r = confirm('da aba em segundo plano'); document.title = 'bg-confirm:' + window.__out.r }, ${q.get('delay') || 1200})</script>`
    ),
  '/p/alert-iframe': () =>
    page(
      'alert em iframe',
      `<script>window.__out = {}; setTimeout(() => { const f = document.createElement('iframe'); document.body.appendChild(f); window.__out.blank = f.contentWindow.confirm('do iframe em branco'); document.title = 'blank:' + window.__out.blank; const x = document.createElement('iframe'); x.srcdoc = '<script>parent.__out.srcdoc = confirm("do srcdoc")<\\/script>'; document.body.appendChild(x) }, 400)</script>`
    ),

  // ---- teclado ----
  '/p/keys': () =>
    page(
      'captura teclas',
      `<script>window.keys = []; window.__out = {}; for (const t of ['keydown', 'keypress', 'keyup']) window.addEventListener(t, e => { window.keys.push(t + ':' + (e.metaKey ? 'M-' : '') + (e.ctrlKey ? 'C-' : '') + (e.shiftKey ? 'S-' : '') + e.key); e.preventDefault(); e.stopImmediatePropagation(); return false }, true)</script>`
    ),

  // ---- beforeunload ----
  '/p/beforeunload': () =>
    page(
      'beforeunload',
      `<script>window.__out = { calls: 0 }; addEventListener('beforeunload', e => { window.__out.calls++; e.preventDefault(); e.returnValue = 'fica'; return 'fica' })</script>`
    ),
  '/p/unload-loop': () =>
    page(
      'beforeunload em loop',
      `<script>
      const n = k => Number(sessionStorage.getItem(k) || 0)
      const inc = k => sessionStorage.setItem(k, n(k) + 1)
      window.__out = { get calls() { return n('calls') }, get tries() { return n('tries') } }
      addEventListener('beforeunload', e => { inc('calls'); e.preventDefault(); e.returnValue = 'fica' })
      // o loop começa quando o teste põe window.name = 'go' (depois do clique e de trocar de aba)
      setInterval(() => { if (window.name !== 'go') return; inc('tries'); location.href = '/p/unload-loop?n=' + n('tries') }, 250)
      </script>`
    ),

  // ---- gesto por quadro: o anúncio de outra origem num iframe (E7/E8) ----
  // a página (hostil.test) tem um botão, um link rel=noopener noreferrer e o iframe do anúncio
  // (anuncio.test), que tenta pop-up (com e sem referrer, por link e por formulário) e download a
  // cada 300 ms. O usuário só clica na página
  '/p/ad-host': q =>
    page(
      'página com anúncio',
      `<iframe src="http://anuncio.test/p/ad-frame?dl=${q.get('dl') ?? '1'}" style="position:absolute;left:24px;top:330px;width:320px;height:120px;border:1px solid #888"></iframe>` +
        `<a id="lnk" href="/p/title?t=link-noref" target="_blank" rel="noopener noreferrer" style="position:absolute;left:320px;top:100px;font-size:24px">link sem referrer</a>` +
        '<script>window.__out = {}</script>'
    ),
  '/p/ad-frame': q =>
    `<!doctype html><html><head><meta charset="utf-8"><title>anuncio</title></head><body style="margin:0"><p>anúncio</p>` +
    `<form id="f" action="/p/title" target="_blank"><input type="hidden" name="t" value="ad-popup-form"></form>` +
    `<a id="nr" href="/p/title?t=ad-popup-link" target="_blank" rel="noopener noreferrer">x</a>` +
    `<script>window.__out = { tries: 0 }; setInterval(() => { const n = ++window.__out.tries; window.open('/p/title?t=ad-popup-open-' + n); window.open('/p/title?t=ad-popup-nr-' + n, '_blank', 'noopener,noreferrer'); document.getElementById('nr').click(); document.getElementById('f').submit(); if (${q.get('dl') === '0' ? 'false' : 'true'}) { const a = document.createElement('a'); a.href = '/file?name=ad.bin&n=3000'; a.download = ''; document.body.appendChild(a); a.click() } }, 300)</script></body></html>`,
  // iframe da mesma origem: herda o clique na página, como no Chromium
  '/p/same-host': () =>
    page(
      'página com iframe da mesma origem',
      `<iframe src="/p/same-frame" style="position:absolute;left:24px;top:330px;width:320px;height:120px"></iframe><script>window.__out = {}</script>`
    ),
  '/p/same-frame': () =>
    `<!doctype html><html><head><meta charset="utf-8"><title>mesma origem</title></head><body><p>mesma origem</p><script>window.__out = { tries: 0 }; const iv = setInterval(() => { window.__out.tries++; if (window.open('/p/title?t=same-frame-popup')) clearInterval(iv) }, 300)</script></body></html>`,

  // ---- gesto não atravessa o documento (E7/E8) ----
  '/p/gesture-link': () =>
    page(
      'link para a página de pouso',
      `<a id="l" href="/p/landing-drive-by" style="position:absolute;left:24px;top:330px;font-size:30px">continuar</a><script>window.__out = {}</script>`
    ),
  // ao carregar, abre um pop-up e baixa um arquivo, sem nenhum gesto dela
  '/p/landing-drive-by': () =>
    page(
      'pouso hostil',
      `<script>window.__out = { opened: [] }; setTimeout(() => { window.__out.opened.push(!!window.open('/p/title?t=pouso-popup')); const a = document.createElement('a'); a.href = '/file?name=pouso.bin&n=3000'; a.download = ''; document.body.appendChild(a); a.click() }, 300)</script>`
    ),
  // ---- window.close ----
  '/p/close-self': () =>
    page(
      'fecha a si mesma',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { window.close() }</script>`
    ),
  '/p/close-self-timer': q =>
    page(
      'fecha a si mesma (timer)',
      `<script>window.__out = {}; setTimeout(() => window.close(), ${q.get('delay') || 600})</script>`
    ),
  '/p/opens-closer': () =>
    page(
      'abre o filho que fecha o opener',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { window.__out.child = !!window.open('/p/child-closes-opener') }</script>`
    ),
  // opener com rascunho (o textarea #t) que abre um pop-up (?child=) que chama opener.close()
  '/p/opens-closer-draft': q =>
    page(
      'opener com rascunho',
      `<script>window.__out = { born: Date.now() }; ${q.get('bu') ? "addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = '' });" : ''} document.getElementById('b').onclick = () => { window.__out.child = !!window.open(${JSON.stringify(q.get('child') || '/p/child-closes-opener')}) }</script>`
    ),
  '/p/child-closes-opener': () =>
    page(
      'filho fecha o opener',
      `<script>window.__out = {}; setTimeout(() => { try { window.opener && window.opener.close(); window.__out.did = 'tentou' } catch (e) { window.__out.did = 'erro:' + e.name } }, 700)</script>`
    ),
  '/p/child-self-close': () =>
    page(
      'pop-up que se fecha',
      `<script>window.__out = {}; setTimeout(() => window.close(), 700)</script>`
    ),
  '/p/opens-self-closing': () =>
    page(
      'abre um pop-up que se fecha',
      `<script>window.__out = {}; document.getElementById('b').onclick = () => { window.open('/p/child-self-close') }</script>`
    ),
  '/p/opens-target-blank': () =>
    page(
      'link target=_blank',
      `<a id="l" target="_blank" href="/p/title?t=filho-blank" style="position:absolute;left:24px;top:100px;font-size:30px">abrir em nova aba</a><script>window.__out = {}</script>`
    ),

  // ---- esquemas externos ----
  '/p/external': () =>
    page(
      'esquemas externos',
      `<script>window.__out = {}</script><div style="position:absolute;left:24px;top:200px;font-size:26px"><a id="mail" href="mailto:teste@example.com">mailto</a><br><a id="tel" href="tel:+5511999999999">tel</a><br><a id="unk" href="gilasnope:abc">gilasnope:abc</a></div>`
    ),
  '/p/external-auto': () =>
    page(
      'esquema externo sem gesto',
      `<script>window.__out = {}; setTimeout(() => { location.href = 'mailto:silencio@example.com' }, 400)</script>`
    )
}

function download(
  res: ServerResponse,
  name: string,
  bytes: number,
  slow: boolean
) {
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-disposition': `attachment; filename="${name}"`,
    'content-length': bytes
  })
  if (!slow) {
    res.end(Buffer.alloc(bytes, 65))
    return
  }
  let sent = 0
  const timer = setInterval(() => {
    res.write(Buffer.alloc(2000, 66))
    sent += 2000
    if (sent >= bytes) {
      clearInterval(timer)
      res.end()
    }
  }, 150)
  res.on('close', () => clearInterval(timer))
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://x')
  const host = (req.headers.host || '').replace(/:\d+$/, '')
  console.log(new Date().toISOString(), req.method, host + req.url)
  if (url.pathname === '/favicon.ico') {
    res.writeHead(404)
    res.end()
    return
  }
  if (url.pathname === '/file') {
    download(
      res,
      url.searchParams.get('name') || 'x.bin',
      Number(url.searchParams.get('n') || 1000),
      false
    )
    return
  }
  if (url.pathname === '/slow') {
    download(
      res,
      url.searchParams.get('name') || 'slow.bin',
      Number(url.searchParams.get('n') || 120000),
      true
    )
    return
  }
  const route = routes[url.pathname]
  if (!route) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('nada aqui')
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(route(url.searchParams, host))
}

const http = createHttp(handle)
const secure = createSecureContext({
  key: readFileSync(join(certDir, 'key.pem')),
  cert: readFileSync(join(certDir, 'cert.pem'))
})
const https = createHttps(
  {
    // hosts "httponly*" não falam TLS: o handshake falha e o app cai para http (fallback)
    SNICallback: (name, done) =>
      name.startsWith('httponly')
        ? done(new Error('sem tls'), undefined)
        : done(null, secure)
  },
  handle
)

// um porto só para os dois: 0x16 é o início de um ClientHello (TLS)
createTcp(socket => {
  socket.once('data', chunk => {
    socket.pause()
    socket.unshift(chunk)
    ;(chunk[0] === 0x16 ? https : http).emit('connection', socket)
    socket.resume()
  })
  socket.on('error', () => {})
}).listen(port, '127.0.0.1', () =>
  console.log('servidor hostil na porta', port)
)
