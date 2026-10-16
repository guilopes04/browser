// Bootstrap do main: flags, protocolo, estado, janela, shell, menu, timers.
import { app, BaseWindow, dialog, nativeTheme, WebContentsView } from 'electron'
import { join } from 'node:path'
import { getSpaceBackground } from '@shared/tokens'
import { activateTab, hideWindow, showWindow, wakeTab } from './actions'
import type { MainContext } from './context'
import { parseFlags } from './flags'
import {
  applyLayout,
  bindSessionContext,
  cleanUserAgent,
  exitVideoFullscreen,
  findRefusedDebugFlags,
  forwardEarlyKey,
  guardShell,
  handleEarlyShortcut,
  logError,
  pushFindState,
  readTabsFile,
  resolveWindowBounds,
  sweepStaging
} from './functions'
import { createBroadcaster } from './ipc/broadcast'
import { registerIpc } from './ipc/register-ipc'
import {
  buildAppMenu,
  enableAppSandbox,
  getShellUrl,
  handleAppProtocol,
  hardenDefaultSession,
  installAppHardening,
  installClientCertificateDialog,
  installErrorLog,
  readTheme,
  registerAppScheme,
  registerFrameGestures,
  registerScriptDialogs,
  scheduleCapture,
  startMetaFill,
  startSuspensionTimer,
  useTempProfile,
  watchTheme
} from './services'
import { AppStore } from './store/app-store'
import { buildInitialState } from './store/build-initial-state'
import { HistoryStore } from './store/history-store'
import { protectDataFiles } from './store/private-files'
import { readSessionFile } from './store/read-session-file'
import { getSessionPath } from './store/session-path'
import { startSessionWriter } from './store/session-writer'
import { createWebGuard } from './web-guard'

// o primeiro de tudo: erro sem tratamento vai para o log, nunca para um diálogo modal
installErrorLog()

// depuração remota e inspetor abrem uma porta com controle total do app: empacotado, só com --dev
// (o Chromium também lê "-opção" com um hífen só: a conferência pergunta a ele)
const refusedDebugFlags = findRefusedDebugFlags(
  process.argv,
  app.isPackaged,
  process.env['NODE_OPTIONS'],
  name => app.commandLine.hasSwitch(name)
)
const startupRefused = refusedDebugFlags.length > 0
if (startupRefused) {
  dialog.showErrorBox(
    'Gilas Browser',
    `Estas opções abrem uma porta de depuração que dá controle total do app e dos seus dados: ${refusedDebugFlags.join(', ')}.\n\nSe isso é de propósito, abra o app com --dev.`
  )
  app.exit(1)
}

// todo renderer nasce com sandbox, e sessão nenhuma concede permissão ou dispositivo por conta própria
// (antes de app.ready)
enableAppSandbox()
installAppHardening()

const flags = parseFlags(process.argv)
// com --abas a sessão é de uso único: não lê nem grava o session.json (o do usuário fica intacto)
const ephemeralSession = flags.tabsSource !== null
// ...e também não toca no perfil real: sem --user-data-dir, os cookies e o cache das partições
// dos espaços vão para uma pasta temporária (antes de pedir o lock, que depende dela)
if (
  !startupRefused &&
  ephemeralSession &&
  !app.commandLine.hasSwitch('user-data-dir')
)
  useTempProfile()

// menos processos de UI: sem renderer reserva (permitido pela arquitetura, seção 7) e sem Web
// Bluetooth (o pedido chegaria ao TCC do macOS). Um navegador que só fala quando o usuário manda:
// nada de serviços de segundo plano do Chromium
app.commandLine.appendSwitch(
  'disable-features',
  'SpareRendererForSitePerProcess,WebBluetooth'
)
app.commandLine.appendSwitch('disable-background-networking')
registerAppScheme()

// user agent global sem "Electron/x" e sem o token do app (as sessões dos espaços, e a shell,
// partem deste valor)
app.userAgentFallback = cleanUserAgent(app.userAgentFallback)

if (flags.theme) nativeTheme.themeSource = flags.theme
// testes: os downloads vão para uma pasta de teste, nunca para a do usuário
if (flags.downloadsDir) app.setPath('downloads', flags.downloadsDir)

// uma instância por userData (partições e session.json não toleram duas)
const hasLock = !startupRefused && app.requestSingleInstanceLock()
if (!hasLock && !startupRefused) app.quit()

async function bootstrap(): Promise<void> {
  hardenDefaultSession()
  handleAppProtocol(join(__dirname, '../renderer'))

  const userData = app.getPath('userData')
  // sessão, histórico e log são só do usuário: 0600 (e a pasta 0700), mesmo os já existentes
  protectDataFiles(userData)
  // o que um download sem permissão deixou no temporário quando o app caiu antes de a pergunta ser
  // respondida (sem quarentena, fora de Downloads)
  sweepStaging(app.getPath('temp'))
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
    closing: new Set(),
    saveAs: new Set(),
    attached: { tabId: null, view: null },
    shellRaised: false,
    shellReady: false,
    find: null,
    findMatchCase: false,
    keyGate: null,
    guard: createWebGuard(),
    metaFilled: Promise.resolve(),
    quitting: false
  }

  installClientCertificateDialog(() => (win.isDestroyed() ? null : win))
  // as sessões dos espaços respondem a mailto: e afins com um diálogo (precisam do contexto)
  bindSessionContext(ctx)
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
  let everShown = false
  const showWhenReady = () => {
    if (shellLoaded && stateServed && !win.isVisible()) {
      win.show()
      everShown = true
    }
  }
  shell.webContents.once('did-finish-load', () => {
    shellLoaded = true
    showWhenReady()
  })
  registerIpc(ctx, () => {
    stateServed = true
    showWhenReady()
  })
  registerScriptDialogs(ctx)
  registerFrameGestures(ctx)

  store.subscribe(change => {
    if (change.kind === 'structure' || change.kind === 'view')
      ctx.broadcaster.scheduleSnapshot()
    else if (change.kind === 'tab')
      ctx.broadcaster.queueTabPatch(change.tabId, change.patch)
    // a barra de busca também segue o tema
    if (change.kind === 'view') pushFindState(ctx)
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
  // macOS: o botão vermelho esconde a janela e o app continua no Dock (⌘Q encerra). O Dock
  // (activate) traz a janela de volta com a sessão. A sessão é gravada ao esconder
  win.on('close', event => {
    if (ctx.quitting || process.platform !== 'darwin') return
    event.preventDefault()
    hideWindow(ctx)
    writer?.saveNow()
    ctx.history.saveNow()
  })
  win.on('closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    ctx.quitting = true
    writer?.saveNow()
    ctx.history.saveNow()
  })
  // encerrado com um download esperando permissão: o que o Chromium gravou no temporário não fica
  app.on('will-quit', () => {
    sweepStaging(app.getPath('temp'), { includeOwn: true })
  })
  app.on('second-instance', () => showWindow(ctx))
  // o clique no Dock também chega no primeiro lançamento, antes de a janela existir na tela
  app.on('activate', () => {
    if (everShown) showWindow(ctx)
  })

  buildAppMenu(ctx)
  watchTheme(ctx)

  // shell e aba ativa carregam em paralelo
  shell.webContents.loadURL(shellUrl).catch(error => {
    logError('[Shell][loadURL]', 'falha ao carregar a interface', error)
  })
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
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
