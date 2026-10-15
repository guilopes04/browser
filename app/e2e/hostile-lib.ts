// Utilitários do e2e de páginas hostis: sobe o servidor e o app de verdade (build em out/), lê a
// shell e as páginas por CDP, inspeciona o main por --inspect e injeta input pelo mesmo caminho do
// Chromium que o teclado e o mouse usam (webContents.sendInputEvent: passa por before-input-event
// e input-event, e vale como gesto do usuário para a página). Portas próprias, para não colidir
// com os outros e2e. Só macOS. Pré-requisito: npm run build.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const DIR = import.meta.dirname
export const APP = resolve(DIR, '..')
export const OUT_DIR =
  process.env.E2E_OUT ?? join(tmpdir(), 'navegador-e2e-hostil')
export const CDP = 9401
export const INSPECT = 9402
export const SRV = 9601

export const sleep = (ms: number) =>
  new Promise<void>(done => setTimeout(done, ms))
export type Json = any

interface Target {
  id: string
  type: string
  url: string
  title: string
  webSocketDebuggerUrl: string
}

// ---------- CDP ----------
async function json(url: string): Promise<any> {
  return (await fetch(url)).json()
}

export const targets = (): Promise<Target[]> =>
  json(`http://127.0.0.1:${CDP}/json/list`)

const sockets = new Map<
  string,
  { ws: WebSocket; next: number; pending: Map<number, (m: any) => void> }
>()

async function sock(url: string) {
  const found = sockets.get(url)
  if (found && found.ws.readyState === 1) return found
  const ws = new WebSocket(url)
  await new Promise<void>((ok, fail) => {
    ws.onopen = () => ok()
    ws.onerror = () => fail(new Error(`ws ${url}`))
  })
  const created = { ws, next: 1, pending: new Map<number, (m: any) => void>() }
  ws.onmessage = event => {
    const message = JSON.parse(String(event.data))
    const waiting = created.pending.get(message.id)
    if (waiting) {
      created.pending.delete(message.id)
      waiting(message)
    }
  }
  sockets.set(url, created)
  return created
}

async function call(
  url: string,
  method: string,
  params: object,
  timeout = 10000
): Promise<any> {
  const socket = await sock(url)
  const id = socket.next++
  return new Promise((ok, fail) => {
    socket.pending.set(id, message =>
      message.error
        ? fail(new Error(JSON.stringify(message.error)))
        : ok(message.result)
    )
    socket.ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => fail(new Error(`timeout ${method}`)), timeout)
  })
}

async function evalWs(
  url: string,
  expression: string,
  timeout = 10000
): Promise<any> {
  const result = await call(
    url,
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
      includeCommandLineAPI: true
    },
    timeout
  )
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}

export const ev = (target: Target, expression: string) =>
  evalWs(target.webSocketDebuggerUrl, expression)

export async function shell(): Promise<Target> {
  const found = (await targets()).find(target =>
    target.url.startsWith('app://shell')
  )
  if (!found) throw new Error('shell não encontrada')
  return found
}

export async function pages(): Promise<Target[]> {
  return (await targets()).filter(
    target =>
      target.type === 'page' &&
      !target.url.startsWith('app://') &&
      !target.url.startsWith('devtools')
  )
}

export async function pageOf(fragment: string): Promise<Target | undefined> {
  return (await pages()).find(page => page.url.includes(fragment))
}

// o que a página registrou em window.__out
export async function out(fragment: string): Promise<Json> {
  const page = await pageOf(fragment)
  return page
    ? ev(page, 'JSON.parse(JSON.stringify(window.__out ?? null))')
    : null
}

export const st = async (): Promise<Json> =>
  ev(await shell(), `window.api.invoke('state:get', {})`)

export async function send(channel: string, payload: unknown): Promise<void> {
  await ev(
    await shell(),
    `window.api.send(${JSON.stringify(channel)}, ${JSON.stringify(payload)})`
  )
}

export async function mainEval(expression: string): Promise<any> {
  const list = await json(`http://127.0.0.1:${INSPECT}/json/list`)
  return evalWs(list[0].webSocketDebuggerUrl, expression)
}

// ---------- estado do app ----------
export const activeTab = (s: Json) =>
  s.tabs.find((t: Json) => t.id === s.window.activeTabBySpace[s.window.spaceId])
export const tabByUrl = (s: Json, fragment: string) =>
  s.tabs.find((t: Json) => t.url.includes(fragment))
export const urls = (s: Json): string[] => s.tabs.map((t: Json) => t.url)

// ---------- input pelo caminho do Chromium ----------
// webContents da página (por um pedaço da URL)
const wcOf = (fragment: string) =>
  `require('electron').webContents.getAllWebContents().find(w => !w.isDestroyed() && w.getURL().includes(${JSON.stringify(fragment)}))`

export async function mainRequire(): Promise<void> {
  // process.mainModule.require só existe no escopo do inspetor
  await mainEval(
    `globalThis.require = globalThis.require || process.mainModule.require; 1`
  )
}

// clique real (mouseDown + mouseUp) no centro de um seletor da página
export async function click(fragment: string, selector = '#b'): Promise<void> {
  // a shell (app://shell) também é uma página: o aviso de pop-up e os botões dela são clicáveis
  const page = (await targets()).find(
    t => t.type === 'page' && t.url.includes(fragment)
  ) as Target
  const rect = await ev(
    page,
    `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } })()`
  )
  await mainEval(
    `(() => { const wc = ${wcOf(fragment)}; wc.focus(); const o = { x: ${rect.x}, y: ${rect.y}, button: 'left', clickCount: 1 }; wc.sendInputEvent({ type: 'mouseMove', x: o.x, y: o.y }); wc.sendInputEvent({ type: 'mouseDown', ...o }); wc.sendInputEvent({ type: 'mouseUp', ...o }); return 1 })()`
  )
}

// tecla com modificadores (keyDown + keyUp) na página
export async function key(
  fragment: string,
  keyCode: string,
  modifiers: string[] = []
): Promise<void> {
  await mainEval(
    `(() => { const wc = ${wcOf(fragment)}; wc.sendInputEvent({ type: 'keyDown', keyCode: ${JSON.stringify(keyCode)}, modifiers: ${JSON.stringify(modifiers)} }); wc.sendInputEvent({ type: 'keyUp', keyCode: ${JSON.stringify(keyCode)}, modifiers: ${JSON.stringify(modifiers)} }); return 1 })()`
  )
}

// digita um texto na página (keyDown, char e keyUp de cada caractere)
export async function typeText(fragment: string, text: string): Promise<void> {
  for (const ch of text)
    await mainEval(
      `(() => { const wc = ${wcOf(fragment)}; wc.sendInputEvent({ type: 'keyDown', keyCode: ${JSON.stringify(ch)} }); wc.sendInputEvent({ type: 'char', keyCode: ${JSON.stringify(ch)} }); wc.sendInputEvent({ type: 'keyUp', keyCode: ${JSON.stringify(ch)} }); return 1 })()`
    )
}

// ---------- processos ----------
export interface Procs {
  server: ChildProcess
  electron: ChildProcess
  profile: string
  downloads: string
}

function ensureCert(dir: string): void {
  if (existsSync(join(dir, 'cert.pem'))) return
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(dir, 'key.pem'),
      '-out',
      join(dir, 'cert.pem'),
      '-days',
      '2',
      '-subj',
      '/CN=localhost'
    ],
    { stdio: 'ignore' }
  )
}

export function start(
  name: string,
  tabs: string[] = [],
  extra: string[] = []
): Procs {
  killStale()
  const base = join(OUT_DIR, name)
  rmSync(base, { recursive: true, force: true })
  const profile = join(base, 'profile')
  const downloads = join(base, 'downloads')
  const certs = join(OUT_DIR, 'certs')
  mkdirSync(profile, { recursive: true })
  mkdirSync(downloads, { recursive: true })
  mkdirSync(certs, { recursive: true })
  ensureCert(certs)
  const log = (file: string) => openSync(join(base, file), 'w')
  const server = spawn(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      join(DIR, 'hostile-server.ts'),
      String(SRV),
      certs
    ],
    { stdio: ['ignore', log('server.log'), log('server.err.log')] }
  )
  const electron = spawn(
    join(APP, 'node_modules/.bin/electron'),
    [
      APP,
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${CDP}`,
      `--inspect=${INSPECT}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${SRV}`,
      '--ignore-certificate-errors',
      // janela coberta por outras (a tela é compartilhada) não pode virar "oculta" e descartar input
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      `--pasta-downloads=${downloads}`,
      `--abas=${JSON.stringify(tabs)}`,
      '--janela=0,40,1300,860',
      '--tema=claro',
      '--carregar-todas',
      ...extra
    ],
    {
      cwd: APP,
      stdio: ['ignore', log('electron.log'), log('electron.err.log')]
    }
  )
  return { server, electron, profile, downloads }
}

export async function waitFor<T>(
  fn: () =>
    Promise<T | null | false | undefined> | T | null | false | undefined,
  ms = 8000,
  step = 100
): Promise<T | null> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const value = await fn()
      if (value) return value
    } catch {
      // ainda não está pronto
    }
    await sleep(step)
  }
  return null
}

export async function ready(): Promise<void> {
  await waitFor(async () => !!(await shell()), 25000)
  await waitFor(
    async () =>
      (await st()).tabs.every((t: Json) => !t.dormant || t.url === ''),
    15000
  )
  await sleep(1500)
  await mainRequire()
}

// o processo principal do app (os auxiliares levam --type= na linha de comando)
export function mainPid(procs: Procs): number {
  const found = execFileSync(
    'pgrep',
    ['-f', `user-data-dir=${procs.profile}`],
    { encoding: 'utf8' }
  )
    .trim()
    .split('\n')
  for (const pid of found) {
    const command = execFileSync('ps', ['-o', 'command=', '-p', pid], {
      encoding: 'utf8'
    })
    if (
      !command.includes('--type=') &&
      command.includes('Electron.app/Contents/MacOS/Electron')
    )
      return Number(pid)
  }
  throw new Error('processo principal não achado')
}

// ---------- capturas ----------
// o helper de janelas (bench/winlist.swift) é compilado na primeira vez
function winlist(): string {
  const binary = join(OUT_DIR, 'winlist')
  mkdirSync(OUT_DIR, { recursive: true })
  if (!existsSync(binary))
    execFileSync('swiftc', [
      '-O',
      resolve(APP, '../bench/winlist.swift'),
      '-o',
      binary
    ])
  return binary
}

export function windowId(pid: number, nonEmptyTitle = true): number | null {
  const lines = execFileSync(winlist(), [], { encoding: 'utf8' }).split('\n')
  for (const line of lines) {
    const cols = line.split('\t')
    if (cols.length < 5 || Number(cols[4]) !== pid) continue
    if (nonEmptyTitle && cols[2] === '') continue
    return Number(cols[0])
  }
  return null
}

// as janelas do processo (a folha de um diálogo nativo aparece como janela sem título)
export function windowsOf(
  pid: number
): { id: number; title: string; width: number; height: number }[] {
  const lines = execFileSync(winlist(), [], { encoding: 'utf8' }).split('\n')
  const found = []
  for (const line of lines) {
    const cols = line.split('\t')
    if (cols.length < 5 || Number(cols[4]) !== pid) continue
    const num = (key: string) =>
      Number((cols[3].match(new RegExp(`"${key}": (-?\\d+)`)) || [])[1])
    found.push({
      id: Number(cols[0]),
      title: cols[2],
      width: num('Width'),
      height: num('Height')
    })
  }
  return found
}

export const sheetsOf = (pid: number) =>
  windowsOf(pid).filter(w => w.title === '')

// com um diálogo aberto, a janela da folha mostra a janela inteira com o diálogo por cima
export function shotSheet(path: string, pid: number): boolean {
  const sheet = sheetsOf(pid)[0]
  if (!sheet) return false
  mkdirSync(join(path, '..'), { recursive: true })
  execFileSync('screencapture', ['-x', '-o', '-l', String(sheet.id), path])
  return true
}

export function shot(path: string, pid: number): boolean {
  const id = windowId(pid)
  if (!id) return false
  mkdirSync(join(path, '..'), { recursive: true })
  execFileSync('screencapture', ['-x', '-o', '-l', String(id), path])
  return true
}

export function listDir(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

export function sizeOf(path: string): number {
  return existsSync(path) ? statSync(path).size : -1
}

// quem usa as portas deste e2e (de uma rodada anterior que não terminou) sai antes de subir outro
export function killStale(): void {
  for (const pattern of [
    `remote-debugging-port=${CDP}`,
    `hostile-server.ts ${SRV}`
  ]) {
    try {
      execFileSync('pkill', ['-9', '-f', pattern], { stdio: 'ignore' })
    } catch {
      // ninguém usava
    }
  }
}

export function stopAll(procs: Procs): void {
  for (const socket of sockets.values()) {
    try {
      socket.ws.close()
    } catch {
      // já fechado
    }
  }
  sockets.clear()
  try {
    execFileSync('pkill', ['-9', '-f', procs.profile])
  } catch {
    // nada rodando
  }
  procs.electron.kill('SIGKILL')
  procs.server.kill('SIGTERM')
}

export function leftOver(procs: Procs): number {
  try {
    const out = execFileSync('pgrep', ['-f', procs.profile], {
      encoding: 'utf8'
    }).trim()
    return out ? out.split('\n').length : 0
  } catch {
    return 0
  }
}

export interface Result {
  name: string
  pass: boolean
  detail: unknown
}

export function recorder(file: string) {
  const results: Result[] = []
  const record = (name: string, pass: boolean, detail: unknown = {}) => {
    results.push({ name, pass, detail })
    console.log(
      pass ? 'OK   ' : 'FALHA',
      name,
      JSON.stringify(detail).slice(0, 600)
    )
  }
  const finish = () => {
    mkdirSync(OUT_DIR, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({ when: new Date().toISOString(), results }, null, 2)
    )
    console.log(`resultado em ${file}`)
    if (results.some(result => !result.pass)) process.exitCode = 1
  }
  return { record, finish }
}
