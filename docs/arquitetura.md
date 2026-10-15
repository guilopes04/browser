# Arquitetura técnica do navegador

Decisão de 15/10/2026. Os construtores seguem isto à risca; mudar exige o orquestrador. Base: `design/README.md`, `design/fonte/*.dc.html`, `bench/tabs.json`, `docs/senhas-icloud-evidencia.md` e `app/node_modules/electron/electron.d.ts` (Electron 44.7.2).

## 0. Verificado nesta máquina antes de decidir

- APIs confirmadas no `electron.d.ts` 44.7.2: `BaseWindow` (`contentView`, `setWindowButtonPosition`, `setWindowButtonVisibility`, `setBackgroundColor`, `getMediaSourceId`), `WebContentsView({ webPreferences, webContents })`, `View.addChildView(view, index?)`, `removeChildView`, `setBounds`, `setBorderRadius`, `setBackgroundColor`, `session.fromPartition`, `nativeTheme` (`shouldUseDarkColors`, `themeSource`, evento `updated`), `protocol.handle` + `registerSchemesAsPrivileged`, `webContents.navigationHistory` (`getAllEntries`, `getActiveIndex`, `restore`), `webContents.close`, `setWindowOpenHandler` com `createWindow`, evento `audio-state-changed`, `setAudioMuted`. `BrowserView` está `@deprecated`.
- Experimento (`scratchpad/arquitetura/views-test.js`): uma view "shell" transparente (`setBackgroundColor('#00000000')`) do tamanho da janela, sob a view da aba. Subida com `addChildView(shell)`, o véu de 18% cobre página e sidebar (azul 255 vira 215). Descida com `addChildView(shell, 0)`. Reordenar e renderizar leva de 2 a 40 ms. Na 1ª execução, a captura feita 400 ms depois saiu sem a camada; nas duas seguintes saiu certa. Causa não isolada: todo teste espera 2 `requestAnimationFrame` e confere um pixel.
- Semáforos nativos (macOS 27): o centro do vermelho fica em `trafficLightPosition + (7,1; 6,75)` pt, e os centros ficam a 23 pt um do outro (o design usa 20; vale o nativo). Com a janela sem foco, os semáforos ficam cinza.
- `-webkit-app-region: drag` numa `WebContentsView` dentro da `BaseWindow` move a janela: um arrasto sintético de +150,+80 moveu exatamente isso.
- `footprint -j` lê `phys_footprint` de processos com hardened runtime. O Electron respeita `--user-data-dir`. O macOS deste Mac está em modo **Escuro**: as capturas forçam o tema claro por app, sem mexer no sistema.

## 1. Processos e views

Processos: main (Node, dono de todo o estado), GPU, serviço de rede (um só para todas as partições), **1 renderer da shell** e 1 renderer por aba viva (site isolation padrão). Aba suspensa ou nunca aberta não tem processo.

```
BaseWindow (titleBarStyle 'hidden', fundo nativo = cor do espaço no tema)
└─ contentView
   ├─ shellView  WebContentsView, Preact, preload, bounds = janela inteira, fundo '#00000000'
   └─ tabView    WebContentsView da aba ativa, sem preload, partição do espaço, setBorderRadius(10)
```

Quem desenha o quê:
- **Janela nativa** (`win.setBackgroundColor`): a cor do espaço (`#E8E9F0` no Pessoal claro). É ela que aparece nos 8 px ao redor do painel.
- **shellView na base (índice 0)**: a sidebar (aberta ou compacta); a faixa de arrasto; a sombra e o hairline do painel (uma div no retângulo da página com o `box-shadow` do `Main.dc.html`: `0 0 0 .5px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)`; no escuro, `0 0 0 .5px rgba(255,255,255,.08)`); a tela de Nova aba quando a aba ativa tem `url === ''` (nesse caso não existe tabView); e o gatilho de 8 px da sidebar oculta. O `body` é sempre transparente; só os elementos pintam.
- **tabView**: a página. Só a aba ativa do espaço atual fica na árvore. As outras abas vivas saem com `removeChildView` e continuam rodando (o áudio segue). Proibido deixar views penduradas com `setVisible(false)`.
- **shellView sobreposta**: paleta, revelação da sidebar oculta (peek), dicas do modo compacto e popovers que invadem o painel. O main guarda um conjunto de motivos (`palette | peek | tooltip | popover`): a shell sobe com `addChildView(shell)` quando o conjunto tem algum motivo e desce com `addChildView(shell, 0)` quando ele esvazia. Sobreposta, a shell recebe todos os cliques (o véu fecha a paleta; sair da sidebar flutuante fecha o peek). Ao abrir a paleta, foco em `shell.webContents.focus()`; ao fechar, foco de volta em `tab.webContents.focus()`.
- Uma só view de UI permanente: um renderer a menos (cerca de 30 a 50 MB), nenhum estado sincronizado entre duas UIs, e a paleta cobre a sidebar como no design.
- **findView** (barra de busca, ⌘F): a única exceção, e só enquanto a busca está aberta. A barra é de 397×44 pt no canto do painel e fica **acima da página**, numa `WebContentsView` própria (`find.html`, transparente, do tamanho da barra mais a margem da sombra), criada ao abrir e destruída ao fechar (cerca de 21 MB de footprint medidos com ela aberta, 100 a 160 ms para abrir). Uma shell por cima da página inteira, como a da paleta, levaria todos os cliques; a view pequena deixa a página receber os cliques fora dela, e clicar na página não fecha a barra. A margem transparente da sombra (20 pt dos lados, 12 em cima, 28 embaixo) ficaria com o mouse, porque uma view transparente não deixa o clique passar: a barra repassa o que o mouse faz nela (clicar, arrastar, rolar, passar por cima; `find:pointer`, `use-pass-through.ts`) e o main o entrega à página no mesmo ponto com `sendInputEvent` (`actions/pass-find-pointer.ts`, conversão pura em `to-page-mouse-event.ts`). O estado da busca (texto, "Aa", contador) é do main (`FindSession` em `ctx.find`, com as transições puras em `shared/find-state.ts`); a barra só mostra e devolve o que o usuário digita (`find:*`, seção 3). O destaque dos resultados é do Chromium; `::search-text` o pinta com as cores do design.

Geometria em pt (W×H = conteúdo), calculada pela função pura `main/functions/compute-layout.ts`:

| modo | sidebar (shell) | painel da página | semáforos |
|---|---|---|---|
| aberta | 0,0,260,H | 260,8,W-268,H-16 | `{x:15,y:21}`, centro do vermelho em (22,28) |
| compacta | 0,0,76,H | 76,8,W-84,H-16 | `{x:8,y:21}`, grupo centrado nos 76 |
| oculta | nenhuma | 8,8,W-16,H-16 | `setWindowButtonVisibility(false)` |
| oculta + peek | flutuante em 8,8,260,H-16, raio 12, sombra `0 0 0 .5px rgba(0,0,0,.14), 0 18px 48px rgba(0,0,0,.22)` | igual à oculta | `{x:23,y:29}` |
| tela cheia de vídeo | nenhuma | 0,0,W,H, raio 0 | escondidos |

- Os semáforos se ajustam pela captura: o critério é a posição do centro, não o número.
- Tela cheia de vídeo: `enter-html-full-screen`/`leave-html-full-screen` da aba exibida ligam `state.fullscreen` e refazem o layout (`functions/attach-fullscreen-events.ts`). Com `BaseWindow` o Electron não avisa a página quando a janela sai da tela cheia (botão verde, menu) nem há API para pedir a saída; `functions/exit-video-fullscreen.ts` manda `Esc` à página, que o Electron trata como o navegador faria. Troca, fechamento ou suspensão da aba também saem da tela cheia.
- A sidebar mostrada (`AppSnapshot.effectiveSidebar`) pode diferir da gravada (`window.sidebar`): `computeLayout` põe a aberta em compacta abaixo de 900 pt (`NARROW_WINDOW`), sem gravar; a oculta continua oculta. A shell desenha a compacta ou a aberta conforme `effectiveSidebar`.
- Arrasto: a linha superior da sidebar (y 14–42) e a faixa de 8 px acima do painel usam `-webkit-app-region: drag`; os botões usam `no-drag`. O main não desenha nada.
- `resize` da BaseWindow → `computeLayout` → `setBounds` síncrono na shell e na aba ativa, sem `animate`. Com a janela abaixo de 900 pt, a sidebar vai para compacta sem gravar ("Esconder sozinha em janelas estreitas").
- ⌘S alterna entre `open` e o estilo escondido dos Ajustes (`hidden` com revelação na borda, o padrão, ou `compact`); se o destino não mudaria nada na tela (janela estreita já mostra a compacta), vai para `hidden` (`functions/get-next-sidebar-mode.ts`). Na sidebar oculta, um `mousemove` (não `mouseenter`: o gatilho reaparece sob o ponteiro parado ao fechar e o Chromium dispara uma entrada sintética) no gatilho de 8 px da borda esquerda dispara `shell:raise {reason:'peek', on:true}`. O main sobe a shell e mostra os semáforos em `{x:23,y:29}`; quando o ponteiro fica 250 ms a mais de 16 px da sidebar, com esc, com clique fora, ao perder o foco ou ao trocar o modo da sidebar, `on:false`. A dica do modo compacto usa o motivo `tooltip` do mesmo jeito (350 ms de atraso; a troca de botão é imediata). Com a shell por cima, o painel da página (`.page-panel`) fica transparente para a página aparecer.
- Tema: o main lê `nativeTheme.shouldUseDarkColors` e escuta `updated`. `--tema=claro|escuro|sistema` fixa `nativeTheme.themeSource`; com `--captura` e sem `--tema` o tema é o claro, para a imagem ser comparável com as telas do design. O main pinta a janela; a shell recebe `theme` no snapshot e põe `data-theme` no `<html>`. `tabView.setBackgroundColor` é `#FFFFFF` nos dois temas (`PAGE_CANVAS` em `shared/tokens.ts`): esse valor vira o fundo padrão do documento, então uma cor escura pintaria de cinza toda página sem fundo próprio (decisão da correção do núcleo, 15/10/2026: o Chrome também é branco). Página que aceita o escuro declara `color-scheme` ou `prefers-color-scheme`, e o Chromium já segue o tema do macOS. O `#212126` do escuro continua só nas telas desenhadas pela shell (Nova aba, erro).
- Capturas: `--captura=<png>` fotografa a janela; `--captura-paleta=<png>` (com `--paleta-consulta=<texto>`), `--captura-nova-aba=<png>` e `--captura-busca=<png>` preparam a cena antes. A da busca abre a barra na aba ativa (a primeira de `--abas`) com a consulta `a` (ou `--busca-consulta=<texto>`), espera o contador e fotografa. O e2e da busca é `npm run e2e:find`.
- Segurança: toda view com `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. Só a shell e a barra de busca (`find.html`, também do app) têm preload. A shell é servida por `protocol.handle('app')` (`app://shell/index.html`, lendo só de `out/renderer`, com bloqueio de `..`); em dev, por `ELECTRON_RENDERER_URL`, que só vale fora do app empacotado e só como `http://localhost:<porta>` (`main/functions/resolve-shell-url.ts`); empacotado a shell é sempre `app://shell` (e a barra de busca `app://shell/find.html`) e o IPC compara o remetente com essa constante. Mede-se sempre o build de produção. O endurecimento do processo main está na seção 9.

## 2. Pastas (`app/src`)

Arquivos em kebab-case, um módulo por responsabilidade. Padrão handler + functions adaptado: **ações** do main são funções pequenas, uma por arquivo, que recebem o contexto explicitamente (como o `client` no backend); **functions** são peças reutilizáveis, puras sempre que possível; o IPC é o controller fino.

```
src/
  shared/                     importado por main e renderer; sem Electron nem DOM
    types.ts                  Space, Tab, WindowState, AppSnapshot, Settings, SessionFile
    ipc.ts                    contrato IPC (seção 3)
    tokens.ts                 cores por espaço×tema (renderVals do Sidebar.dc.html), medidas 260/76/8/10
    shortcuts.ts              lista fechada de atalhos (seção 4)
    commands.ts               CommandId → rótulo, atalho, implementado
    resolve-input.ts          texto digitado → URL ou busca (puro)
    match-palette.ts          ranking da paleta (puro)
    early-key.ts              teclas repassadas pelo main enquanto a paleta ou a Nova aba abrem (puro)
    url-key.ts                chave de endereço (host sem caixa, sem esquema, www, âncora nem barra final)
    find-state.ts  find-request.ts  find-early-key.ts  find-selection.ts  find-pointer.ts
                              busca na página: estado e contador, pedido ao Chromium, teclas da abertura, seleção,
                              mouse na margem da barra (puros)
  main/
    index.ts                  bootstrap: flags, protocolo, menu, janela, timers
    context.ts                interface MainContext { store, views, win, shell, flags }
    flags.ts                  --carregar-todas, --suspender-apos, --tema, --abas, --janela
    actions/                  uma ação por arquivo: (ctx, payload) => void
      index.ts  activate-tab.ts  create-tab.ts  close-tab.ts  reopen-tab.ts  navigate-tab.ts
      go-back.ts  go-forward.ts  reload-tab.ts  set-tab-muted.ts  suspend-tab.ts  wake-tab.ts
      move-tab.ts  move-tab-to-space.ts  switch-space.ts  toggle-sidebar.ts  set-overlay.ts
      open-palette.ts  close-palette.ts  query-palette.ts  run-command.ts  show-tab-menu.ts
    functions/
      index.ts  create-tab-view.ts  attach-tab-events.ts  compute-layout.ts  apply-layout.ts
      window-background.ts  get-space-session.ts  get-partition-name.ts  clean-user-agent.ts
      favicon-to-data-url.ts  favicon-cache.ts  sniff-raw-image.ts  stash-navigation.ts
      attach-fullscreen-events.ts  exit-video-fullscreen.ts  sync-shell-order.ts  get-next-sidebar-mode.ts
      handle-early-shortcut.ts  forward-early-key.ts  key-gate.ts
                              ⌘K ⌘L ⌘T na entrada da tecla (antes do menu) e o portão de teclas (seção 3)
    store/
      app-store.ts            estado em memória + emissor de mudanças (único dono)
      session-path.ts  read-session-file.ts  serialize-session.ts  hydrate-tab.ts
      write-atomic.ts  is-persisted-change.ts  session-writer.ts
                              userData/session.json: atômico, debounce 1 s, só grava quando algo que o
                              arquivo guarda mudou e o conteúdo é diferente do último gravado
      history-store.ts        histórico por espaço (memória + userData/history.jsonl, 20 mil entradas no total)
      load-history.ts  migrate-legacy-history.ts  warm-search-text.ts  space-history.ts  parse-history.ts
                              leitura (com o formato antigo por baixo), migração, texto normalizado em fatias
    services/
      suspension-timer.ts  theme-watcher.ts  app-menu.ts  app-protocol.ts
    ipc/
      register-ipc.ts         canal → valida payload → ação
      broadcast.ts            snapshot e patches coalescidos para a shell
  preload/
    index.ts                  contextBridge: send/invoke/on só com canais de shared/ipc.ts
  renderer/
    index.html  main.tsx  app.tsx
    state.ts                  signals que espelham o main (sem lógica de negócio)
    palette-state.ts  new-tab-state.ts   texto digitado da paleta e da Nova aba (inclui o que chega pelo portão)
    api.ts                    wrapper tipado de window.api
    styles/ tokens.css  base.css
    components/
      sidebar/  index.tsx top-bar.tsx space-switcher.tsx address-field.tsx essentials-grid.tsx
                tab-list.tsx tab-row.tsx footer.tsx
      compact-sidebar/  index.tsx  compact-tab.tsx  tooltip.tsx
      palette/  index.tsx  palette-input.tsx  palette-section.tsx  palette-row.tsx  use-palette-keys.ts
      new-tab/  index.tsx
      icons/    index.tsx  (SVGs copiados do design)
      find-bar/ index.tsx icons.tsx use-pass-through.ts  (a barra de busca; entra por find.html e find-main.tsx, com find-state.ts)
```

Usa os padrões do electron-vite (`src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`). Para o JSX, `tsconfig` com `"jsx": "react-jsx"` e `"jsxImportSource": "preact"`, sem plugin extra. As funções puras e o main sem Electron têm teste em `app/test/*.test.ts`; os módulos da shell (estado da paleta, teclas, Nova aba), com `window.api` de mentira, em `app/test-web/*.test.ts` (`npm test`, `node --test --experimental-strip-types`). Os testes de ponta a ponta ficam em `app/e2e/` (`npm run build` antes; `npm run e2e:palette`, `e2e:new-tab`, `e2e:migration`): sobem o app de verdade, mandam teclas e cliques reais (System Events e CGEvent, com o Electron na frente e acessibilidade liberada para o terminal), leem o estado por CDP e `--inspect`, e guardam perfis e resultados em `E2E_OUT` (padrão: pasta temporária).

## 3. Estado e contrato IPC

```ts
// shared/types.ts
export type SpaceId = string                       // padrão: 'personal', 'work'
export type TabId = string
export type Theme = 'light' | 'dark'
export type SidebarMode = 'open' | 'compact' | 'hidden'
export type SpaceColor = 'indigo' | 'amber'        // tokens.ts: accent e bg por tema
export type OverlayReason = 'palette' | 'peek' | 'tooltip' | 'popover' | 'notice'   // notice: aviso de tela cheia, só o main liga
export type PaletteMode = 'search' | 'address'     // ⌘K | ⌘L
export interface Rect { x: number; y: number; width: number; height: number }
export interface Favorite { id: string; title: string; url: string; favicon: string | null; essential: boolean }
export interface Space { id: SpaceId; name: string; color: SpaceColor; favorites: Favorite[] }
export interface Tab {
  id: TabId; spaceId: SpaceId
  url: string                 // '' = Nova aba, desenhada pela shell, sem webContents
  title: string
  favicon: string | null      // data URL PNG de 32 px; null → letra + cor
  audible: boolean; muted: boolean; dormant: boolean
  lastActiveAt: number        // epoch ms
  loading: boolean; canGoBack: boolean; canGoForward: boolean   // só em memória
  error: { code: number; description: string } | null           // só em memória: a shell desenha a página de erro
}
export interface WindowState {
  spaceId: SpaceId; activeTabBySpace: Record<SpaceId, TabId | null>
  sidebar: SidebarMode; bounds: Rect
}
export interface Settings {
  suspendAfterSec: number     // 1800; 0 = nunca
  neverSuspendAudible: boolean; hiddenSidebarStyle: 'hidden' | 'compact'; searchUrl: string
}
export interface AppSnapshot {
  theme: Theme; spaces: Space[]
  tabs: Tab[]                 // todos os espaços, na ordem da sidebar
  window: WindowState; settings: Settings; overlay: OverlayReason[]; fullscreen: boolean
  effectiveSidebar: SidebarMode   // o que a janela mostra (a aberta vira compacta abaixo de 900 pt)
}
export interface SessionFile {  // userData/session.json
  version: 1; spaces: Space[]; window: WindowState; settings: Settings
  tabs: Pick<Tab, 'id' | 'spaceId' | 'url' | 'title' | 'favicon' | 'muted' | 'lastActiveAt'>[]
  closed: Pick<Tab, 'spaceId' | 'url' | 'title'>[]   // pilha do ⇧⌘T, máximo 20
}
export type PaletteItem =
  | { kind: 'tab'; tabId: TabId; spaceId: SpaceId; title: string; url: string; favicon: string | null }
  | { kind: 'favorite'; spaceId: SpaceId; title: string; url: string; favicon: string | null }
  | { kind: 'history'; spaceId: SpaceId; title: string; url: string; visitedAt: number }
  | { kind: 'action'; command: CommandId; keys: string }
  | { kind: 'open-url'; url: string }       // ⌘↵
  | { kind: 'web-search'; text: string }    // ⌥↵
export interface PaletteSection { id: 'recent' | 'tabs' | 'favorites' | 'history' | 'actions'; items: PaletteItem[] }
```

```ts
// shared/ipc.ts — único contrato entre shell e main
export interface Commands {        // shell → main: ipcRenderer.send / ipcMain.on
  'tab:activate': { tabId: TabId }                     // acorda se dormente; troca de espaço se preciso
  'tab:create': { spaceId?: SpaceId; url?: string; background?: boolean }  // sem url = Nova aba, no topo
  'tab:close': { tabId: TabId }
  'tab:reopen': {}
  'tab:navigate': { tabId: TabId; input: string }      // texto cru; main resolve URL ou busca
  'tab:back': {}
  'tab:forward': {}
  'tab:reload': {}                                     // sempre na aba ativa
  'tab:set-muted': { tabId: TabId; muted: boolean }
  'tab:suspend': { tabId: TabId }
  'tab:move': { tabId: TabId; toIndex: number }
  'tab:move-to-space': { tabId: TabId; spaceId: SpaceId }  // recria na partição nova e recarrega
  'tab:context-menu': { tabId: TabId }                 // Menu nativo (MenuAba) nesta fase
  'space:switch': { spaceId: SpaceId }
  'sidebar:toggle': {}
  'shell:raise': { reason: Exclude<OverlayReason, 'palette'>; on: boolean }
  'palette:open': { mode: PaletteMode }
  'palette:close': {}
  'keys:ready': { target: KeyGateTarget }              // o campo já está na tela e com o foco: fim do repasse
  'command:run': { command: CommandId }
  'system:open-network-settings': {}                   // botão da página de erro sem conexão
  // só a barra de busca (find.html) manda estes; o main confere o remetente
  'find:ready': {}  'find:text': { text: string }  'find:step': { forward: boolean }
  'find:case': { matchCase: boolean }  'find:close': {}
  'find:pointer': FindPointer                          // mouse na margem da sombra da barra: vai para a página
}
export interface Requests {        // shell → main com resposta: invoke / handle
  'state:get': { req: {}; res: AppSnapshot }
  'palette:query': { req: { text: string; scope: 'all' | SpaceId }; res: PaletteSection[] }
}
export interface Events {          // main → shell: webContents.send / ipcRenderer.on
  'state:snapshot': AppSnapshot                          // estrutura, tema, espaço, sidebar, overlay
  'state:tab': { tabId: TabId; patch: Partial<Tab> }     // título, favicon, url, áudio, loading, nav
  'address:focus': {}                                    // ⌘L numa Nova aba: a shell foca o campo dela
  'palette:show': { mode: PaletteMode; text: string; sections: PaletteSection[] }  // já traz as seções; no modo address, text = URL atual selecionada
  'palette:hide': {}
  'keys:early': { target: KeyGateTarget; key: EarlyKey } // tecla digitada enquanto a paleta ou a Nova aba abria
  'find:state': FindViewState                            // para a barra de busca: texto, contador "N de M", "Aa", tema
}
export type KeyGateTarget = { kind: 'palette' } | { kind: 'new-tab'; tabId: TabId } | { kind: 'find' }
export const COMMAND_CHANNELS = [/* todas as chaves de Commands */] as const
export const REQUEST_CHANNELS = ['state:get', 'palette:query'] as const
export const EVENT_CHANNELS = ['state:snapshot', 'state:tab', 'address:focus', 'palette:show', 'palette:hide', 'keys:early', 'find:state'] as const
```

Regras:
- O main é a única fonte da verdade. A shell espelha o estado em signals e guarda localmente só hover, foco e o texto da paleta. Ao carregar, ela chama `state:get`; depois só ouve.
- `state:snapshot` sai no máximo uma vez por tick (coalescido com `setImmediate`); `state:tab` sai por aba, coalescido a cada 50 ms. Os favicons vão como data URL (o main baixa com `session.fetch` da partição e redimensiona com `nativeImage` para 32 px; ICO e SVG ficam com letra e cor).
- Teclas na abertura da paleta e da Nova aba (portão de teclas). Todos os atalhos da tabela (seção 4) são tratados no `before-input-event` da shell, da barra de busca e de cada aba (`functions/handle-early-shortcut.ts`, que casa a tecla com `shared/shortcuts.ts` por `shared/match-shortcut.ts` e dá `preventDefault` no keyDown e no keyUp; `docs/paginas-hostis.md`), e não pelo accelerator do menu: o accelerator só dispara depois de a página devolver a tecla como não tratada, e nessa ida e volta as teclas digitadas em seguida caíam na página (num chat, o ↵ enviaria a mensagem) e a página ainda via o próprio ⌘T. O menu continua com os accelerators (para mostrar o atalho e para as views sem o gancho). Aberta a paleta ou ativada uma Nova aba, o main abre o portão (`functions/key-gate.ts`, `ctx.keyGate`): até a shell avisar `keys:ready` (o campo já está na tela e com o foco) mais 100 ms, no máximo 600 ms, cada tecla que a shell trata (`shared/early-key.ts`: caracteres, ↵, esc, ⇥, Backspace, ↑↓) é consumida no main e repassada por `keys:early`, que mantém a ordem com `palette:show` e o snapshot. Como `keys:early` pode chegar antes do snapshot que traz a Nova aba, leva o `tabId`, e o texto espera em `new-tab-state.ts`. ←, →, Delete, Home, End, PageUp e PageDown são descartados no portão (o texto repassado não tem cursor); atalhos com ⌘ ou ⌃, modificadores e soltar de tecla seguem o caminho normal; tecla morta e IME fecham o portão. ⌘T segurado cria uma aba só.
- Buscar na página (⌘F). `actions/open-find.ts` cria `ctx.find` (aba, view, `FindState`), põe a `findView` acima da página (`layout-find.ts` a mantém no canto do painel em todo `applyLayout`), abre o portão de teclas com o alvo `find` e dá o foco a ela. Diferente da paleta e da Nova aba, as teclas do portão da busca não vão à shell: `forward-early-key.ts` as aplica direto no estado da busca (`shared/find-early-key.ts`: caracteres e Backspace editam o texto, ↵ e ⇧↵ andam, esc fecha) e a busca já roda antes de a barra existir; a barra, ao nascer, avisa `find:ready` e recebe o texto. ⌘F, ⌘G e ⇧⌘G entram sozinhos nessa tabela (tratados no `before-input-event` da página, da shell e da barra, como ⌘K); segurar ⌘G ou ⇧⌘G segue andando pelos resultados, e o menu Editar mostra os atalhos. Detalhes que custaram medida: (1) `findNext` do Electron é "começar sessão nova" (true abre a sessão; false só segue uma sessão viva, e sem sessão o Chromium nem responde): `shared/find-request.ts` usa true ao digitar, ao trocar o "Aa" e quando não há sessão viva, e false para ↵ e ⌘G; (2) o `found-in-page` só chega no resultado final, e consultas curtas (1 a 3 caracteres medidos) demoram cerca de 400 ms para responder, e o contador espera; respostas de pedidos velhos são descartadas pelo id; (3) o primeiro resultado de uma busca pode vir como "0 de 0" transitório, corrigido pela resposta seguinte; (4) sem diferenciar maiúsculas a busca também ignora acentos ("cafe" acha "café"); com "Aa" ligado, não; (5) o destaque do design vem de `::search-text` e `::search-text:current` (CSS inserido na página enquanto a busca está aberta, removido ao fechar); o raio e o halo de 2 px do design não existem para esse pseudo-elemento. A barra fecha e limpa os destaques (`stopFindInPage('clearSelection')`) com esc, com o botão ×, ao tirar a página da janela (`hideTabView`: trocar de aba ou de espaço, fechar a aba, abrir Nova aba), ao entrar em tela cheia de vídeo e se o renderer dela cair. Navegar na aba com a barra aberta não a fecha: a busca recomeça na página nova quando ela termina de carregar (`attach-find-events.ts`). Duas armadilhas nisso, medidas: o CSS inserido vale só para o documento em que entrou, então entra de novo a cada `did-navigate` (`apply-find-highlight.ts`; sem isso a página nova, e a aba que acordou pelo ⌘F, voltavam às cores do Chromium); e o Chromium guarda o destaque ativo da sessão anterior mesmo depois de a página ir embora, e uma sessão nova com o mesmo texto começa depois dele ("2 de 3" numa página recém-carregada), então a busca de página nova (`reload` em `find-request.ts`) encerra a sessão anterior antes. A página de erro (da shell) fecha a barra. ⌘F com a paleta aberta fecha a paleta. O portão de teclas da busca vai até 2 s (a barra é um renderer novo a cada ⌘F, e o que se digita fica no main de qualquer jeito). A aba dormente acorda antes (`activate-tab`, chamado por `open-find` se a aba ativa não está na janela). O "Aa" fica para a próxima busca; o texto, não. Limite conhecido: os atalhos que só existem no menu (⌘1 a ⌘9, ⌘W, ⌘S) chegam depois de a página devolver a tecla; um ⌘F colado neles, sem pausa, vale para a aba antiga e a barra fecha quando a troca chega.
- O preload confere o canal contra as listas acima e nada mais. `register-ipc.ts` aceita só mensagens vindas de `shell.webContents`, valida o payload (tipos e ids existentes) e chama a ação. Nada de `sendSync`.
- Persistência: o store marca sujo e grava `session.json` 1 s depois, atômico (`.tmp` + `rename`), e de forma síncrona no `before-quit`. Na leitura, toda aba volta com `dormant: true`, `audible: false` e `loading: false`. Sem o arquivo: espaços Pessoal (`indigo`) e Trabalho (`amber`), cada um com uma Nova aba.
- Página de erro: é da shell, como a Nova aba. O `did-fail-load` do frame principal (exceto `ERR_ABORTED` e o recuo http) grava `Tab.error` e esconde a view da página (`view.setVisible(false)` em `applyLayout`); o `did-navigate`, que o documento de erro do Chromium não dispara, limpa o erro e mostra a view de novo. A entrada de histórico segue sendo o endereço que falhou, então ⌘R, voltar e avançar funcionam sem tratamento. Sem conexão (`ERR_INTERNET_DISCONNECTED`) a shell recarrega a aba no evento `online` e oferece "Abrir ajustes de rede do Mac".
- Histórico: registrado no `did-navigate` do frame principal em `history-store.ts`. Cada espaço tem o seu, mas o limite é de 20 mil entradas no total (a visita mais antiga de qualquer espaço sai primeiro): fica tudo na memória, com o texto normalizado de cada entrada, e o custo medido é de cerca de 0,4 KB por entrada, cerca de 8 MB de heap no limite. Append em `userData/history.jsonl` com `{spaceId, url, title, visitedAt}` (e linhas só de título `{spaceId, url, title}`), reescrito por inteiro quando sobram mais de 5 mil linhas antigas. O arquivo é lido depois da abertura (3 s, ou na primeira consulta da paleta) mas sempre antes da primeira gravação, para um append não criá-lo por cima do formato antigo. O formato antigo (`history-<espaço>.json`) é migrado sempre que existir (entra por baixo do `history.jsonl`, que é reescrito; o antigo ganha `.migrado`). A mesma página é uma entrada só (`shared/url-key.ts`: sem esquema, `www`, âncora comum nem barra final; só o host perde a caixa, porque no caminho e na consulta ela muda a página). A busca por substring sem acento em título e URL leva no máximo 10 ms.
- Espaços: `get-space-session.ts` faz `session.fromPartition('persist:space-<id>')` e configura cada sessão uma vez: user agent sem os tokens `Electron/` e do app (`app.userAgentFallback` limpo no bootstrap e `setUserAgent` por sessão; o token do app é o que fica entre `Gecko)` e `Chrome/`, em `functions/clean-user-agent.ts`); `setPermissionRequestHandler` negando tudo, exceto `fullscreen`, `clipboard-sanitized-write` e `pointerLock`, até a peça de Permissão existir (o padrão do Electron concede tudo). `setWindowOpenHandler` vira aba no mesmo espaço via `createWindow` (adota `options.webContents` numa WebContentsView nova, o que preserva o `opener` dos popups OAuth).

## 4. Atalhos (lista fechada)

Todos via `Menu.setApplicationMenu` (`services/app-menu.ts`), gerados de `shared/shortcuts.ts`. Accelerators de menu valem com o foco em qualquer view, inclusive dentro da página, mas só disparam depois de a página devolver a tecla; por isso todos os atalhos da tabela também são tratados antes, no `before-input-event` (seção 3). Atalho só é registrado quando o recurso existe.

| Atalho | Ação | Fase |
|---|---|---|
| ⌘K | paleta (alterna) | agora |
| ⌘L | paleta no modo endereço, com a URL atual selecionada; ↵ navega na aba | agora |
| ⌘T | Nova aba no topo da lista do espaço | agora |
| ⌘W | fecha a aba; se era a última do espaço, abre Nova aba; nunca fecha a janela | agora |
| ⇧⌘T | reabre a última aba fechada | agora |
| ⌘1…⌘8, ⌘9 | n-ésima aba do espaço; ⌘9 = a última | agora |
| ⌃⇥ / ⌃⇧⇥ | próxima / anterior na ordem da sidebar | agora |
| ⌘[ ⌘] ⌘R | voltar, avançar, recarregar | agora |
| ⌘S | mostra ou oculta a sidebar | agora |
| ⌃1 ⌃2 (…⌃9) | ir para o espaço n | agora |
| ⌘+ ⌘− ⌘0 | zoom da página | agora |
| esc | fecha a paleta (tratado na shell) | agora |
| ⌘C ⌘V ⌘X ⌘A ⌘Z ⇧⌘Z, ⌘Q ⌘H ⌘M | menus Editar e app com `role` (sem eles, copiar e colar não funcionam no macOS). O Editar é montado com os papéis e termina em Buscar na Página… ⌘F, Buscar Próximo ⌘G e Buscar Anterior ⇧⌘G | agora |
| ⌥⌘I | DevTools da aba (só com `--dev`) | agora |
| ⌘F | buscar na página: abre a barra com o foco no campo, pré-preenchida com o texto selecionado na página; de novo, foca e seleciona. Na Nova aba e na página de erro não há o que buscar | agora |
| ⌘G ⇧⌘G, ↵ ⇧↵ | resultado seguinte e anterior (↵ ⇧↵ na barra); ⌘G sem a barra a abre | agora |
| esc | com a busca aberta, fecha a barra e limpa os destaques (na barra e na página) | agora |
| ⇧⌘C ⌥⌘S ⇧⌘R ⌃⌘N ⇧⌘N ⌘, | URL limpa, captura, leitura, split, anônima, Ajustes | quando o recurso existir |

Conflitos aceitos: ⌘S (salvar página), ⌘K (sites como Slack e Linear) e ⇧⌘R (recarregar forçado) ficam com o navegador.

## 5. Suspensão e carregamento preguiçoso

- Estados: Nova aba (`url ''`, sem view) → viva (tem view) ⇄ dormente (sem view nem processo).
- Na abertura, só a aba ativa do espaço atual ganha view e `loadURL`, em paralelo com o carregamento da shell; a janela aparece no primeiro paint da shell. Todas as outras abas ficam dormentes, inclusive as ativas de outros espaços. Nada de rede na abertura além dessa aba.
- `--carregar-todas` cria e carrega todas as abas de todos os espaços (a ativa primeiro), para medir o caso justo.
- Timer (`services/suspension-timer.ts`) a cada `min(60 s, suspendAfter/2)`. Uma aba é suspensa quando: está viva; não é a ativa do espaço exibido; `audible` é falso (vale também para aba muda que segue emitindo áudio); não está em tela cheia; e `now − lastActiveAt ≥ suspendAfter`. `lastActiveAt` atualiza ao ativar, ao desativar e a cada tick enquanto há áudio.
- `--suspender-apos=<segundos>` vale só nesta execução e tem prioridade sobre `settings.suspendAfterSec` (padrão 1800; `0` desliga), mas nunca é gravado no `session.json`. Número puro é segundo (`=5` são 5 s); aceita sufixos `ms`, `s` e `min` (`=500ms`, `=2min`). `=5000` são 5000 s, não 5 s. O menu da aba tem "Suspender aba" (`tab:suspend`).
- Suspender (`actions/suspend-tab.ts`): guarda `{entries: navigationHistory.getAllEntries(), index: getActiveIndex()}` num Map em memória; `removeChildView`; `webContents.close()`; tira do registro; patch `{dormant: true, loading: false, audible: false}`.
- Acordar (`actions/wake-tab.ts`, chamado por `activate-tab`): cria a view na partição do espaço; se há stash, `navigationHistory.restore({entries, index})`, que devolve voltar/avançar e rolagem; senão, `loadURL(url)`.
- Aparência, conforme `Sidebar.dc.html`:
  - Aba suspensa: lua de 12 px (path do design, traço 1.6, cor `sec`) num slot de 26×26 à direita, `title="Suspensa para liberar memória"`, `aria-label="Suspensa"`; título em `sec` com peso 400; favicon ou letra com opacidade 0.45. No compacto, opacidade 0.4 e `aria-label "<título> (suspensa)"`.
  - O slot da direita mostra áudio (alto-falante em `accent`, clique silencia) antes da lua; aba muda mostra o alto-falante cortado em `sec`. O × aparece só na ativa, e a ativa nunca é dormente.
  - Aba que nunca carregou e não tem título salvo mostra o hostname, a 1ª letra dele e uma cor do tile por hash dentre `#4352C4 #3D4452 #B03A63 #6A4FB3 #A35A06 #2F7D5B`.

## 6. Protocolo de medição (bancada)

Scripts em `bench/` (TypeScript via `node --experimental-strip-types`), resultados em `bench/results/<data>/`.

1. **Alvos e linha de comando** (binário direto, nunca `open -a`; perfil novo em `SCRATCH/bench/<alvo>-profile`):
   - Chrome: `".../Google Chrome" --user-data-dir=P --no-first-run --no-default-browser-check --remote-debugging-port=9223 --window-position=0,0 --window-size=1440,900 <10 URLs>`.
   - Nosso (build de produção, `npm run build` antes): `app/node_modules/.bin/electron app --user-data-dir=P --remote-debugging-port=9224 --abas=../bench/tabs.json --janela=0,0,1440,900 [--carregar-todas]`. `--abas` não lê nem grava o `session.json` (a sessão é de uso único, o arquivo do usuário fica intacto) e põe as 10 abas no Pessoal, com a primeira ativa. Sem `--user-data-dir`, `userData` e `sessionData` vão para uma pasta temporária (`services/temp-profile.ts`, apagada na saída e varrida na próxima execução se sobrar), para os cookies e o cache das partições não irem para o perfil real.
   - Zen: `/Applications/Zen.app/Contents/MacOS/zen --profile P --no-remote --remote-debugging-port=9225 <10 URLs>`, com `user.js` no perfil: `browser.startup.page=0`, `browser.shell.checkDefaultBrowser=false`, `browser.aboutwelcome.enabled=false`, `datareporting.policy.dataSubmissionPolicyBypassNotification=true`, e as prefs de boas-vindas do Zen que aparecerem no primeiro uso (conferir no `about:config` do perfil temporário).
2. **Rodadas**: uma rodada de aquecimento por alvo (descartada; aquece o cache em disco igual para todos) e depois 3 rodadas medidas, intercaladas (Chrome, Zen, nosso padrão, nosso justo; ×3). Antes de cada rodada: nenhum processo do alvo vivo (`pkill -f P` e conferir com `ps`), e soma de `%CPU` do sistema abaixo de 20% por 5 s. Janela na frente e sem nada cobrindo (o Chromium pausa a pintura de janela coberta).
3. **Tempo de abertura**: `t0` logo antes do `spawn`. Chrome e nosso: a cada 100 ms, `GET http://127.0.0.1:<porta>/json/list` e, para cada alvo `type: page` (excluindo `app://`, `chrome://`, `devtools://`), `Runtime.evaluate("document.readyState")` pelo WebSocket. Fim quando há 10 páginas `complete`. No modo padrão do nosso, fim quando a aba ativa está `complete` e as 10 estão na sidebar (`state:get`), registrado como modo `padrao`. Zen: WebDriver BiDi em `ws://127.0.0.1:9225/session` (`session.new`, `browsingContext.getTree`, `script.evaluate` por contexto). Se o BiDi falhar, o fim é o primeiro instante em que a soma de `%CPU` da árvore fica abaixo de 5% por 2 s seguidos, com o método registrado. Limite de 90 s: passou disso, a rodada é marcada "estourou".
4. **RAM**: 30 s depois do fim, sem interação, os PIDs são a árvore a partir do PID inicial (`ps -axo pid=,ppid=`, busca em largura) somada aos processos com `P` na linha de comando. A RAM é a soma de `phys_footprint` de `footprint -j saida.json -p <pid> ...`, em MiB. Também registra a soma de `rss` (`ps -o rss=`) como alternativa.
5. **Saída**: JSON por rodada (`alvo, modo, rodada, tempoMs, ramMiB, rssMiB, nProcessos, metodo`) e mediana das 3, publicada com `node progress/update.js ref <chrome|zen|nosso> '{"ram":…, "tempo":…, "nota":"modo justo; padrão: …"}'`. No fim, mata tudo (`pkill -f SCRATCH/bench`) e confere com `ps`.
6. **Captura para o crítico cego**: uma execução separada, sem portas de depuração (com o agente remoto ligado, o Zen pinta a barra listrada).
   - Janela de 1440×900 em (0,0), posição e tamanho aplicados por `osascript` (System Events) nos dois apps e conferidos com `bench/winlist` (o y real fica logo abaixo da barra de menus).
   - Tema claro forçado por app: o nosso com `--tema=claro --carregar-todas`; o Zen com `ui.systemUsesDarkTheme=0`, `browser.theme.toolbar-theme=1`, `browser.theme.content-theme=1` e `layout.css.prefers-color-scheme.content-override=1`.
   - Aba ativa: a primeira de `tabs.json` (no Zen, ⌘1 por System Events).
   - Espera: tudo carregado + 5 s. Janela em primeiro plano (`set frontmost`), para os semáforos ficarem coloridos. Cursor fora da janela, em (1465,950), com `CGWarpMouseCursorPosition`.
   - Captura: `screencapture -x -o -l <id> A.png` (2880×1800). Os nomes são sorteados como A/B; o mapa fica num arquivo que o crítico não lê.

## 7. Peças do loop construtor/crítico

| id | nome | critério de vitória |
|---|---|---|
| janela | Janela, moldura e painel da página | Captura 1440×900 claro: sem barra de título; centro do semáforo vermelho em (22,28) ±1 pt; fundo `#E8E9F0` nos 8 px ao redor; painel em 260,8 até W-8,H-8 com raio 10 limpo e hairline; a janela arrasta pela faixa de cima; o redimensionamento mantém os recuos sem tremor; vídeo em tela cheia ocupa a janela; a troca de tema do macOS aparece em menos de 200 ms sem recarregar. O crítico cego prefere a nossa moldura à do Zen. |
| sidebar | Sidebar: espaço, endereço, favoritos | Medidas do `Sidebar.dc.html` ±1 px na captura (linha de 28 px, seletor de espaço 13/600 com o ponto em accent, campo de endereço de 36 px com raio 10 e domínio 600 + caminho em sec com reticências, essenciais 4×44 px, hairline, rodapé); avançar desabilitado em `iconOff`; claro e escuro; ⌘S alterna; o modo oculto revela pela borda com a sombra do design; compacta com 76 px. O crítico cego prefere a nossa sidebar à do Zen. |
| abas | Lista de abas, aba ativa e suspensas | Com as 10 abas de `tabs.json`: linhas de 34 px com gap de 2, favicon de 18 px, título 13 px com reticências; ativa com fundo e sombra do token, peso 600 e ×; áudio em accent e clicável; suspensa com lua, sec e 0.45; título e favicon atualizam até 1 frame depois do evento; ⌘T ⌘W ⇧⌘T ⌘1–9 ⌃⇥ funcionam. O crítico cego prefere a nossa lista à do Zen. |
| paleta | ⌘K: paleta de abas e ações | Do ⌘K ao primeiro frame em menos de 50 ms (medido do main ao `requestAnimationFrame`); véu de 18%; caixa de 640 px em (400,120) com raio 14; seções Abas abertas (de todos os espaços, com selo do espaço), Favoritos, Histórico e Ações; ↑↓ ↵ ⌘↵ ⌥↵ ⇥ esc funcionam; ao fechar, o foco volta para a página; consulta em até 10 ms com 1000 itens. O crítico cego prefere a nossa (consulta "wiki") à barra de endereço flutuante do Zen. |
| espacos | Espaços com sessões isoladas | Teste automático contra um servidor local: cookie, localStorage, IndexedDB e permissão criados no Pessoal não aparecem no Trabalho, e vice-versa; ⌃1/⌃2 trocam em menos de 100 ms com a cor da janela, a lista e a aba ativa de cada espaço; mover aba entre espaços recarrega na partição nova; fechar e abrir restaura tudo pelo `session.json`. O crítico cego prefere a nossa troca de espaço à dos workspaces do Zen. |
| suspensao | Suspensão de abas paradas | Teste automático 3 vezes seguidas: com `--suspender-apos=5`, a aba inativa fica dormente em até 5 s + 1 tick e o processo dela some; a aba com áudio nunca suspende; ao clicar, ela acorda com voltar/avançar e a rolagem restaurados; ao abrir há só 1 renderer de página; `--carregar-todas` tem 10. A sidebar mostra lua, sec e 0.45 como no design. RAM com 9 de 10 dormentes ≤ 40% da RAM no modo justo. |
| leveza | RAM e tempo de abertura contra o Chrome | Protocolo da seção 6, mediana de 3 rodadas: no modo justo (`--carregar-todas`), RAM < Chrome **e** tempo < Chrome; no modo padrão, publicado ao lado, nunca no lugar do justo. Proibido ganhar desligando site isolation ou usando `--renderer-process-limit`. Permitido: menos processos de UI, suspensão, `--disable-features=SpareRendererForSitePerProcess` e throttling de fundo. |

## 8. Riscos e o que NÃO fazer

- **Não usar `BrowserView`** (deprecated) **nem a tag `<webview>`**. Só `BaseWindow` + `WebContentsView`.
- **Não carregar framework pesado no renderer**: só Preact 11 e @preact/signals, sem biblioteca de UI, CSS framework ou fonte de ícones. Orçamento do JS da shell: até 80 KB minificado. Nada de `backdrop-filter` para borrar a página: a shell não enxerga os pixels de outra view.
- **Não pôr lógica no preload**: ele só expõe `send`, `invoke` e `on` com os canais da lista. Views de aba não têm preload.
- Não recarregar nem recriar a shell (troca de espaço e de tema é só estado). Não animar `setBounds` de views de página. Não usar `localStorage` da shell como estado. Não usar `executeJavaScript` em páginas para montar UI (a página de erro é da shell por isso).
- O padrão de permissões do Electron concede tudo: o handler por sessão é obrigatório desde a peça Espaços.
- User agent com `Electron/`: o login do Google e alguns sites degradam ou bloqueiam. Mesmo limpo, o Google pode bloquear navegador embutido (README); fica registrado como risco.
- ⌃1/⌃2 podem estar tomados pelo Mission Control ("Ir para a Mesa 1/2") se o usuário tiver ativado. Se o teste mostrar isso, registrar um pendente com o caminho em Ajustes do Sistema; não mudar o sistema.
- Shell sobreposta engole cliques e a roda do mouse: ela fica no topo só enquanto há um motivo ativo, e todo motivo tem saída garantida (esc, clique no véu, ponteiro fora, troca de aba).
- A primeira subida da shell pode não ter pintado ainda na captura (visto uma vez): testes esperam 2 frames e conferem pixel.
- Senhas do iCloud: bloqueadas por launch constraint (ver `docs/senhas-icloud-evidencia.md`). Nada da arquitetura depende de native messaging. As extensões, quando vierem, carregam por sessão (`session.extensions`), o que casa com "extensões por espaço".
- Cada partição `persist:` tem cache próprio em disco: o uso de disco cresce com os espaços, a RAM não (o serviço de rede é um só).

## 9. Endurecimento do processo main (v0.1.2, frente seg-main)

Decisões de 15/10/2026, a partir da auditoria de segurança. Cada item tem teste em `app/test/` e foi conferido com o app rodando.

- **Shell** (F4): `resolve-shell-url.ts`. `ELECTRON_RENDERER_URL` só com `!app.isPackaged` e só `http://localhost:<porta>`; empacotado é sempre `app://shell`.
- **file:// não abre** (F1): `resolve-input` recusa (`refused: 'local-file'`), `navigate-tab`, `wake-tab` e `tab:create` mostram a página de erro da shell ("Arquivos locais não são abertos nesta versão", código `-1000`, fora da faixa do Chromium); `will-navigate`, `will-redirect` e `will-frame-navigate` das abas cancelam `file:` e `app:`; `setWindowOpenHandler` só aceita http, https, about:blank e blob; a sessão antiga com `file://` volta como Nova aba; "Salvar imagem como" só vale para http, https, data e blob. A Nova aba com erro mostra a página de erro e o ⌘L abre a paleta.
- **Rede local** (F5): `local-network-guard.ts` em `session.webRequest.onBeforeRequest` de cada partição. Pedido com iniciador (`initiatorOrigin`) de zona pública para destino loopback, rede privada, link-local, CGNAT, `.local`, `.internal`, `localhost` ou nome de uma palavra é cancelado (`ERR_BLOCKED_BY_CLIENT`, que a shell explica em português). Nome público é resolvido antes (`session.resolveHost`, o resolvedor do Chromium e o mesmo cache da conexão, no lugar de `dns.lookup`, que pode responder diferente) e cancelado se algum endereço for da rede local. A zona do iniciador é a da conexão que carregou o documento, gravada no pedido do documento: um nome que a DNS vira para 127.0.0.1 depois do carregamento continua público (rebinding). Sem iniciador (endereço digitado, sessão restaurada) passa; página da própria rede local fala com a rede local. Favicon baixado pelo main também não aponta para a rede local a partir de página pública. Limites: o iniciador de service workers e de WebRTC não passa por aqui; sites que falam com um app local (companions em `localhost`) deixam de funcionar.
- **Certificado de cliente** (F6): `select-client-certificate` com `preventDefault` e diálogo nativo (nome e emissor de cada certificado, "Cancelar" padrão); pedidos do mesmo site esperam a mesma resposta.
- **Sandbox, permissões, dispositivos** (F11, H-17, E14): `app.enableSandbox()` antes do ready; toda sessão nasce sem permissão (`session-created`), a padrão também; as sessões dos espaços liberam só `fullscreen`, `clipboard-sanitized-write` e `pointerLock`. `setDevicePermissionHandler` nega; HID, USB e serial são cancelados sem diálogo; `select-bluetooth-device` com `callback('')`; `WebBluetooth` entra em `--disable-features`, então `navigator.bluetooth` nem existe (nenhum pedido chega ao TCC). `<webview>` proibido.
- **Depuração** (E17): `--remote-debugging-*` e `--inspect*` (e `NODE_OPTIONS` com elas) só com `--dev` no app empacotado; sem `--dev`, `dialog.showErrorBox` e `app.exit(1)`. O diálogo bloqueia antes do ready, e a porta de depuração ainda não está aberta. Recomendado ao empacotamento: fusíveis `EnableNodeCliInspectArguments` e `RunAsNode` desligados.
- **Dados no disco** (E15): `session.json`, `history.jsonl` e `logs/main.log` com modo 0600 (e `userData` 0700), inclusive os que já existiam; gravação atômica (`.tmp` 0600 com fsync e rename); `#fragmento` fora do disco (endereços e títulos que o Chromium deriva do endereço); histórico com no máximo 500 entradas por host em cada espaço e 10 MB (as mais antigas saem); arquivos antigos acima dos limites ou com fragmento são reescritos na leitura. Arquivo > "Limpar dados de navegação…" apaga, só do espaço atual e depois de confirmar, cookies, cache, armazenamento dos sites, service workers, histórico e abas fechadas; `AppSnapshot.clearedData` faz a sidebar mostrar "Dados limpos" por 4 s.
- **Nenhuma conexão sem ação do usuário** (E12): favoritos usam letra e cor locais e só ganham o favicon depois de uma visita ao site (`fillFavoriteFavicons`); `services/fill-missing-meta.ts` só roda com `--abas` (bancada) e nunca consulta favoritos; o cache de favicons é por sessão (DADOS-05); `--disable-background-networking`; a busca só sai no ↵ (a paleta não pede sugestões). Medido com `lsof -i` em laço: 0 conexões em 60 s numa primeira abertura.
- **Títulos** (H-15): `sanitizeTitle` troca controles C0/C1 e marcas bidi de sobreposição e isolamento por espaço, na origem (evento de título, histórico, sessão) e na exibição (sidebar e paleta).
- **Tela cheia** (H-14): ao entrar em tela cheia de vídeo o motivo de overlay `notice` sobe a shell por 3 s, encolhida para uma faixa de 320×44 no topo e no centro (o resto da página segue recebendo cliques), com "Site em tela cheia. Esc para sair".
- **Logs** (k): `formatErrorLog` e `logError` deixam só o host de cada URL (`redactUrls`).

