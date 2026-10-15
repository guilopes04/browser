// Utilitários dos testes de ponta a ponta: sobem o app de verdade (build de produção em out/),
// leem o estado da shell e das páginas por CDP, inspecionam o main por --inspect e mandam teclas
// e cliques reais (System Events e CGEvent). Só macOS, com a janela do Electron na frente e a
// permissão de acessibilidade do terminal. Perfis e resultados ficam em E2E_OUT (padrão: pasta
// temporária), nunca no perfil real.
import {
  execFileSync,
  spawn,
  type ChildProcess,
  type SpawnOptions
} from 'node:child_process'
import { existsSync, mkdirSync, openSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { writeFixture } from './fixture.ts'

export const DIR = import.meta.dirname
export const APP = resolve(DIR, '..')
export const OUT_DIR = process.env.E2E_OUT ?? join(tmpdir(), 'navegador-e2e')
// portas (E2E_CDP, E2E_INSPECT e E2E_SRV mudam, para dois testes rodarem ao mesmo tempo)
const CDP = Number(process.env.E2E_CDP ?? 9361)
const INSPECT = Number(process.env.E2E_INSPECT ?? 9362)
const SRV = Number(process.env.E2E_SRV ?? 8261)

export const sleep = (ms: number) =>
  new Promise<void>(done => setTimeout(done, ms))

// o estado de um teste (AppSnapshot) e as linhas da paleta: o que o teste lê é estrutural
export type Json = any

interface Target {
  id: string
  type: string
  url: string
  webSocketDebuggerUrl: string
}

async function json(url: string): Promise<any> {
  return (await fetch(url)).json()
}

export async function targets(): Promise<Target[]> {
  return json(`http://127.0.0.1:${CDP}/json/list`)
}

interface Socket {
  ws: WebSocket
  next: number
  pending: Map<number, { ok(value: any): void; fail(error: Error): void }>
}
const sockets = new Map<string, Socket>()

async function sock(url: string): Promise<Socket> {
  const found = sockets.get(url)
  if (found && found.ws.readyState === 1) return found
  const ws = new WebSocket(url)
  await new Promise<void>((ok, fail) => {
    ws.onopen = () => ok()
    ws.onerror = () => fail(new Error(`ws ${url}`))
  })
  const created: Socket = { ws, next: 1, pending: new Map() }
  ws.onmessage = event => {
    const message = JSON.parse(String(event.data))
    const waiting = created.pending.get(message.id)
    if (!waiting) return
    created.pending.delete(message.id)
    if (message.error) waiting.fail(new Error(message.error.message))
    else waiting.ok(message.result)
  }
  sockets.set(url, created)
  return created
}

async function evalWs(url: string, expression: string): Promise<any> {
  const socket = await sock(url)
  const id = socket.next++
  const result = await new Promise<any>((ok, fail) => {
    socket.pending.set(id, { ok, fail })
    socket.ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression,
          returnByValue: true,
          awaitPromise: true,
          includeCommandLineAPI: true
        }
      })
    )
    setTimeout(() => fail(new Error('timeout eval')), 10000)
  })
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}

export const ev = (target: Target, expression: string) =>
  evalWs(target.webSocketDebuggerUrl, expression)

export async function shell(): Promise<Target> {
  const found = (await targets()).find(target =>
    target.url.startsWith('app://shell/index.html')
  )
  if (!found) throw new Error('shell não encontrada')
  return found
}

// a barra de busca (⌘F): a view própria, que só existe com a busca aberta
export async function findBar(): Promise<Target | undefined> {
  return (await targets()).find(target =>
    target.url.startsWith('app://shell/find.html')
  )
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

export async function st(): Promise<Json> {
  return ev(await shell(), `window.api.invoke('state:get', {})`)
}

export async function send(channel: string, payload: unknown): Promise<void> {
  await ev(
    await shell(),
    `window.api.send(${JSON.stringify(channel)}, ${JSON.stringify(payload)})`
  )
}

export async function query(text: string, scope = 'all'): Promise<Json[]> {
  return ev(
    await shell(),
    `window.api.invoke('palette:query', ${JSON.stringify({ text, scope })})`
  )
}

// o que a shell mostra: a paleta e o campo da Nova aba
export async function pal(): Promise<Json> {
  return ev(
    await shell(),
    `(() => {
    const rows = [...document.querySelectorAll('.pal-row')]
    const input = document.querySelector('.pal-input')
    const nt = document.querySelector('.nt-input')
    return {
      open: !!document.querySelector('.pal'),
      text: input ? input.value : null,
      inputFocused: input ? document.activeElement === input : false,
      selStart: input ? input.selectionStart : null,
      selEnd: input ? input.selectionEnd : null,
      ntFocused: nt ? document.activeElement === nt : false,
      ntValue: nt ? nt.value : null,
      ntSelStart: nt ? nt.selectionStart : null,
      ntSelEnd: nt ? nt.selectionEnd : null,
      shellHasFocus: document.hasFocus(),
      selected: rows.findIndex(r => r.dataset.selected === 'true'),
      rows: rows.map(r => r.innerText.replace(/\\n+/g, ' | ')),
      sections: [...document.querySelectorAll('.pal-section-title')].map(e => e.innerText),
      footer: document.querySelector('.pal-footer')?.innerText.replace(/\\n+/g, ' | ') ?? null
    }
  })()`
  )
}

// as páginas de teste registram as teclas que recebem em window.keys (ver server.ts)
export async function pageFocus(fragment: string): Promise<Json> {
  const page = await pageOf(fragment)
  if (!page) return null
  return ev(
    page,
    `({ hasFocus: document.hasFocus(), active: document.activeElement && document.activeElement.id, keys: window.keys })`
  )
}

export async function resetKeys(fragment: string): Promise<void> {
  const page = await pageOf(fragment)
  if (page) await ev(page, `window.keys = []; true`)
}

export async function mainEval(expression: string): Promise<any> {
  const list = await json(`http://127.0.0.1:${INSPECT}/json/list`)
  return evalWs(list[0].webSocketDebuggerUrl, expression)
}

// ---------- teclas e cliques reais ----------
let electronPid = 0
export function setPid(pid: number): void {
  electronPid = pid
}

function osa(script: string): string {
  return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim()
}

function frontName(): string {
  return osa(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  )
}

// outro Electron do mesmo app (outro teste, outra sessão) também se chama "Electron": quem está na
// frente se confere pelo pid
function frontPid(): number {
  return Number(
    osa(
      'tell application "System Events" to get unix id of first application process whose frontmost is true'
    )
  )
}

export async function front(): Promise<void> {
  for (let i = 0; i < 15; i++) {
    try {
      osa(
        `tell application "System Events" to set frontmost of (first application process whose unix id is ${electronPid}) to true`
      )
    } catch {
      // o processo ainda não tem janela
    }
    await sleep(150)
    if (electronPid ? frontPid() === electronPid : frontName() === 'Electron')
      return
  }
  throw new Error(`Electron não ficou na frente: ${frontName()}`)
}

// só manda teclas com o Electron deste teste na frente (nunca para outro app, nem para outro
// Electron). Se outro app tomou a frente entre o front() e o envio, as teclas não saem: tenta de
// novo, e se não der, falha alto em vez de seguir como se tivessem saído
export async function keys(script: string): Promise<void> {
  const guard = electronPid
    ? `(unix id of (first application process whose frontmost is true)) is ${electronPid}`
    : '(name of (first application process whose frontmost is true)) is "Electron"'
  for (let attempt = 0; attempt < 4; attempt++) {
    await front()
    const sent = osa(
      `tell application "System Events"\nif ${guard} then\n${script}\nreturn "sent"\nend if\nreturn "skipped"\nend tell`
    )
    if (sent.endsWith('sent')) return
    await sleep(300)
  }
  throw new Error('as teclas não saíram: o Electron perdeu a frente')
}

export const K = {
  cmdK: 'keystroke "k" using {command down}',
  cmdL: 'keystroke "l" using {command down}',
  cmdT: 'keystroke "t" using {command down}',
  down: 'key code 125',
  up: 'key code 126',
  left: 'key code 123',
  right: 'key code 124',
  home: 'key code 115',
  end: 'key code 119',
  deleteForward: 'key code 117',
  backspace: 'key code 51',
  enter: 'key code 36',
  cmdEnter: 'key code 36 using {command down}',
  optEnter: 'key code 36 using {option down}',
  esc: 'key code 53',
  tab: 'key code 48',
  type: (text: string) => `keystroke ${JSON.stringify(text)}`,
  delay: (ms: number) => `delay ${(ms / 1000).toFixed(3)}`
}

// clique real em coordenadas de tela (o helper em Swift é compilado na primeira vez)
export async function click(x: number, y: number): Promise<void> {
  await front()
  mkdirSync(OUT_DIR, { recursive: true })
  const binary = join(OUT_DIR, 'click')
  if (!existsSync(binary))
    execFileSync('swiftc', ['-O', join(DIR, 'click.swift'), '-o', binary])
  execFileSync(binary, [String(Math.round(x)), String(Math.round(y))])
}

// rolagem real em coordenadas de tela (dy negativo rola a página para baixo)
export async function scroll(x: number, y: number, dy: number): Promise<void> {
  await front()
  mkdirSync(OUT_DIR, { recursive: true })
  const binary = join(OUT_DIR, 'scroll')
  if (!existsSync(binary))
    execFileSync('swiftc', ['-O', join(DIR, 'scroll.swift'), '-o', binary])
  execFileSync(binary, [
    String(Math.round(x)),
    String(Math.round(y)),
    String(Math.round(dy))
  ])
}

// ---------- processos ----------
const PROCESS_PATTERN = `${APP}/node_modules/electron/dist`
// os processos deste teste (o principal e os auxiliares) levam o --user-data-dir dele na linha de
// comando; isso os distingue de outro Electron do mesmo app rodando ao mesmo tempo (e vale com
// node_modules por link simbólico, como num worktree)
let profileMarker: string | null = null

function pgrep(pattern: string): number[] {
  try {
    const out = execFileSync('pgrep', ['-f', '--', pattern], {
      encoding: 'utf8'
    }).trim()
    return out ? out.split('\n').map(Number) : []
  } catch {
    return []
  }
}

export function electronMainPid(): number {
  if (profileMarker) {
    const pids = pgrep(profileMarker)
    for (const pid of pids) {
      const command = execFileSync(
        'ps',
        ['-ww', '-o', 'command=', '-p', String(pid)],
        {
          encoding: 'utf8'
        }
      )
      if (/Contents\/MacOS\/Electron /.test(command) && !/Helper/.test(command))
        return pid
    }
    throw new Error('processo principal do Electron não encontrado')
  }
  return pgrep(`${PROCESS_PATTERN}/Electron.app/Contents/MacOS/Electron`)[0]
}

export function countProcs(): number {
  return pgrep(profileMarker ?? PROCESS_PATTERN).length
}

export interface Procs {
  server: ChildProcess
  electron: ChildProcess
}

// sobe o servidor das páginas de teste e o app, com o perfil em `profile`
export function start(profile: string, extra: string[] = []): Procs {
  mkdirSync(OUT_DIR, { recursive: true })
  profileMarker = `--user-data-dir=${profile}`
  const log = (name: string) => openSync(join(OUT_DIR, name), 'w')
  const options = (name: string): SpawnOptions => ({
    stdio: ['ignore', log(`${name}.log`), log(`${name}.err.log`)]
  })
  const server = spawn(
    'node',
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      join(DIR, 'server.ts'),
      String(SRV)
    ],
    options('server')
  )
  const electron = spawn(
    join(APP, 'node_modules/.bin/electron'),
    [
      APP,
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${CDP}`,
      `--inspect=${INSPECT}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${SRV}`,
      '--janela=0,40,1440,860',
      '--tema=claro',
      ...extra
    ],
    options('electron')
  )
  return { server, electron }
}

export async function waitFor<T>(
  fn: () =>
    Promise<T | null | false | undefined> | T | null | false | undefined,
  ms = 6000,
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

export function stopAll(procs: Procs): void {
  for (const socket of sockets.values()) {
    try {
      socket.ws.close()
    } catch {
      // já fechado
    }
  }
  sockets.clear()
  procs.electron.kill('SIGTERM')
  procs.server.kill('SIGTERM')
}

// fim de um teste: fecha o app pelo caminho normal (before-quit grava o histórico), mata o resto e
// confere que não sobrou processo
export async function shutdown(procs: Procs): Promise<number> {
  try {
    await mainEval(`process.mainModule.require('electron').app.quit()`)
  } catch {
    // o app já saiu
  }
  await sleep(1500)
  stopAll(procs)
  await sleep(800)
  return countProcs()
}

export interface Result {
  name: string
  pass: boolean
  detail: unknown
}

export type Recorder = (name: string, pass: boolean, detail?: unknown) => void

// uma suíte: perfil novo com a fixture, app no ar, o corpo do teste, e o fechamento (processos
// conferidos, resultado em OUT_DIR/<nome>.json e código de saída 1 se algo falhou)
export async function runSuite(
  name: string,
  body: (record: Recorder, profile: string) => Promise<void>,
  options: { fixture?: (profile: string) => void; extra?: string[] } = {}
): Promise<void> {
  const results: Result[] = []
  const record: Recorder = (label, pass, detail = {}) => {
    results.push({ name: label, pass, detail })
    console.log(
      pass ? 'OK   ' : 'FALHA',
      label,
      JSON.stringify(detail).slice(0, 500)
    )
  }
  const profile = join(OUT_DIR, `profile-${name}`)
  mkdirSync(OUT_DIR, { recursive: true })
  ;(options.fixture ?? writeFixture)(profile)
  const procs = start(profile, options.extra)
  try {
    await waitFor(async () => !!(await shell()), 20000)
    await sleep(2500)
    setPid(electronMainPid())
    await body(record, profile)
  } catch (error) {
    record('erro no teste', false, String((error as Error)?.stack ?? error))
  } finally {
    const left = await shutdown(procs)
    record('processos encerrados ao fim', left === 0, { restantes: left })
  }
  const out = join(OUT_DIR, `${name}.json`)
  writeFileSync(
    out,
    JSON.stringify({ when: new Date().toISOString(), results }, null, 2)
  )
  console.log(`resultado em ${out}`)
  if (results.some(result => !result.pass)) process.exitCode = 1
}
