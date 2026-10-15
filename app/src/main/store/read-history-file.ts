// history.jsonl do userData. Arquivo ausente = null (a abertura inicial, ou a hora de migrar o
// formato antigo); corrompido vira o que der para aproveitar.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { logError } from '../functions/log-error'
import { parseHistory, type ParsedHistory } from './parse-history'

export function getHistoryPath(userData: string): string {
  return join(userData, 'history.jsonl')
}

export function readHistoryFile(path: string): ParsedHistory | null {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    logError('[History][readHistoryFile]', 'falha ao ler o histórico', error)
    return { histories: new Map(), lines: 0, needsRewrite: false }
  }
  return parseHistory(text)
}
