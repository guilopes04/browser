// --captura=<png>: espera a aba ativa carregar, mais um tempo, captura a janela inteira com
// screencapture -l (id da janela) e sai. --captura-paleta=<png> abre a paleta antes (consulta
// vazia, ou a de --paleta-consulta) e --captura-nova-aba=<png> deixa uma Nova aba ativa.
import { execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { app } from 'electron'
import { createTab } from '../actions/create-tab'
import { openPalette } from '../actions/open-palette'
import type { MainContext } from '../context'
import { logError } from '../functions/log-error'
import { removeTempProfile } from './temp-profile'

const LOAD_TIMEOUT_MS = 30_000
// o título e o favicon das abas e favoritos que nunca carregaram chegam em segundo plano: a foto
// espera por eles, mas não para sempre
const META_TIMEOUT_MS = 15_000
// tempo para a shell pintar a paleta ou a Nova aba antes da foto
const SCENE_PAINT_MS = 600

const wait = (ms: number) => new Promise<void>(done => setTimeout(done, ms))

function waitForActiveTab(ctx: MainContext): Promise<void> {
  return new Promise(resolvePromise => {
    const { store } = ctx
    const isDone = () => {
      const tab = store.getActiveTab()
      // Nova aba não carrega nada; aba viva termina quando loading volta a false
      return !tab || tab.url === '' || (!tab.dormant && !tab.loading)
    }
    if (isDone()) return resolvePromise()

    const finish = () => {
      unsubscribe()
      clearTimeout(timeout)
      resolvePromise()
    }
    const unsubscribe = store.subscribe(() => {
      if (isDone()) finish()
    })
    const timeout = setTimeout(finish, LOAD_TIMEOUT_MS)
  })
}

function screenshot(windowId: string, file: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    execFile('screencapture', ['-x', '-o', '-l', windowId, file], error =>
      error ? reject(error) : resolvePromise()
    )
  })
}

function prepareScene(ctx: MainContext): void {
  const { captureScene, paletteQuery } = ctx.flags
  if (captureScene === 'palette') openPalette(ctx, 'search', paletteQuery)
  // a Nova aba entra no topo da lista e fica ativa (se a ativa já é uma, serve)
  if (captureScene === 'new-tab' && ctx.store.getActiveTab()?.url !== '')
    createTab(ctx)
}

export function scheduleCapture(ctx: MainContext, outputPath: string): void {
  const file = resolve(outputPath)
  void (async () => {
    try {
      await waitForActiveTab(ctx)
      await Promise.race([ctx.metaFilled, wait(META_TIMEOUT_MS)])
      await wait(ctx.flags.captureDelayMs)
      // a shell precisa ter recebido o primeiro estado
      for (let i = 0; i < 50 && !ctx.shellReady; i++) await wait(100)
      prepareScene(ctx)
      mkdirSync(dirname(file), { recursive: true })
      // semáforos coloridos só com a janela em primeiro plano; outros apps podem roubar o foco,
      // então insiste por até 3 s antes de capturar
      for (let i = 0; i < 15; i++) {
        app.focus({ steal: true })
        ctx.win.focus()
        if (ctx.win.isFocused()) break
        await wait(200)
      }
      await wait(ctx.flags.captureScene === 'window' ? 200 : SCENE_PAINT_MS)
      const windowId = ctx.win.getMediaSourceId().split(':')[1]
      await screenshot(windowId, file)
      console.log(`[Capture][scheduleCapture] captura salva em ${file}`)
      removeTempProfile()
      app.exit(0)
    } catch (error) {
      logError('[Capture][scheduleCapture]', 'falha na captura', error)
      removeTempProfile()
      app.exit(1)
    }
  })()
}
