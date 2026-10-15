// Linhas do history.jsonl. Visita: {spaceId, url, title, visitedAt}. Atualização de título:
// {spaceId, url, title}, sem visitedAt (só vale para uma visita que já existe).
import { stripFragment } from '@shared/strip-fragment'
import type { SpaceId } from '@shared/types'
import type { SpaceHistory } from './space-history'

export function serializeVisit(
  spaceId: SpaceId,
  visit: { url: string; title: string; visitedAt: number }
): string {
  return `${JSON.stringify({
    spaceId,
    url: stripFragment(visit.url),
    title: visit.title,
    visitedAt: visit.visitedAt
  })}\n`
}

export function serializeTitle(
  spaceId: SpaceId,
  url: string,
  title: string
): string {
  return `${JSON.stringify({ spaceId, url: stripFragment(url), title })}\n`
}

// o arquivo inteiro, da visita mais antiga para a mais nova (compactação)
export function serializeAll(histories: Map<SpaceId, SpaceHistory>): string {
  const lines: string[] = []
  for (const [spaceId, history] of histories)
    for (let i = history.list.length - 1; i >= 0; i--)
      lines.push(serializeVisit(spaceId, history.list[i]))
  return lines.join('')
}
