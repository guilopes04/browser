// Estado em memória -> conteúdo do session.json. Só entra o que sobrevive a um reinício.
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
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
      muted: tab.muted,
      lastActiveAt: tab.lastActiveAt
    })),
    closed
  }
}
