// history.jsonl -> históricos por espaço. Linha corrompida (ou a última, cortada por uma queda)
// é ignorada. Linhas repetidas da mesma página se fundem na visita mais nova.
import { limitTitle, limitUrl } from '@shared/limit-stored-text'
import type { SpaceId } from '@shared/types'
import { toUrlKey } from '@shared/url-key'
import {
  createSpaceHistory,
  trimHistory,
  type SpaceHistory
} from './space-history'

export interface ParsedHistory {
  histories: Map<SpaceId, SpaceHistory>
  // linhas válidas lidas: com muito mais linhas que entradas, vale compactar o arquivo
  lines: number
}

function applyLine(
  histories: Map<SpaceId, SpaceHistory>,
  data: Record<string, unknown>
): boolean {
  const { spaceId, visitedAt } = data
  if (typeof spaceId !== 'string' || spaceId === '') return false
  if (typeof data.url !== 'string' || typeof data.title !== 'string')
    return false
  // arquivos de versões antigas podem ter URLs gigantes
  const url = limitUrl(data.url)
  const title = limitTitle(data.title)

  let history = histories.get(spaceId)
  if (!history) {
    history = createSpaceHistory()
    histories.set(spaceId, history)
  }
  const key = toUrlKey(url)
  const existing = history.byKey.get(key)

  // atualização de título: só vale para uma visita que existe
  if (visitedAt === undefined) {
    if (existing && title) existing.title = title
    return true
  }
  if (typeof visitedAt !== 'number' || !Number.isFinite(visitedAt)) return false

  if (!existing) {
    const entry = { url, title, visitedAt, key }
    history.list.push(entry)
    history.byKey.set(key, entry)
    return true
  }
  const newer = visitedAt >= existing.visitedAt
  if (title && (newer || !existing.title)) existing.title = title
  if (newer) {
    existing.url = url
    existing.visitedAt = visitedAt
  }
  return true
}

export function parseHistory(text: string): ParsedHistory {
  const histories = new Map<SpaceId, SpaceHistory>()
  let lines = 0
  for (const line of text.split('\n')) {
    if (line === '') continue
    try {
      const data: unknown = JSON.parse(line)
      if (typeof data === 'object' && data !== null && !Array.isArray(data))
        if (applyLine(histories, data as Record<string, unknown>)) lines++
    } catch {
      // linha cortada ou corrompida
    }
  }
  for (const history of histories.values())
    history.list.sort((a, b) => b.visitedAt - a.visitedAt)
  trimHistory(histories)
  return { histories, lines }
}
