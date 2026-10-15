// Downloads: cada sessão de espaço salva na pasta Downloads, sem diálogo e sem sobrescrever, e o
// ícone de Downloads da sidebar mostra o progresso. "Salvar imagem como" (ctx.saveAs) é a exceção:
// deixa o diálogo do sistema aparecer.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, type DownloadItem, type Session } from 'electron'
import type { MainContext } from '../context'
import { pickFileName } from '../functions/pick-file-name'
import {
  summarizeDownloads,
  type DownloadProgress
} from '../functions/summarize-downloads'

// o progresso chega muitas vezes por segundo; a shell recebe no máximo isto
const PUBLISH_INTERVAL_MS = 250

const watched = new WeakSet<Session>()

export function watchDownloads(ctx: MainContext, ses: Session): void {
  if (watched.has(ses)) return
  watched.add(ses)

  const running = new Map<DownloadItem, DownloadProgress>()
  let lastPublish = 0
  let timer: NodeJS.Timeout | null = null

  const publish = () => {
    if (timer) clearTimeout(timer)
    timer = null
    lastPublish = Date.now()
    const { active, percent } = summarizeDownloads([...running.values()])
    ctx.store.setDownloads({ ...ctx.store.state.downloads, active, percent })
  }
  const publishSoon = () => {
    if (timer) return
    const wait = Math.max(0, PUBLISH_INTERVAL_MS - (Date.now() - lastPublish))
    timer = setTimeout(publish, wait)
  }

  ses.on('will-download', (_event, item) => {
    const downloads = app.getPath('downloads')
    const saveAs = ctx.saveAs.delete(item.getURL())
    const name = pickFileName(item.getFilename(), candidate =>
      existsSync(join(downloads, candidate))
    )
    if (saveAs)
      item.setSaveDialogOptions({ defaultPath: join(downloads, name) })
    else item.setSavePath(join(downloads, name))

    running.set(item, { received: 0, total: item.getTotalBytes() })
    // um download novo apaga o aviso do anterior
    ctx.store.setDownloads({
      ...ctx.store.state.downloads,
      lastPath: null,
      lastName: null,
      lastFailed: false
    })
    publish()

    item.on('updated', () => {
      running.set(item, {
        received: item.getReceivedBytes(),
        total: item.getTotalBytes()
      })
      publishSoon()
    })
    item.once('done', (_doneEvent, state) => {
      running.delete(item)
      const { active, percent } = summarizeDownloads([...running.values()])
      const completed = state === 'completed'
      ctx.store.setDownloads({
        active,
        percent,
        // cancelado pelo usuário (diálogo de salvar dispensado) não deixa aviso
        lastPath: completed ? item.getSavePath() : null,
        lastName: completed ? item.getFilename() : null,
        lastFailed: state === 'interrupted'
      })
    })
  })
}
