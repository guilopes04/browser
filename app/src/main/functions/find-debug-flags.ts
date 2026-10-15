// Depuração remota (CDP) e inspetor do Node abrem uma porta que dá controle total do app a quem
// alcançar o processo: cookies, sessões e execução de código em todas as abas. Empacotado, essas
// opções só valem com --dev. Pura.
//
// O Chromium lê a opção com um ou dois hífens ("-remote-debugging-port=9222" vale como a forma
// com dois), então a conferência da linha de comando também aceita as duas. Quem pode perguntar
// ao próprio Chromium (app.commandLine.hasSwitch) deve fazê-lo: é a fonte da verdade.
const DEBUG_SWITCHES = [
  'remote-debugging-port',
  'remote-debugging-pipe',
  'remote-debugging-address',
  'remote-allow-origins',
  'inspect',
  'inspect-brk',
  'inspect-port',
  'inspect-publish-uid',
  'debug-port'
]

// "-nome", "--nome" e "--nome=valor" (com um ou dois hífens)
function matches(arg: string, name: string): boolean {
  if (!arg.startsWith('-')) return false
  const body = arg.startsWith('--') ? arg.slice(2) : arg.slice(1)
  return body === name || body.startsWith(`${name}=`)
}

// o --dev é o do flags.ts, só com dois hífens: "-dev" não libera nada
function isDevFlag(arg: string): boolean {
  return arg === '--dev' || arg.startsWith('--dev=')
}

// pergunta ao Chromium se a opção está presente (app.commandLine.hasSwitch)
export type HasSwitch = (name: string) => boolean

// as opções de depuração presentes na linha de comando (e no NODE_OPTIONS, que o Node também lê)
export function findDebugFlags(
  argv: string[],
  nodeOptions = '',
  hasSwitch?: HasSwitch
): string[] {
  const found = new Set<string>()
  for (const name of DEBUG_SWITCHES) {
    if (hasSwitch?.(name)) found.add(`--${name}`)
    if (argv.some(arg => matches(arg, name))) found.add(`--${name}`)
    if (nodeOptions.split(/\s+/).some(option => matches(option, name)))
      found.add(`--${name}`)
  }
  return [...found]
}

// quais opções o app empacotado recusa: nenhuma em desenvolvimento ou com --dev
export function findRefusedDebugFlags(
  argv: string[],
  packaged: boolean,
  nodeOptions = '',
  hasSwitch?: HasSwitch
): string[] {
  if (!packaged || argv.some(isDevFlag)) return []
  return findDebugFlags(argv, nodeOptions, hasSwitch)
}
