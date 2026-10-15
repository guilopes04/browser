// Servidor local das páginas de teste: todo host cai aqui por --host-resolver-rules. Cada página
// registra as teclas que recebe em window.keys (para ver vazamento de teclas) e tem um campo.
import { createServer } from 'node:http'

const port = Number(process.argv[2] || 8261)
const TITLES: Record<string, string> = {
  'keylog.test/': 'Página que registra teclas',
  'alpha.test/one': 'Alpha Um',
  'alpha.test/two': 'Alpha Dois',
  'beta.test/': 'Beta Página',
  'linear.test/team/issues': 'Minhas issues no Linear',
  'linear.test/roadmap': 'Roadmap no Linear',
  'cloud.test/': 'CloudWatch, logs de produção',
  'hist.test/doc': 'Documento Âncoras'
}

createServer((req, res) => {
  const host = (req.headers.host || '').replace(/:\d+$/, '')
  const url = new URL(req.url ?? '/', 'http://x')
  if (url.pathname === '/favicon.ico') {
    res.writeHead(404)
    res.end()
    return
  }
  const key = host + url.pathname
  const title = url.searchParams.get('t') || TITLES[key] || key + url.search
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><meta charset=utf-8><title>${title}</title>
<script>window.keys=[];addEventListener('keydown',e=>{window.keys.push((e.metaKey?'⌘':'')+e.key)},true)</script>
<body style="margin:0;background:#fff;font:16px -apple-system"><h1 style="margin:40px">${title}</h1>
<input id=field style="margin:40px" autofocus><p id=a style="margin:40px;height:1200px">a</p><p id=b>b</p></body>`)
}).listen(port, '127.0.0.1', () => console.log('servidor na porta', port))
