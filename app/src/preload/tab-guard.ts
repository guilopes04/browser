// Preload das abas (a shell tem o dela, em index.ts). Troca alert, confirm e prompt da página por
// versões que perguntam ao main por IPC síncrono (a página espera a resposta, como num diálogo
// de verdade). Quem decide é o main: só a aba ativa mostra diálogo, com a origem na mensagem e a
// opção de calar a página que insiste. O Electron não expõe esses diálogos nativos, e eles saem
// do ar (disableDialogs) para não haver um segundo caminho.
//
// Roda em cada quadro (nodeIntegrationInSubFrames): o iframe também passa pelo main. As funções
// ficam não graváveis e não configuráveis: a página não as desfaz. Sem imports além do Electron:
// o preload de sandbox é um arquivo só.
import { contextBridge, ipcRenderer } from 'electron'

// a função enviada ao mundo da página usa o `window` dele (este arquivo é compilado sem DOM)
declare const window: object

// sempre devolve: a página não pode ficar presa se o main não responder
function ask(kind: string, message: string, fallback: string): unknown {
  try {
    return ipcRenderer.sendSync('guard:dialog', { kind, message, fallback })
  } catch {
    return null
  }
}

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
