// Erros que ninguém tratou no main viram linhas em userData/logs/main.log. Sem um ouvinte de
// 'uncaughtException' o Electron abre o diálogo modal "A JavaScript error occurred in the main
// process", que congela o app; aqui o erro é registrado e o app segue.
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { formatErrorLog, type ErrorKind } from '../functions/format-error-log'

// ao passar disto o log vira main.old.log (um só anterior): o disco do usuário não enche
const MAX_LOG_BYTES = 512 * 1024

export function getMainLogPath(userData: string): string {
  return join(userData, 'logs', 'main.log')
}

export function appendMainLog(file: string, line: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    try {
      if (statSync(file).size > MAX_LOG_BYTES)
        renameSync(file, file.replace(/main\.log$/, 'main.old.log'))
    } catch {
      // ainda não existe
    }
    appendFileSync(file, line)
  } catch {
    // sem disco ou sem permissão: o console abaixo ainda leva o erro
  }
}

function record(kind: ErrorKind, error: unknown): void {
  const line = formatErrorLog(kind, error)
  console.error(line.trimEnd())
  appendMainLog(getMainLogPath(app.getPath('userData')), line)
}

// "Failed to load URL ... with error" é o aviso que o Electron emite a cada loadURL que falha,
// mesmo com catch: a falha já vira a página de erro da aba (did-fail-load), então não polui
export function isLoadFailureWarning(warning: Error): boolean {
  return (
    warning.name === 'electron' &&
    warning.message.startsWith('Failed to load URL')
  )
}

export function installErrorLog(): void {
  process.on('uncaughtException', error => record('uncaughtException', error))
  process.on('unhandledRejection', reason =>
    record('unhandledRejection', reason)
  )
  // os avisos do Node e do Electron vão para o log em vez do stderr
  process.removeAllListeners('warning')
  process.on('warning', warning => {
    if (isLoadFailureWarning(warning)) return
    appendMainLog(
      getMainLogPath(app.getPath('userData')),
      formatErrorLog('warning', warning)
    )
  })
}
