// Dublê do módulo 'electron' para os testes do main: os módulos importam valores dele (dialog,
// Menu, WebContentsView...) mas os testes só exercitam a lógica. Cada teste troca o que precisa.
class Empty {}

export const app = {
  getPath: () => '',
  getName: () => 'Gilas Browser',
  commandLine: { hasSwitch: () => false, appendSwitch() {} }
}
export const BaseWindow = Empty

const noop = () => {}

// sessão de mentira: o que get-space-session e os downloads tocam
export function fakeSession() {
  return {
    getUserAgent: () => 'Mozilla/5.0 Chrome/1 Safari/1',
    setUserAgent: noop,
    setPermissionRequestHandler: noop,
    setPermissionCheckHandler: noop,
    on: noop
  }
}

// WebContentsView de mentira para createTabView: guarda o webContents (ou cria um) e engole o resto
export class WebContentsView {
  constructor(options = {}) {
    this.loaded = []
    this.webContents = options.webContents ?? {
      session: options.webPreferences?.session ?? fakeSession(),
      destroyed: false,
      loadURL: async url => void this.loaded.push(url),
      isDestroyed() {
        return this.destroyed
      },
      getURL: () => '',
      navigationHistory: {
        canGoBack: () => false,
        canGoForward: () => false,
        restore: async () => {}
      },
      on: noop,
      once: noop,
      setAudioMuted: noop,
      setWindowOpenHandler: noop,
      focus: noop,
      close() {
        this.destroyed = true
      }
    }
  }
  setBackgroundColor() {}
  setBorderRadius() {}
  setBounds() {}
  setVisible() {}
}
export const BrowserWindow = Empty
export const nativeTheme = { shouldUseDarkColors: false, on() {} }
export const Menu = {
  buildFromTemplate: items => ({ items, popup() {} }),
  setApplicationMenu() {}
}
export const MenuItem = Empty
export const shell = {
  showItemInFolder() {},
  openPath: async () => '',
  openExternal: async () => {}
}
export const screen = {
  getAllDisplays: () => [],
  getPrimaryDisplay: () => ({})
}
export const session = { fromPartition: () => fakeSession() }
export const net = { fetch: async () => ({}) }
export const nativeImage = { createFromBuffer: () => ({}) }
export const ipcMain = { on() {}, handle() {} }
export const protocol = { handle() {}, registerSchemesAsPrivileged() {} }
export const dialog = {
  showMessageBoxSync: () => 1,
  showSaveDialogSync: () => undefined
}
export const clipboard = { writeText() {}, writeImage() {} }
export default {}
