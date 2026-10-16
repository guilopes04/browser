// As webPreferences de toda aba de página: as que o app cria (createTabView) e as que o Chromium
// cria em window.open e target=_blank (window-open.ts devolve estas mesmas em
// overrideBrowserWindowOptions). O Electron só herda do opener as preferências "mais seguras" e
// nunca nodeIntegrationInSubFrames nem disableDialogs: sem isto, a aba aberta por script nascia com
// o alert nativo (sem origem, sem o limite de 3 em 10 s) e sem o preload da guarda nos iframes.
import type { WebPreferences } from 'electron'
import { getSpaceSession } from './get-space-session'
import { getTabPreloadPath } from './tab-preload-path'

// sem sessão: a do pop-up é a do opener (o Chromium cria o webContents no mesmo perfil)
export function getPagePreferences(
  preload = getTabPreloadPath()
): WebPreferences {
  return {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    // alert/confirm/prompt passam pelo main (preload/tab-guard.ts, registrado na sessão: vale
    // também para o pop-up que o Chromium cria), em todos os quadros; os diálogos nativos do
    // Electron, que não mostram a origem nem se calam, ficam desligados
    ...(preload
      ? { nodeIntegrationInSubFrames: true, disableDialogs: true }
      : {})
  }
}

export function getTabWebPreferences(spaceId: string): WebPreferences {
  return { session: getSpaceSession(spaceId), ...getPagePreferences() }
}
