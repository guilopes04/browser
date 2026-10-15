// Ícone de Downloads: mostra no Finder o último arquivo baixado; sem ele, abre a pasta Downloads.
import { app, shell } from 'electron'
import type { MainContext } from '../context'

export function openDownloads(ctx: MainContext): void {
  const { lastPath } = ctx.store.state.downloads
  if (lastPath) {
    shell.showItemInFolder(lastPath)
    // visto: o aviso de concluído some
    ctx.store.setDownloads({
      ...ctx.store.state.downloads,
      lastPath: null,
      lastName: null,
      lastFailed: false
    })
    return
  }
  void shell.openPath(app.getPath('downloads'))
}
