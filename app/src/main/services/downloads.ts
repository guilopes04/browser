// Downloads: cada sessão de espaço salva na pasta Downloads e o ícone de Downloads da sidebar
// mostra o progresso. "Salvar imagem como" (ctx.saveAs) deixa o diálogo do sistema aparecer.
// Contra página hostil:
// - sem gesto recente do usuário na aba, o usuário permite ou não num diálogo (o download fica
//   pausado até lá) e uma aba não segura mais de 20 downloads ao mesmo tempo;
// - o nome do arquivo é reservado com abertura exclusiva, então downloads simultâneos do mesmo
//   nome nunca se sobrescrevem;
// - o arquivo concluído recebe a quarentena do macOS, que o Gatekeeper usa antes de abrir.
import { rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app, type DownloadItem, type Session } from 'electron'
import type { TabId } from '@shared/types'
import { getHostname } from '@shared/url-parts'
import type { MainContext } from '../context'
import { askDownloadConsent } from '../functions/ask-download-consent'
import {
  decideDownload,
  DOWNLOAD_COOLDOWN_MS
} from '../functions/decide-download'
import { findTabByContents } from '../functions/find-tab-by-contents'
import { sanitizeFileName } from '../functions/pick-file-name'
import { quarantineFile } from '../functions/quarantine-file'
import { reserveDownloadPath } from '../functions/reserve-download-path'
import {
  summarizeDownloads,
  type DownloadProgress
} from '../functions/summarize-downloads'
import { hasRecentGesture } from '../functions/user-gesture'

// o progresso chega muitas vezes por segundo; a shell recebe no máximo isto
const PUBLISH_INTERVAL_MS = 250
// downloads de um webContents que nenhuma aba possui (a shell, por exemplo)
const NO_TAB = '(sem aba)'

const watched = new WeakSet<Session>()

// remove o arquivo reservado que ficou vazio (download cancelado ou recusado)
function dropPlaceholder(path: string | null): void {
  if (!path) return
  try {
    if (statSync(path).size === 0) rmSync(path)
  } catch {
    // já não existe
  }
}

function dropFile(path: string): void {
  try {
    rmSync(path, { force: true })
  } catch (error) {
    console.error('[Downloads][drop] falha ao remover', error)
  }
}

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

  const release = (item: DownloadItem, owner: TabId | typeof NO_TAB) => {
    running.delete(item)
    const left = (ctx.guard.downloadsRunning.get(owner) ?? 1) - 1
    if (left > 0) ctx.guard.downloadsRunning.set(owner, left)
    else ctx.guard.downloadsRunning.delete(owner)
  }

  const publishDone = (
    completed: boolean,
    failed: boolean,
    file: { path: string; name: string }
  ) => {
    const { active, percent } = summarizeDownloads([...running.values()])
    ctx.store.setDownloads({
      active,
      percent,
      // cancelado pelo usuário (diálogo de salvar dispensado) não deixa aviso
      lastPath: completed ? file.path : null,
      lastName: completed ? file.name : null,
      lastFailed: failed
    })
  }

  ses.on('will-download', (event, item, contents) => {
    const tabId = findTabByContents(ctx, contents)
    const owner = tabId ?? NO_TAB
    const guard = ctx.guard
    const now = Date.now()
    const saveAs = ctx.saveAs.delete(item.getURL())
    const decision = decideDownload({
      userInitiated: saveAs,
      hasGesture: tabId !== null && hasRecentGesture(guard, tabId, now),
      running: guard.downloadsRunning.get(owner) ?? 0,
      prompt: guard.downloadPrompts.get(owner),
      now
    })
    if (decision.startsWith('reject')) {
      console.warn(
        `[Downloads][will-download] recusado (${decision}): ${item.getFilename()}`
      )
      event.preventDefault()
      return
    }

    const downloads = app.getPath('downloads')
    // o diálogo de "Salvar imagem como" escolhe o caminho; nos demais, o nome é reservado já
    let reserved: string | null = null
    if (saveAs) {
      item.setSaveDialogOptions({
        defaultPath: join(downloads, sanitizeFileName(item.getFilename()))
      })
    } else {
      try {
        reserved = reserveDownloadPath(downloads, item.getFilename())
      } catch (error) {
        console.error(
          '[Downloads][will-download] sem como reservar o nome',
          error
        )
        event.preventDefault()
        ctx.store.setDownloads({
          ...ctx.store.state.downloads,
          lastPath: null,
          lastName: null,
          lastFailed: true
        })
        return
      }
      item.setSavePath(reserved)
    }

    guard.downloadsRunning.set(
      owner,
      (guard.downloadsRunning.get(owner) ?? 0) + 1
    )
    running.set(item, { received: 0, total: item.getTotalBytes() })
    // um download novo apaga o aviso do anterior
    ctx.store.setDownloads({
      ...ctx.store.state.downloads,
      lastPath: null,
      lastName: null,
      lastFailed: false
    })
    publish()

    // sem gesto: pausa e pergunta. O download só anda se o usuário permitir
    let consent: Promise<boolean> = Promise.resolve(true)
    if (decision === 'ask') {
      const prompt = { pending: true, deniedUntil: 0 }
      guard.downloadPrompts.set(owner, prompt)
      item.pause()
      consent = askDownloadConsent(ctx, {
        name: sanitizeFileName(item.getFilename()),
        bytes: item.getTotalBytes(),
        site: getHostname(item.getURL())
      })
        .catch(() => false)
        .then(allowed => {
          prompt.pending = false
          if (allowed) {
            if (item.isPaused()) item.resume()
          } else {
            prompt.deniedUntil = Date.now() + DOWNLOAD_COOLDOWN_MS
            item.cancel()
          }
          return allowed
        })
    }

    item.on('updated', () => {
      running.set(item, {
        received: item.getReceivedBytes(),
        total: item.getTotalBytes()
      })
      publishSoon()
    })
    item.once('done', (_doneEvent, state) => {
      // o item some depois do 'done': o que importa é lido já
      const savePath = item.getSavePath() || reserved
      const name = item.getFilename()
      void (async () => {
        const allowed = await consent
        release(item, owner)
        if (!allowed) {
          // recusado: nem o arquivo reservado, nem o que já tenha chegado
          if (savePath) dropFile(savePath)
          publishDone(false, false, { path: '', name })
          return
        }
        if (state !== 'completed') {
          dropPlaceholder(reserved)
          publishDone(false, state === 'interrupted', { path: '', name })
          return
        }
        if (savePath && !(await quarantineFile(savePath))) {
          // sem quarentena o Gatekeeper não protegeria o arquivo: ele não fica
          dropFile(savePath)
          publishDone(false, true, { path: '', name })
          return
        }
        publishDone(true, false, { path: savePath ?? '', name })
      })()
    })
  })
}
