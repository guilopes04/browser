// Lê e valida userData/session.json. Arquivo ausente, corrompido ou de outra versão = sem sessão.
import { readFileSync } from 'node:fs'
import type { SessionFile, SidebarMode } from '@shared/types'

const SIDEBAR_MODES: readonly SidebarMode[] = ['open', 'compact', 'hidden']

export function readSessionFile(path: string): SessionFile | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as SessionFile
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.spaces) ||
      !Array.isArray(parsed.tabs)
    ) {
      return null
    }
    if (parsed.spaces.length === 0) return null
    // arquivo editado à mão: modo de sidebar inválido volta para aberta
    if (!SIDEBAR_MODES.includes(parsed.window?.sidebar))
      parsed.window = { ...parsed.window, sidebar: 'open' }
    return parsed
  } catch {
    return null
  }
}
