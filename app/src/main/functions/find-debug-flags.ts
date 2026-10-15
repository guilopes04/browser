// Depuração remota (CDP) e inspetor do Node abrem uma porta que dá controle total do app a quem
// alcançar o processo: cookies, sessões e execução de código em todas as abas. Empacotado, essas
// opções só valem com --dev. Pura.
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

function matches(arg: string, name: string): boolean {
  return arg === `--${name}` || arg.startsWith(`--${name}=`)
}

// as opções de depuração presentes na linha de comando (e no NODE_OPTIONS, que o Node também lê)
export function findDebugFlags(argv: string[], nodeOptions = ''): string[] {
  const found = new Set<string>()
  for (const arg of argv)
    for (const name of DEBUG_SWITCHES)
      if (matches(arg, name)) found.add(`--${name}`)
  for (const option of nodeOptions.split(/\s+/))
    for (const name of DEBUG_SWITCHES)
      if (matches(option, name)) found.add(`--${name}`)
  return [...found]
}

// quais opções o app empacotado recusa: nenhuma em desenvolvimento ou com --dev
export function findRefusedDebugFlags(
  argv: string[],
  packaged: boolean,
  nodeOptions = ''
): string[] {
  if (!packaged || argv.some(arg => matches(arg, 'dev'))) return []
  return findDebugFlags(argv, nodeOptions)
}
