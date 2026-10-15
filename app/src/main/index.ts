// Bootstrap do main: flags, protocolo, estado, janela, shell, menu, timers.
import { app, BaseWindow, nativeTheme, WebContentsView } from 'electron'
import { join } from 'node:path'
import { getSpaceBackground } from '@shared/tokens'
import { activateTab, wakeTab } from './actions'
import type { MainContext } from './context'
import { parseFlags } from './flags'
import {
  applyLayout,
  cleanUserAgent,
  exitVideoFullscreen,
  forwardEarlyKey,
  guardShell,
  handleEarlyShortcut,
  readTabsFile,
  resolveWindowBounds
} from './functions'
import { createBroadcaster } from './ipc/broadcast'
import { registerIpc } from './ipc/register-ipc'
import {
  buildAppMenu,
  getShellUrl,
  handleAppProtocol,
  readTheme,
  registerAppScheme,
  scheduleCapture,
  startMetaFill,
  startSuspensionTimer,
  useTempProfile,
  watchTheme
} from './services'
import { AppStore } from './store/app-store'
import { buildInitialState } from './store/build-initial-state'
import { HistoryStore } from './store/history-store'
import { readSessionFile } from './store/read-session-file'
import { getSessionPath } from './store/session-path'
import { startSessionWriter } from './store/session-writer'

const flags = parseFlags(process.argv)
// com --abas a sessão é de uso único: não lê nem grava o session.json (o do usuário fica intacto)
const ephemeralSession = flags.tabsSource !== null
// ...e também não toca no perfil real: sem --user-data-dir, os cookies e o cache das partições
// dos espaços vão para uma pasta temporária (antes de pedir o lock, que depende dela)
if (ephemeralSession && !app.commandLine.hasSwitch('user-data-dir'))
  useTempProfile()

// menos processos de UI: sem renderer reserva (permitido pela arquitetura, seção 7)
app.commandLine.appendSwitch(
  'disable-features',
  'SpareRendererForSitePerProcess'
)
registerAppScheme()

// user agent global sem "Electron/x" e sem o token do app (as sessões dos espaços, e a shell,
// partem deste valor)
app.userAgentFallback = cleanUserAgent(app.userAgentFallback)

if (flags.theme) nativeTheme.themeSource = flags.theme

// uma instância por userData (partições e session.json não toleram duas)
const hasLock = app.requestSingleInstanceLock()
if (!hasLock) app.quit()

async function bootstrap(): Promise<void> {
  handleAppProtocol(join(__dirname, '../renderer'))

  const userData = app.getPath('userData')
  const sessionPath = getSessionPath(userData)
  if (ephemeralSession)
    console.log(
      '[Session][bootstrap] --abas: sessão de uso único, session.json intacto'
    )
  const tabsFile = flags.tabsSource ? readTabsFile(flags.tabsSource) : null
  const saved = ephemeralSession ? null : readSessionFile(sessionPath)

  const { bounds, sizeExplicit } = resolveWindowBounds(
    saved?.window.bounds ?? null,
    tabsFile?.window ?? {},
    flags
  )
  const { state, closed } = buildInitialState({
    theme: readTheme(),
    session: saved,
    tabsFile,
    bounds
  })
  const store = new AppStore(state, closed)

  const win = new BaseWindow({
    ...bounds,
    enableLargerThanScreen: sizeExplicit,
    show: false,
    minWidth: 560,
    minHeight: 400,
    title: 'Gilas Browser',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 21 },
    backgroundColor: getSpaceBackground(
      store.getCurrentSpace().color,
      state.theme
    )
  })

  const shell = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  // o body da shell é transparente: só os elementos pintam
  shell.setBackgroundColor('#00000000')

  const ctx: MainContext = {
    store,
    history: new HistoryStore(userData),
    flags,
    win,
    shell,
    broadcaster: createBroadcaster(
      () => store.state,
      () => shell.webContents
    ),
    views: new Map(),
    stash: new Map(),
    pendingScroll: new Map(),
    suspending: new Set(),
    httpFallbacks: new Map(),
    attached: { tabId: null, view: null },
    shellRaised: false,
    shellReady: false,
    keyGate: null,
    metaFilled: Promise.resolve(),
    quitting: false
  }

  const shellUrl = getShellUrl()
  guardShell(ctx, shellUrl)
  shell.webContents.on('before-input-event', (event, input) => {
    if (!handleEarlyShortcut(ctx, event, input))
      forwardEarlyKey(ctx, event, input)
  })
  win.contentView.addChildView(shell)
  applyLayout(ctx)

  // a janela aparece quando a shell carregou e recebeu o primeiro estado
  let shellLoaded = false
  let stateServed = false
  const showWhenReady = () => {
    if (shellLoaded && stateServed && !win.isVisible()) win.show()
  }
  shell.webContents.once('did-finish-load', () => {
    shellLoaded = true
    showWhenReady()
  })
  registerIpc(ctx, () => {
    stateServed = true
    showWhenReady()
  })

  store.subscribe(change => {
    if (change.kind === 'structure' || change.kind === 'view')
      ctx.broadcaster.scheduleSnapshot()
    else if (change.kind === 'tab')
      ctx.broadcaster.queueTabPatch(change.tabId, change.patch)
  })

  const writer = ephemeralSession
    ? null
    : startSessionWriter(store, sessionPath)
  const syncBounds = () => {
    if (!win.isFullScreen() && !win.isMinimized())
      store.setBounds(win.getBounds())
  }
  win.on('resize', () => {
    applyLayout(ctx)
    syncBounds()
  })
  win.on('move', syncBounds)
  // o layout depende de a janela estar em tela cheia (vídeo ocupa a janela inteira)
  win.on('enter-full-screen', () => applyLayout(ctx))
  win.on('leave-full-screen', () => {
    // saiu pela janela (botão verde, menu): o vídeo deixa de ocupar a janela
    exitVideoFullscreen(ctx)
    applyLayout(ctx)
  })
  win.on('closed', () => app.quit())

  app.on('before-quit', () => {
    ctx.quitting = true
    writer?.saveNow()
    ctx.history.saveNow()
  })
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  buildAppMenu(ctx)
  watchTheme(ctx)

  // shell e aba ativa carregam em paralelo
  void shell.webContents.loadURL(shellUrl)
  const activeId = store.getActiveTabId()
  if (activeId) activateTab(ctx, activeId)

  // modo "justo" da bancada: todas as abas de uma vez, a ativa primeiro
  if (flags.loadAll) {
    for (const tab of store.state.tabs) wakeTab(ctx, tab.id)
  }

  startSuspensionTimer(ctx)
  ctx.metaFilled = startMetaFill(ctx)
  if (flags.capturePath) scheduleCapture(ctx, flags.capturePath)
}

if (hasLock) {
  void app.whenReady().then(bootstrap)
  app.on('window-all-closed', () => app.quit())
}
