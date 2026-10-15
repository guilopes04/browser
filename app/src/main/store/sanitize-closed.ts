// Pilha do ⇧⌘T lida do session.json: entrada malformada ou com file:// sai, título é limpo.
import { isLocalFileUrl } from '@shared/is-local-file-url'
import { limitTitle, limitUrl } from '@shared/limit-stored-text'
import { sanitizeTitle } from '@shared/sanitize-title'
import type { SessionFile } from '@shared/types'

export function sanitizeClosed(closed: unknown): SessionFile['closed'] {
  if (!Array.isArray(closed)) return []
  const result: SessionFile['closed'] = []
  for (const entry of closed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry.spaceId !== 'string' ||
      typeof entry.url !== 'string' ||
      typeof entry.title !== 'string' ||
      isLocalFileUrl(entry.url)
    )
      continue
    result.push({
      spaceId: entry.spaceId,
      url: limitUrl(entry.url),
      title: sanitizeTitle(limitTitle(entry.title))
    })
  }
  return result
}
