# Extensões da Chrome Web Store no Electron 44

Medido em 15/10/2026 no MacBook Air M2 (macOS 27 beta), Electron 44.7.2 (Chromium 152.0.7977.149), com o harness em `experiments/extensoes/`. Casos testados: Bitwarden 2026.9.3 (pacote `dist-chrome` oficial da release `browser-v2026.9.3` do GitHub, MV3, `minimum_chrome_version` 134), uBlock Origin Lite 2026.1012.1545 (pacote `chromium.zip` oficial do repositório `uBlockOrigin/uBOL-home`, não o CRX da loja) e uma sonda MV3 mínima escrita para isso (`experiments/extensoes/probe/`).

## Resumo

- `session.extensions.loadExtension()` aceita as três extensões em ~30 ms e dispara `extension-loaded` e `extension-ready`.
- **O Bitwarden puro não funciona.** O service worker morre ao carregar (`chrome.webNavigation` não existe) e a popup fica em spinner para sempre.
- **O uBlock Origin Lite puro também não funciona**, pelo mesmo tipo de causa (`chrome.permissions` não existe). Então o limite é do Electron, não do Bitwarden.
- **Com stubs vazios** para os namespaces ausentes (sem implementar nada de verdade), o service worker do Bitwarden sobe, a popup renderiza a tela de boas-vindas, o botão "Log in" abre o campo de e-mail e a digitação é aceita (capturas abaixo). Ou seja: o que falta é um conjunto finito e conhecido de APIs, mas elas precisam ser implementadas de verdade para autofill, notificações, atalhos e auto-bloqueio funcionarem.
- Não testei login, desbloqueio de cofre nem autofill de verdade (exigiria conta real, fora do escopo).

## O que funciona (medido)

| Área | Resultado |
|---|---|
| `loadExtension` com `allowFileAccess: true` | Carrega; `extension-loaded` e `extension-ready` disparam. O id sai do caminho da pasta (sem `key` no manifest): `ldlmmohhdkimgaaagmkmejnikmkopcgc` para a pasta do repo, outro id em outra pasta. |
| Sessão | Só sessão persistente (a padrão serve; foi preciso `app.setPath('userData', ...)` para usar perfil temporário). `loadExtension` precisa ser chamado a cada boot. |
| Popup como página | `win.loadURL('chrome-extension://<id>/popup/index.html')` numa `BrowserWindow` 380x600 carrega e recebe `chrome.*` (id correto, `runtime.sendMessage` ao service worker funciona). |
| Content scripts | Injetados no mundo isolado, em `http://127.0.0.1` (via CDP: contexto "Bitwarden Password Manager", origem `chrome-extension://<id>`, `chrome.runtime.id` correto; `chrome` ali expõe `dom`, `i18n`, `runtime`, `scripting`, `storage`). |
| `chrome.storage.local` e `.session` | Gravação e leitura corretas. `storage.sync` falha: `"sync" is not available in this instance of Chrome`. |
| `chrome.runtime` | `getManifest`, `getPlatformInfo`, `getContexts`, `sendMessage`/`onMessage` (popup para SW, content para SW, SW para content via `tabs.sendMessage`). |
| `chrome.scripting` | `executeScript` (retornou o título da página) e `registerContentScripts` funcionam. |
| `chrome.declarativeNetRequest` | `updateDynamicRules` funciona **e bloqueia de verdade**: `fetch('/bloquear-dnr')` na página dá `Failed to fetch`, enquanto o controle dá 200. Importante para bloqueadores MV3. |
| `chrome.offscreen` | `createDocument` e `hasDocument` funcionam (o Bitwarden usa para clipboard e crypto). |
| `chrome.tabs.query` | Funciona no SW e na popup, mas lista **todo** `webContents` (inclui a própria popup e documentos offscreen) com `windowId: 0`. |
| Outros que respondem | `i18n.getUILanguage` (`pt-BR`), `idle.queryState` (`active`), `management.getSelf`, `fetch` com `host_permissions`, `action.setBadgeText` / `setIcon` (aceitam a chamada). |

## O que não funciona (medido)

Avisos do Electron ao carregar o Bitwarden (stderr): `Permission 'contextMenus' is unknown.`, `'sidePanel'`, `'webNavigation'`, `'notifications'`, `'privacy'` (na sonda também `'cookies'` e `'commands'`). Permissão desconhecida significa namespace não ligado.

**Namespaces inexistentes (`typeof chrome.X === 'undefined'`) no service worker e na popup:** `windows`, `webNavigation`, `contextMenus`, `notifications`, `commands`, `cookies`, `permissions`, `privacy`, `sidePanel`, `browsingData`, `fontSettings`, `history`, `identity`, `sessions`, `system`, `tabGroups`, `topSites`.

**Membros ausentes em namespaces que existem:**

- `tabs`: `create`, `remove`, `getCurrent`, `executeScript`, `captureVisibleTab`, `duplicate`, `group`, `ungroup`, `move`, `goBack`, `goForward`, `detectLanguage` (ex.: `chrome.tabs.create is not a function`).
- `extension`: `getURL`, `getBackgroundPage`, `isAllowedFileSchemeAccess`, `isAllowedIncognitoAccess`.
- `management`: `getAll`, `get`, `onInstalled`.
- `runtime`: `connectNative`, `sendNativeMessage` (sem native messaging, sem desbloqueio biométrico via app desktop).

**Existem mas não funcionam como deveriam:**

- `chrome.alarms`: `create` e `getAll` funcionam e registram o horário certo, mas **`onAlarm` nunca disparou** (alarmes de 1,2 s, 30 s e 60 s, observados por cerca de 110 s). O Bitwarden agenda tarefas periódicas por alarmes (chave `global_taskScheduler_activeAlarms` no storage), então sincronização e bloqueio automático por tempo dependem disso.
- `chrome.webRequest`: `addListener` aceita até `['blocking']` (o Chrome real lançaria erro em MV3), mas **nenhum evento foi entregue** (nem para requisições da própria página) e `{ cancel: true }` não bloqueou (`fetch('/bloquear-isto')` deu 200).
- `chrome.action`: a API responde, mas `getBadgeText` volta vazio depois de `setBadgeText({ text: '7' })` e não existe nenhuma UI de botão, badge ou popup.

## Erros exatos

Bitwarden puro, service worker (`background.js` linha 2):

```
Uncaught TypeError: Cannot read properties of undefined (reading 'onCommitted')
Service worker registration failed. Status code: 15   (ManifestError)
```

Efeito: sem eventos de service worker, `serviceWorkers.getAllRunning()` vazio, nenhum alvo `service_worker` no CDP. Popup (`popup/polyfills.js`): `TypeError: chrome.tabs.getCurrent is not a function`; depois o log repete "No state version found, assuming empty state" e "Waiting for migrations to finish, waiting for N ms" com N dobrando até passar de 4096 (espera o background rodar migrações). Resultado: `document.body.innerText.length === 0`, só o spinner (`capturas/bitwarden-popup.png`).

uBlock Origin Lite puro (`js/background.js` linha 871, `browser.permissions.onRemoved.addListener`):

```
Uncaught TypeError: Cannot read properties of undefined (reading 'onRemoved')
```

A popup fica só com o ícone de engrenagens de carregamento (`capturas/ublock-popup.png`).

Análise estática: o Bitwarden usa 105 caminhos `chrome.*` distintos (`experiments/extensoes/apis-usadas-bitwarden.json`). Cruzando com o que existe no service worker (medido pela sonda), **41 estão ausentes** (34 em namespaces inexistentes, 7 em membros), listados em `bitwarden-apis-ausentes.json`; na popup, 44 estão indefinidos.

## Experimento com stubs (Bitwarden)

`shim/chrome-stubs.js` define objetos vazios (funções que retornam valores neutros) para `webNavigation`, `windows`, `contextMenus`, `notifications`, `commands`, `permissions`, `privacy`, `sidePanel`, os membros ausentes de `tabs`, `extension.getViews` e `runtime.connectNative`. `montar-bitwarden-shim.sh` injeta isso no começo de `background.js` e na popup. Resultado:

- Service worker registrado e rodando; o storage ganha `global_applicationId_appId`, `global_config_byServer`, `global_taskScheduler_activeAlarms`, `stateVersion`. O SDK WASM carrega em ~74 ms.
- Popup renderiza "Security, prioritized / Create account / Log in" (`capturas/bitwarden-shim-popup-inicial.png`). O harness clica em "Log in", aparece o campo "Email address" e a digitação de um e-mail fictício é aceita (`capturas/bitwarden-shim-popup-digitando.png`, nada foi enviado).
- Único erro no console: `Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.` (mensagem do SW para um receptor ausente, esperado sem a UI real).
- Na página de login local o content script roda, mas o DOM não mudou (sem elementos nem atributos novos). O overlay de autofill depende do cofre desbloqueado e de um service worker com `scripting`/`webNavigation` reais; não foi exercitado.

Conclusão do experimento: a camada de UI e o núcleo do Bitwarden dependem só das APIs ausentes listadas, mas isso não prova que o autofill funcione quando elas forem implementadas.

## O que o navegador precisaria implementar por conta própria

Em ordem do que bloqueia o boot para o que completa a função. Não testei nenhuma das implementações abaixo; é o que a evidência acima aponta.

1. **Namespaces que derrubam o boot:** `webNavigation` (eventos `onCommitted`, `onCompleted`, `onErrorOccurred`, `getAllFrames`, `getFrame`), `permissions` (`contains`, `request`, `onAdded`, `onRemoved`), `windows` (`getAll`, `getCurrent`, `create`, `update`, `remove`, eventos), `tabs.getCurrent/create/remove/executeScript/captureVisibleTab`. Sem isso nem o Bitwarden nem o uBlock Origin Lite iniciam.
2. **Modelo de abas e janelas próprio:** hoje `tabs.query` devolve todo `webContents` com `windowId: 0`. O navegador precisa dizer quais views são abas reais (e de qual janela) e filtrar popups e documentos offscreen.
3. **UI da `chrome.action`:** botão na barra, badge, título, ícone, estado habilitado e hospedagem da popup (janela ou view ancorada no botão, com fechamento ao perder o foco). Hoje só existe a API sem UI.
4. **`chrome.alarms.onAlarm`:** precisa disparar (timer no processo principal acordando o service worker). Sem isso o bloqueio automático e a sincronização do Bitwarden não rodam.
5. **`chrome.commands`:** registrar atalhos (`globalShortcut` ou aceleradores de menu) e entregar `onCommand`, inclusive `_execute_action` (abrir a popup) e o autofill (`Ctrl+Shift+L` no Bitwarden).
6. **`chrome.contextMenus`:** menu de contexto com itens da extensão e `onClicked`.
7. **`chrome.notifications`:** mapear para `Notification` do Electron ou notificações nativas, com botões e `onClicked`.
8. **`chrome.webRequest`:** eventos de observação não chegam e o bloqueio não funciona. O Bitwarden usa `webRequestAuthProvider`/`onAuthRequired` (credencial de HTTP Basic), que seria atendido pelo evento `login` do `app`. Para bloqueio de conteúdo basta o `declarativeNetRequest`, que já funciona.
9. **`chrome.sidePanel`:** só necessário se quiser o painel lateral do Bitwarden (existe `sidepanel-disabled.html` como padrão); pode ficar fora.
10. **Opcionais:** `privacy` (desligar o gerenciador de senhas do navegador), `cookies`, `management.getAll`, `runtime.connectNative` (biometria via app desktop; precisa de native messaging host), `extension.getBackgroundPage`.

Caminhos de implementação possíveis, **não testados aqui**: (a) polyfill JS injetado no service worker via `ses.registerPreloadScript({ type: 'service-worker', ... })` (existe no `electron.d.ts` do 44) e nas páginas da extensão, falando com o processo principal por IPC; (b) avaliar a biblioteca de terceiros `electron-chrome-extensions`, que se propõe a cobrir parte dessas APIs (não verifiquei compatibilidade com Electron 44 nem com MV3 service workers).

## Ressalvas da medição

- Há travamentos intermitentes da thread principal do Electron logo depois do `loadExtension` (a espera chegou a ~56 s antes de seguir), com a máquina sob carga alta de outros processos (load average 5 a 8, WindowServer perto de 50% de CPU). Não consegui separar causa do Electron de carga do sistema. O `webContents.debugger.attach` travou a thread principal em dois casos, por isso o harness usa CDP pelo `remote-debugging-port` (apenas em `127.0.0.1`, durante o teste). O `rodar.sh` tenta até duas vezes.
- uBlock Origin Lite: o teste de regras estáticas foi inconclusivo. Com o service worker caído, `googleads.g.doubleclick.net/pagead/id` não foi bloqueado (`resolveu (opaque)`), e não sei se a URL está nas listas. A tentativa de rodar o uBOL com stubs estourou o limite de tempo duas vezes (thread principal presa por mais de 125 s, possivelmente indexando os rulesets de 9 MB ou pela carga da máquina); não repeti.
- A sonda roda no service worker de uma extensão carregada de pasta (não empacotada); alguns comportamentos de CRX instalado (por exemplo limites mínimos de alarme) podem diferir.
- Chrome 152 real não foi usado como referência nesta rodada; os "deveria" vêm da especificação das APIs.

## Reproduzir

```bash
cd experiments/extensoes
./rodar.sh bitwarden "$PWD/bitwarden"                       # resultado.json + capturas/bitwarden-*.png
WAIT_MS=6000 AGUARDAR_SONDA=40000 ./rodar.sh probe "$PWD/probe" popup.html   # resultado-probe.json
./montar-bitwarden-shim.sh <pasta-temporaria>/bitwarden-shim
./rodar.sh bitwarden-shim <pasta-temporaria>/bitwarden-shim # resultado-bitwarden-shim.json
```

Arquivos: `harness.js` (carrega, abre site de login local em `127.0.0.1:28765` e popup 380x600, espera, captura, grava JSON), `site/index.html`, `probe/` (sonda MV3), `shim/chrome-stubs.js`, `analisar-apis-usadas.js`, `apis-lista.js`, `logs/*-electron.log` (stderr do Chromium com avisos de carregamento), `resultado*.json`, `capturas/*.png`.
