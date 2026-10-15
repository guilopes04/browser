// Lista de namespaces e membros de chrome.* verificados (usada pela sonda e pelo harness)
const APIS_LISTA = {
  action: ['setBadgeText', 'setBadgeBackgroundColor', 'setIcon', 'setTitle', 'setPopup', 'getPopup', 'openPopup', 'onClicked', 'enable', 'disable'],
  alarms: ['create', 'get', 'getAll', 'clear', 'clearAll', 'onAlarm'],
  browsingData: ['remove'],
  clipboard: [],
  commands: ['getAll', 'onCommand'],
  contextMenus: ['create', 'update', 'remove', 'removeAll', 'onClicked'],
  cookies: ['get', 'getAll', 'set', 'remove', 'onChanged'],
  declarativeNetRequest: ['updateDynamicRules', 'getDynamicRules', 'updateEnabledRulesets', 'getEnabledRulesets', 'updateSessionRules'],
  dom: ['openOrClosedShadowRoot'],
  extension: ['getURL', 'getBackgroundPage', 'isAllowedFileSchemeAccess', 'isAllowedIncognitoAccess'],
  fontSettings: [],
  history: ['search'],
  i18n: ['getMessage', 'getUILanguage', 'detectLanguage'],
  identity: ['getAuthToken', 'launchWebAuthFlow'],
  idle: ['queryState', 'setDetectionInterval', 'onStateChanged'],
  management: ['getAll', 'getSelf', 'get', 'onInstalled'],
  notifications: ['create', 'clear', 'getAll', 'onClicked', 'onClosed'],
  offscreen: ['createDocument', 'closeDocument', 'hasDocument'],
  permissions: ['contains', 'request', 'getAll', 'onAdded', 'onRemoved'],
  privacy: [],
  runtime: ['id', 'getURL', 'getManifest', 'sendMessage', 'connect', 'onMessage', 'onConnect', 'onInstalled', 'onStartup', 'getContexts', 'getPlatformInfo', 'reload', 'sendNativeMessage', 'connectNative', 'lastError', 'onSuspend', 'setUninstallURL', 'openOptionsPage'],
  scripting: ['executeScript', 'insertCSS', 'removeCSS', 'registerContentScripts', 'getRegisteredContentScripts', 'unregisterContentScripts', 'updateContentScripts'],
  sessions: ['getRecentlyClosed'],
  sidePanel: ['setOptions', 'setPanelBehavior', 'open', 'getOptions'],
  storage: ['local', 'sync', 'session', 'managed', 'onChanged'],
  system: [],
  tabs: ['query', 'get', 'getCurrent', 'create', 'update', 'remove', 'reload', 'sendMessage', 'executeScript', 'captureVisibleTab', 'duplicate', 'group', 'ungroup', 'move', 'goBack', 'goForward', 'setZoom', 'getZoom', 'detectLanguage', 'onCreated', 'onUpdated', 'onRemoved', 'onActivated', 'onReplaced', 'onHighlighted', 'onMoved'],
  tabGroups: ['query', 'update'],
  topSites: ['get'],
  userScripts: ['register'],
  webNavigation: ['getFrame', 'getAllFrames', 'onBeforeNavigate', 'onCommitted', 'onCompleted', 'onDOMContentLoaded', 'onCreatedNavigationTarget', 'onHistoryStateUpdated'],
  webRequest: ['onBeforeRequest', 'onBeforeSendHeaders', 'onSendHeaders', 'onHeadersReceived', 'onAuthRequired', 'onCompleted', 'onErrorOccurred', 'handlerBehaviorChanged'],
  windows: ['getAll', 'get', 'getCurrent', 'getLastFocused', 'create', 'update', 'remove', 'onCreated', 'onRemoved', 'onFocusChanged', 'onBoundsChanged']
}

if (typeof module !== 'undefined') module.exports = APIS_LISTA
else self.APIS_LISTA = APIS_LISTA
