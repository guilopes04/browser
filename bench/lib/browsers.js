// Definição de cada navegador medido: binário, argumentos, preparo do perfil e sondagem das páginas.
const fs = require('fs')
const path = require('path')
const cdp = require('./cdp')
const bidi = require('./bidi')
const sys = require('./system')

const CHROME_BINARY = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ZEN_BINARY = '/Applications/Zen.app/Contents/MacOS/zen'
// BENCH_APP_DIR / BENCH_ELECTRON permitem testar a bancada com outro app Electron (ex.: um app de mentira)
const APP_DIR = process.env.BENCH_APP_DIR || path.join(sys.ROOT, 'app')
// Binário do Electron aberto direto: o node_modules/.bin/electron é um wrapper Node que sobra vivo (12 MB, 1 processo)
// e não existe no app empacotado, então medi-lo inflaria o nosso número.
const ELECTRON_DIRECT = path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
const ELECTRON_BINARY =
  process.env.BENCH_ELECTRON || (fs.existsSync(ELECTRON_DIRECT) ? ELECTRON_DIRECT : path.join(APP_DIR, 'node_modules', '.bin', 'electron'))

// Pastas de cache que não entram no perfil-base (cada rodada começa sem cache).
const CACHE_NAMES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'GrShaderCache',
  'ShaderCache',
  'CacheStorage',
  'cache2',
  'startupCache',
  'shader-cache',
  'jumpListCache',
  'thumbnails',
  'OfflineCache',
  'sessionstore-backups',
  'sessionstore.jsonlz4',
  'sessionCheckpoints.json',
  'zen-sessions.jsonlz4',
  'zen-sessions-backup',
  'WebDriverBiDiServer.json',
  'crashes',
  'minidumps',
  'Crashpad',
  'Sessions',
  'SingletonLock',
  'SingletonSocket',
  'SingletonCookie',
  'lock',
  '.parentlock',
  'parent.lock'
])

function removeCaches(dir, depth = 0) {
  if (!fs.existsSync(dir) || depth > 4) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (CACHE_NAMES.has(entry.name)) {
      fs.rmSync(full, { recursive: true, force: true })
    } else if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeCaches(full, depth + 1)
    }
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch (e) {
    return ''
  }
}

// Página de conteúdo de uma aba (ignora telas internas do navegador e a interface do nosso app).
function isContentUrl(url) {
  if (!/^(https?:|chrome-error:)/.test(url || '')) return false
  return !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(url)
}

const PAGE_INFO = 'JSON.stringify([document.readyState, location.href, document.title])'

// O alvo pode listar a URL da navegação em andamento enquanto o documento ainda é o about:blank inicial
// (que já diz readyState 'complete'). Por isso a URL conta pelo location.href lido dentro da página.
function parsePageInfo(raw, targetUrl) {
  try {
    const [readyState, url, title] = JSON.parse(raw)
    if (!isContentUrl(url)) return { readyState: 'pendente', url: targetUrl, title }
    return { readyState, url, title }
  } catch (e) {
    return { readyState: 'erro', url: targetUrl, title: '' }
  }
}

// Sondagem via Chrome DevTools Protocol (Chrome e Electron).
function createCdpProbe(port, tabs) {
  const session = cdp.createSession(port)
  const firstHost = hostOf(tabs[0])
  let targets = []
  return {
    async pages() {
      const list = await session.listTargets()
      targets = list.filter(target => target.type === 'page' && isContentUrl(target.url))
      return Promise.all(
        targets.map(async target => {
          try {
            const info = parsePageInfo(await session.evaluate(target, PAGE_INFO), target.url)
            return { id: target.id, ...info }
          } catch (e) {
            return { id: target.id, readyState: 'erro', url: target.url, title: target.title }
          }
        })
      )
    },
    async activateFirst() {
      const target = targets.find(item => hostOf(item.url) === firstHost) || targets[0]
      if (!target) return false
      return session.activate(target)
    },
    close: () => session.close()
  }
}

// Sondagem via WebDriver BiDi (Zen/Firefox). Reconecta sozinha enquanto o agente remoto não sobe.
function createBidiProbe(port, tabs) {
  let session = null
  const firstHost = hostOf(tabs[0])
  let contexts = []
  async function ensure() {
    if (session) return session
    const connection = await bidi.connect(port, 4000)
    session = bidi.createSession(connection)
    return session
  }
  return {
    async pages() {
      let current
      try {
        current = await ensure()
        contexts = (await current.topContexts()).filter(context => isContentUrl(context.url))
      } catch (e) {
        if (session) session.close()
        session = null
        throw e
      }
      return Promise.all(
        contexts.map(async context => {
          try {
            const info = parsePageInfo(await current.evaluate(context.context, PAGE_INFO), context.url)
            return { id: context.context, ...info }
          } catch (e) {
            return { id: context.context, readyState: 'erro', url: context.url, title: '' }
          }
        })
      )
    },
    async activateFirst() {
      const context = contexts.find(item => hostOf(item.url) === firstHost) || contexts[0]
      if (!context || !session) return false
      await session.activate(context.context)
      return true
    },
    close: () => {
      if (session) session.close()
    }
  }
}

const ZEN_USER_JS = `// Gerado pela bancada: pula boas-vindas e avisos para a medição ser comparável.
user_pref("zen.welcome-screen.seen", true);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("zen.updates.show-update-notification", false);
// Sem atualização automática: o Zen se atualizou sozinho no meio da bancada (1.21.16b -> 1.23.2b) e a medição mudou de versão.
user_pref("app.update.auto", false);
user_pref("app.update.enabled", false);
user_pref("app.update.staging.enabled", false);
user_pref("app.update.background.enabled", false);
user_pref("zen.mods.auto-update", false);
// Tema claro (o macOS está no escuro): interface e conteúdo das páginas.
user_pref("zen.view.window.scheme", 1);
user_pref("layout.css.prefers-color-scheme.content-override", 1);
user_pref("browser.theme.toolbar-theme", 1);
user_pref("browser.theme.content-theme", 1);
user_pref("ui.systemUsesDarkTheme", 0);
`

const ZEN_XULSTORE = {
  'chrome://browser/content/browser.xhtml': {
    'main-window': { screenX: '0', screenY: '0', width: '1440', height: '900', sizemode: 'normal' }
  }
}

// Preferências do Chrome na cópia do perfil: tema claro (o macOS está no escuro) e sem balão de tradução.
function tweakChromePreferences(profile) {
  const file = path.join(profile, 'Default', 'Preferences')
  const prefs = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  prefs.translate = { ...(prefs.translate || {}), enabled: false }
  prefs.browser = { ...(prefs.browser || {}), theme: { ...((prefs.browser || {}).theme || {}), color_scheme2: 1 } }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(prefs))
}

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true })
}

// Cria o navegador pelo nome: chrome | zen | nosso | nosso-todas
function createBrowser(kind, { work, tabs, tabsFile }) {
  const profileOf = name => path.join(work, `${name}-profile`)
  const baseOf = name => path.join(work, `${name}-base`)

  if (kind === 'chrome') {
    const profile = profileOf('chrome')
    const base = baseOf('chrome')
    const common = dir => [
      `--user-data-dir=${dir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync'
    ]
    return {
      id: 'chrome',
      marker: profile,
      baseMarker: base,
      binary: CHROME_BINARY,
      cwd: undefined,
      expectedPages: tabs.length,
      grace: 0,
      baseExists: () => fs.existsSync(path.join(base, 'Local State')),
      baseArgs: port => [...common(base), `--remote-debugging-port=${port}`, '--window-size=1440,900', '--window-position=0,0', 'about:blank'],
      cleanBase: () => removeCaches(base),
      prepareProfile: () => {
        copyDir(base, profile)
        removeCaches(profile)
        tweakChromePreferences(profile)
      },
      args: (port, urls) => [
        ...common(profile),
        `--remote-debugging-port=${port}`,
        '--window-size=1440,900',
        '--window-position=0,0',
        ...urls
      ],
      makeProbe: port => createCdpProbe(port, tabs),
      version: () => sys.run('defaults', ['read', '/Applications/Google Chrome.app/Contents/Info', 'CFBundleShortVersionString']).then(r => r.stdout.trim())
    }
  }

  if (kind === 'zen') {
    const profile = profileOf('zen')
    const base = baseOf('zen')
    const writeConfig = dir => {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'user.js'), ZEN_USER_JS)
      fs.writeFileSync(path.join(dir, 'xulstore.json'), JSON.stringify(ZEN_XULSTORE))
    }
    return {
      id: 'zen',
      marker: profile,
      baseMarker: base,
      binary: ZEN_BINARY,
      cwd: undefined,
      expectedPages: tabs.length,
      grace: 0,
      baseExists: () => fs.existsSync(path.join(base, 'prefs.js')),
      prepareBaseDir: () => {
        fs.rmSync(base, { recursive: true, force: true })
        writeConfig(base)
      },
      baseArgs: port => ['--profile', base, '--no-remote', `--remote-debugging-port=${port}`, 'about:blank'],
      cleanBase: () => removeCaches(base),
      prepareProfile: () => {
        copyDir(base, profile)
        removeCaches(profile)
        writeConfig(profile)
      },
      args: (port, urls) => ['--profile', profile, '--no-remote', `--remote-debugging-port=${port}`, ...urls],
      argsSemAutomacao: urls => ['--profile', profile, '--no-remote', ...urls],
      makeProbe: port => createBidiProbe(port, tabs),
      version: () => sys.run('defaults', ['read', '/Applications/Zen.app/Contents/Info', 'CFBundleShortVersionString']).then(r => r.stdout.trim())
    }
  }

  if (kind === 'nosso' || kind === 'nosso-todas') {
    const all = kind === 'nosso-todas'
    const profile = profileOf(kind)
    return {
      id: kind,
      marker: profile,
      baseMarker: profile,
      binary: ELECTRON_BINARY,
      cwd: APP_DIR,
      expectedPages: all ? tabs.length : 1,
      grace: all ? 0 : 2000,
      baseExists: () => true,
      cleanBase: () => {},
      prepareProfile: () => {
        fs.rmSync(profile, { recursive: true, force: true })
        fs.mkdirSync(profile, { recursive: true })
      },
      args: port => [
        '.',
        `--abas=${tabsFile}`,
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        '--tema=claro',
        '--janela=0,33,1440,842',
        ...(all ? ['--carregar-todas'] : [])
      ],
      makeProbe: port => createCdpProbe(port, tabs),
      version: async () => {
        const result = await sys.run(ELECTRON_BINARY, ['--version'], { cwd: APP_DIR })
        return `electron ${result.stdout.trim()}`
      }
    }
  }

  throw new Error(`navegador desconhecido: ${kind} (use chrome, zen, nosso ou nosso-todas)`)
}

module.exports = { createBrowser, hostOf, isContentUrl }
