// Stubs mínimos de chrome.* que o Electron 44 não implementa.
// Objetivo: descobrir até onde o Bitwarden vai quando as APIs ausentes "existem" (sem fazer nada de verdade).
// Não é uma implementação: cada função só retorna um valor neutro.
;(function () {
  const g = globalThis
  if (!g.chrome) return
  const c = g.chrome
  const ev = () => ({ addListener() {}, removeListener() {}, hasListener() { return false }, hasListeners() { return false }, addRules() {}, removeRules() {} })
  const ok = v => async () => v
  const def = (obj, nome, valor) => { try { if (typeof obj[nome] === 'undefined') obj[nome] = valor } catch (e) { console.log('[stubs] não consegui definir ' + nome + ': ' + e) } }
  const log = n => console.log('[stubs] ' + n + ' definido como stub')

  if (!c.webNavigation) { def(c, 'webNavigation', { onCommitted: ev(), onCompleted: ev(), onBeforeNavigate: ev(), onCreatedNavigationTarget: ev(), onErrorOccurred: ev(), onHistoryStateUpdated: ev(), onDOMContentLoaded: ev(), getAllFrames: ok([]), getFrame: ok(null) }); log('webNavigation') }
  if (!c.windows) { def(c, 'windows', { WINDOW_ID_CURRENT: -2, WINDOW_ID_NONE: -1, getAll: ok([{ id: 1, focused: true, type: 'normal' }]), getCurrent: ok({ id: 1, focused: true, type: 'normal' }), getLastFocused: ok({ id: 1, focused: true }), get: ok({ id: 1 }), create: ok({ id: 2 }), update: ok({}), remove: ok(), onCreated: ev(), onRemoved: ev(), onFocusChanged: ev(), onBoundsChanged: ev() }); log('windows') }
  if (!c.contextMenus) { def(c, 'contextMenus', { create() { return 1 }, update() {}, remove(i, cb) { cb && cb() }, removeAll(cb) { cb && cb() }, onClicked: ev() }); log('contextMenus') }
  if (!c.notifications) { def(c, 'notifications', { create() {}, clear() {}, getAll() {}, onClicked: ev(), onClosed: ev(), onButtonClicked: ev() }); log('notifications') }
  if (!c.commands) { def(c, 'commands', { getAll: ok([]), onCommand: ev() }); log('commands') }
  if (!c.permissions) { def(c, 'permissions', { contains: ok(true), request: ok(true), remove: ok(true), getAll: ok({ permissions: [], origins: [] }), onAdded: ev(), onRemoved: ev() }); log('permissions') }
  if (!c.privacy) { const item = { get: ok({ value: false, levelOfControl: 'not_controllable' }), set: ok(), clear: ok(), onChange: ev() }; def(c, 'privacy', { services: { autofillAddressEnabled: item, autofillCreditCardEnabled: item, passwordSavingEnabled: item }, network: {}, websites: {} }); log('privacy') }
  if (!c.sidePanel) { def(c, 'sidePanel', { setOptions: ok(), getOptions: ok({}), setPanelBehavior: ok(), open: ok() }); log('sidePanel') }
  if (c.tabs) {
    def(c.tabs, 'TAB_ID_NONE', -1)
    for (const n of ['getCurrent', 'create', 'remove', 'executeScript', 'captureVisibleTab', 'duplicate', 'group', 'ungroup', 'move', 'goBack', 'goForward', 'detectLanguage']) def(c.tabs, n, ok(undefined))
  }
  if (c.extension) def(c.extension, 'getViews', () => [])
  if (c.runtime) { def(c.runtime, 'connectNative', () => ({ postMessage() {}, disconnect() {}, onMessage: ev(), onDisconnect: ev() })); def(c.runtime, 'sendNativeMessage', ok(undefined)) }
  if (c.management) { def(c.management, 'getAll', ok([])); def(c.management, 'get', ok(undefined)) }
  if (!c.cookies) def(c, 'cookies', { get: ok(null), getAll: ok([]), set: ok(null), remove: ok(null), onChanged: ev() })
})()
