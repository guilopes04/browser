// Grava a sessão: debounce de 1 s, só quando algo que o arquivo guarda mudou, e de forma
// síncrona no before-quit. Conteúdo igual ao último gravado não reescreve o arquivo.
import type { AppStore } from './app-store'
import { logError } from '../functions/log-error'
import { isPersistedChange } from './is-persisted-change'
import { toSessionFile } from './serialize-session'
import { writeAtomic } from './write-atomic'

const DEBOUNCE_MS = 1000

export interface SessionWriter {
  saveNow(): void
  dispose(): void
}

export function startSessionWriter(
  store: AppStore,
  path: string
): SessionWriter {
  let timer: NodeJS.Timeout | null = null
  let lastWritten: string | null = null

  const saveNow = () => {
    if (timer) clearTimeout(timer)
    timer = null
    try {
      const data = JSON.stringify(toSessionFile(store.state, store.closed))
      if (data === lastWritten) return
      writeAtomic(path, data)
      lastWritten = data
    } catch (error) {
      logError('[Session][saveNow]', 'falha ao gravar a sessão', error)
    }
  }

  const unsubscribe = store.subscribe(change => {
    if (timer || !isPersistedChange(change)) return
    timer = setTimeout(saveNow, DEBOUNCE_MS)
  })

  return {
    saveNow,
    dispose: () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }
}
