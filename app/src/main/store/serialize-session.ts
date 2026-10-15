// Estado em memória -> conteúdo do session.json. Só entra o que sobrevive a um reinício.
import { limitTitle, limitUrl } from '@shared/limit-stored-text'
import { stripFragment, stripFragmentFromTitle } from '@shared/strip-fragment'
import type { AppSnapshot, SessionFile } from '@shared/types'

export function toSessionFile(
  state: AppSnapshot,
  closed: SessionFile['closed']
): SessionFile {
  return {
    version: 1,
    spaces: state.spaces,
    window: state.window,
    settings: state.settings,
    tabs: state.tabs.map(tab => ({
      id: tab.id,
      spaceId: tab.spaceId,
      url: limitUrl(stripFragment(tab.url)),
      title: limitTitle(stripFragmentFromTitle(tab.title, tab.url)),
      favicon: tab.favicon,
      muted: tab.muted,
      lastActiveAt: tab.lastActiveAt
    })),
    closed: closed.map(entry => ({
      ...entry,
      url: limitUrl(stripFragment(entry.url)),
      title: limitTitle(stripFragmentFromTitle(entry.title, entry.url))
    }))
  }
}
