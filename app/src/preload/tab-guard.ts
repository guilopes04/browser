// Preload das abas (a shell tem o dela, em index.ts). Duas defesas, em todos os quadros:
//
// 1. Troca alert, confirm e prompt da página por versões que perguntam ao main por IPC síncrono (a
//    página espera a resposta, como num diálogo de verdade). Quem decide é o main: só a aba ativa
//    mostra diálogo, com a origem na mensagem e a opção de calar a página que insiste. O Electron
//    não expõe esses diálogos nativos, e eles saem do ar (disableDialogs) para não haver um segundo
//    caminho.
// 2. Reporta ao main o gesto real do usuário (clique, toque, tecla) e o clique num link, com o
//    quadro em que aconteceram. O main sabe que houve um gesto pela aba, mas só o preload de cada
//    quadro sabe em qual: o clique na página não vale para o anúncio de outra origem num iframe
//    (functions/frame-activation.ts). Só conta o evento isTrusted, que a página não fabrica.
//
// Roda em cada quadro (nodeIntegrationInSubFrames): o iframe também passa pelo main. As funções
// ficam não graváveis e não configuráveis: a página não as desfaz. Sem imports além do Electron:
// o preload de sandbox é um arquivo só.
import { contextBridge, ipcRenderer } from 'electron'

// este arquivo é compilado sem DOM: só o que o preload usa do evento e da janela
interface PageEvent {
  isTrusted: boolean
  key?: string
  metaKey?: boolean
  repeat?: boolean
  composedPath?: () => unknown[]
}
interface PageWindow {
  addEventListener(
    type: string,
    listener: (event: PageEvent) => void,
    useCapture: boolean
  ): void
}
// a função enviada ao mundo da página usa o `window` dele
declare const window: PageWindow

// sempre devolve: a página não pode ficar presa se o main não responder
function ask(kind: string, message: string, fallback: string): unknown {
  try {
    return ipcRenderer.sendSync('guard:dialog', { kind, message, fallback })
  } catch {
    return null
  }
}

// ---------- gesto do usuário, por quadro ----------

// modificadores, Esc e teclas sem caractere não ativam nada (o mesmo que o main faz com a tecla)
const IGNORED_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Fn',
  'FnLock',
  'Escape',
  'Dead',
  'Process',
  'Unidentified'
])
// o gesto vale 5 s no main: reportar de novo antes de 100 ms não muda nada e poupa o IPC
const GESTURE_REPORT_GAP_MS = 100
const MAX_URL = 2048

// síncrono: o main registra antes de a página tratar o evento (o pop-up do clique sai na mesma
// tarefa). Falha de IPC nunca pode quebrar a página
function report(channel: string, payload?: unknown): void {
  try {
    ipcRenderer.sendSync(channel, payload)
  } catch {
    // sem o relato, o main trata o gesto como da página principal
  }
}

let lastGestureReport = 0
function reportGesture(): void {
  const now = Date.now()
  if (now - lastGestureReport < GESTURE_REPORT_GAP_MS) return
  lastGestureReport = now
  report('guard:gesture')
}

// o endereço do link em que o usuário clicou (a, area), do caminho do evento (vale shadow DOM)
function linkUrlOf(event: PageEvent): string | null {
  const path =
    typeof event.composedPath === 'function' ? event.composedPath() : []
  for (const node of path) {
    const element = node as { tagName?: unknown; href?: unknown }
    const tag =
      typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
    if (
      (tag === 'A' || tag === 'AREA') &&
      typeof element.href === 'string' &&
      element.href !== ''
    )
      return element.href.slice(0, MAX_URL)
  }
  return null
}

// na captura, na janela: roda antes de qualquer ouvinte da página, que não consegue impedi-lo
for (const type of ['mousedown', 'pointerdown', 'touchend'])
  window.addEventListener(
    type,
    event => {
      if (event.isTrusted) reportGesture()
    },
    true
  )
window.addEventListener(
  'keydown',
  event => {
    if (
      event.isTrusted &&
      !event.metaKey &&
      !event.repeat &&
      !IGNORED_KEYS.has(String(event.key))
    )
      reportGesture()
  },
  true
)
// o clique num link com target=_blank e rel=noreferrer não leva referrer nem opener: o endereço
// do clique é o que liga o pop-up ao usuário
for (const type of ['click', 'auxclick'])
  window.addEventListener(
    type,
    event => {
      if (!event.isTrusted) return
      reportGesture()
      const url = linkUrlOf(event)
      if (url) report('guard:link-click', { url })
    },
    true
  )

// ---------- alert, confirm e prompt ----------

contextBridge.executeInMainWorld({
  // esta função é serializada e roda no mundo da página: nada de variáveis de fora, só o `ask`
  func: (
    askMain: (kind: string, message: string, fallback: string) => unknown
  ) => {
    const define = (name: string, value: unknown) =>
      Object.defineProperty(window, name, {
        value,
        writable: false,
        configurable: false,
        enumerable: true
      })
    const text = (args: unknown[]) => (args.length > 0 ? String(args[0]) : '')

    define('alert', function alert(...args: unknown[]) {
      askMain('alert', text(args), '')
    })
    define('confirm', function confirm(...args: unknown[]) {
      return askMain('confirm', text(args), '') === true
    })
    define('prompt', function prompt(...args: unknown[]) {
      const fallback = args.length > 1 && args[1] != null ? String(args[1]) : ''
      const answer = askMain('prompt', text(args), fallback)
      return typeof answer === 'string' ? answer : null
    })
  },
  args: [ask]
})
