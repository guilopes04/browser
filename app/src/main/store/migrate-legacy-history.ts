// Formato antigo: um history-<espaço>.json por espaço ({version, entries} da mais recente para a
// mais antiga, até 500). Vira linhas do history.jsonl; só depois de gravar o novo arquivo o antigo
// ganha o sufixo .migrado (nada é apagado).
import { readdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import type { SpaceId } from '@shared/types'
import {
  addHistoryEntry,
  createSpaceHistory,
  type SpaceHistory
} from './space-history'

const LEGACY_FILE = /^history-(.+)\.json$/

export interface LegacyHistory {
  histories: Map<SpaceId, SpaceHistory>
  files: string[]
}

export function readLegacyHistory(userData: string): LegacyHistory | null {
  let names: string[]
  try {
    names = readdirSync(userData).filter(name => LEGACY_FILE.test(name))
  } catch {
    return null
  }

  const histories = new Map<SpaceId, SpaceHistory>()
  const files: string[] = []
  for (const name of names) {
    const spaceId = (LEGACY_FILE.exec(name) as RegExpExecArray)[1]
    const path = join(userData, name)
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as {
        entries?: unknown
      }
      const entries = Array.isArray(data.entries) ? data.entries : []
      const history = createSpaceHistory()
      // da mais antiga para a mais nova, para a lista sair na ordem certa
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i] as Record<string, unknown> | null
        if (
          entry &&
          typeof entry.url === 'string' &&
          typeof entry.title === 'string' &&
          typeof entry.visitedAt === 'number' &&
          Number.isFinite(entry.visitedAt)
        )
          addHistoryEntry(history, {
            url: entry.url,
            title: entry.title,
            visitedAt: entry.visitedAt
          })
      }
      histories.set(spaceId, history)
      files.push(path)
    } catch {
      // arquivo antigo ilegível: fica onde está
    }
  }
  return files.length > 0 ? { histories, files } : null
}

export function markLegacyMigrated(files: string[]): void {
  for (const path of files) {
    try {
      renameSync(path, `${path}.migrado`)
    } catch {
      // sem permissão: o histórico novo já está gravado, o antigo só fica sobrando
    }
  }
}
