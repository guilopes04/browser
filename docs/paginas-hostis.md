# Comportamento diante de páginas hostis

Frente 3 da auditoria de segurança (branch `seg-web`). Cada regra abaixo tem teste de unidade
(`app/test/*.test.ts`) e foi exercitada contra páginas hostis locais no app de verdade
(`npm run e2e:hostil`, `app/e2e/hostile-pages.ts` e `hostile-server.ts`).

## Gesto do usuário (base de tudo)

O main registra, por aba, o último gesto real na página: tecla digitada (`before-input-event`,
sem ⌘, sem repetição, sem Esc nem modificadores) e clique (`input-event`: mouseDown, mouseUp,
touchEnd). A página não forja isso: um `click()` de script não passa por aqui. O gesto vale 5 s
(`functions/user-gesture.ts`). O estado de todas as defesas fica em `ctx.guard` (`web-guard.ts`).

O gesto é do documento em que o usuário o fez. Quando a aba carrega outro documento (`did-navigate`
do quadro principal), o gesto e o saldo de pop-ups são zerados (`resetDocumentState`): o clique num
link não vale para o que a página de destino fizer ao carregar, nem um clique seguido de um
endereço digitado logo depois. `#fragmento` e `pushState` são o mesmo documento e mantêm o gesto.
Só o gesto na página nova conta; sem ele, o pop-up é bloqueado e o download pergunta.

### O gesto é do quadro (E7/E8)

Como no Chromium, um gesto ativa o **quadro em que aconteceu, os ancestrais dele e os descendentes
da mesma origem**; um iframe de outra origem (o anúncio) não herda o clique dado na página
principal. Antes, o gesto valia para a aba inteira: depois de qualquer clique na página, um iframe
de terceiro abria pop-up (que virava a aba ativa) e baixava arquivo sem perguntar.

- Quem sabe em que quadro o clique caiu é o preload das abas (`preload/tab-guard.ts`, em todos os
  quadros): ouve `mousedown`, `pointerdown`, `touchend` e `keydown` com `isTrusted` (a página não
  fabrica), na captura da janela (antes de qualquer ouvinte da página) e reporta por IPC
  **síncrono**, para o main saber antes de a página tratar o evento (o pop-up do clique sai na mesma
  tarefa). O quadro vem de `event.senderFrame` (dado do Chromium), não do que a página diz. O relato
  também é o gesto da aba: o main não vê o clique dado dentro de um iframe de outra origem (o
  Chromium o entrega direto ao renderer dele), então o clique dentro de um iframe de outra origem
  (o botão "entrar com o Google", um player embutido) não contava como gesto da aba e o pop-up que
  ele abre era bloqueado (medido: clique real no anúncio, `no-gesture`); agora conta, para o quadro
  dele e os ancestrais.
- `functions/frame-activation.ts` (pura) decide: o quadro que pede foi ativado? Quem pede é achado
  pelo **referrer do `window.open`** (o Chromium o calcula a partir do quadro de origem; a página
  não o forja), pelo **iniciador do download** (`item.getInitiatorOrigin()`) e pelo `requestingUrl`
  da permissão de abrir em outro app. Todos os quadros daquela origem precisam estar ativados.
  Origem opaca (sandbox, `data:`) nunca é igual a nada; o quadro em sandbox é achado pelo endereço.
- Sem referrer (`rel="noreferrer"`, `Referrer-Policy: no-referrer`), qualquer quadro pode estar
  pedindo, e só vale se todos estiverem ativados, **ou** se o usuário clicou, há menos de 1,5 s,
  num link para exatamente aquela URL (o preload reporta o clique em `a`/`area`, `isTrusted`, para
  `rel="noopener noreferrer"` que não deixa opener nem referrer).
- Gesto que nenhum quadro reportou (quadro sem preload) vale para a página principal, nunca para
  um iframe.
- Limites: um `window.open(url, '_blank', 'noopener,noreferrer')` disparado pelo clique do usuário,
  numa página que tem iframe de outra origem, fica bloqueado com o aviso "Pop-up bloqueado" (pode
  ser o anúncio; **Abrir** resolve). Os quadros internos de um pop-up aberto por script não têm
  preload (o Electron não herda `nodeIntegrationInSubFrames` na janela que o Chromium cria), então
  o clique dentro de um iframe de outra origem de um pop-up não conta; o clique na página do
  pop-up conta.
- O preload é registrado na sessão do espaço (`session.registerPreloadScript`), não nas
  `webPreferences` da aba: o pop-up que o Chromium cria em `window.open` e a aba adota nascia sem o
  preload das `webPreferences`, e o `alert` dele era o nativo, sem a guarda (o e2e antigo só contava
  folhas e não via). Agora o pop-up tem o mesmo `alert`/`confirm`/`prompt` das outras abas
  (`popup-leva-o-preload`).

## Downloads (H-01, DADOS-01, E7)

- Com gesto na aba **e de quem iniciou o download** (o quadro de origem do pedido foi ativado, veja
  acima), ou pedido do próprio app ("Salvar imagem como"): baixa na hora. O download do anúncio
  de outra origem, com o usuário clicando só na página, pergunta como se não houvesse gesto. (O
  `item.hasUserGesture()` do Chromium concordou nas medições, mas o `window.open` consome a
  ativação e um download logo depois do pop-up do mesmo clique é legítimo, então ele não entra.)
- Sem gesto: o download pausa e grava numa pasta temporária; o diálogo nativo pergunta "Este site
  quer baixar <nome> (<tamanho>). Permitir?", com Cancelar como padrão. Permitido, o arquivo
  concluído vai para Downloads; recusado, tudo some. Um diálogo por vez e 10 s de silêncio depois
  de uma recusa. Nada aparece em Downloads sem permissão.
- Nome reservado com `open(..., 'wx')`: downloads simultâneos do mesmo nome nunca se sobrescrevem.
- Ao concluir, `xattr -w com.apple.quarantine "0083;<hora hex>;Gilas Browser;"` e leitura de volta
  para conferir. Sem a quarentena o arquivo não fica e o ícone mostra falha.
- No máximo 20 downloads simultâneos por aba.
- Limite medido: no download recusado sem diálogo (`reject-busy`, `reject-cooldown`, `reject-limit`,
  que dão `event.preventDefault()`), o Chromium cria o arquivo intermediário `.com.github.Electron.*`
  na pasta de Downloads, grava nele o que já chegou e o apaga em instantes (lendo a pasta a cada 5
  ms: 15 aparições em 9 s, numa página que tenta baixar a cada 300 ms; a pasta fica vazia no fim). É
  um arquivo escondido de nome aleatório, sem o nome que a página deu. Mandar o destino para a
  pasta temporária antes de recusar (`setSavePath` e depois `cancel()` ou `preventDefault()`) e
  `session.setDownloadPath` foram tentados e não mudaram nada, então não foi corrigido. O download
  que pergunta (`ask`) não passa por Downloads: o intermediário nasce na pasta temporária. O e2e
  espera o intermediário sumir em vez de exigir a pasta vazia no primeiro instante.
- Controles de direção de texto (U+202E e afins) saem do nome do arquivo.
- Flag `--pasta-downloads=<pasta>` para os testes não tocarem em `~/Downloads`.
- A pasta temporária leva o pid no nome (`gilas-download-<pid>-<sufixo>`). Se o app cai ou é morto
  com a pergunta na tela, a abertura seguinte apaga a pasta de quem não existe mais
  (`functions/sweep-staging.ts`; a de uma instância viva, de outro perfil, fica) e as do formato
  antigo, sem pid, depois de um dia; ao encerrar normalmente (`will-quit`) as do próprio processo
  também saem.

## Pop-ups (H-02, E8)

- `window.open` e `target=_blank` só abrem com gesto recente na aba de origem **e no quadro que
  pede** (um iframe de outra origem não herda o clique na página: motivo `other-frame` no log); um
  gesto libera no máximo 3 (`functions/decide-popup.ts`).
- Bloqueado: o pedido é negado e a aba ganha `blockedPopups` (as URLs ficam só no main). A sidebar
  mostra "Pop-up bloqueado" com **Abrir** e dispensar; o aviso some quando a aba navega.
- A aba aberta por uma aba que não é a ativa nasce em segundo plano.
- `outlivesOpener: true`: fechar a aba que abriu não fecha os pop-ups.

## Endereço (H-03, H-04, E9)

- O campo mostra o host dividido: subdomínios em cor secundária e o **domínio registrável** em
  peso 600 (`shared/registrable-domain.ts`: dois últimos rótulos, mais as exceções `com.br`,
  `co.uk`, `gov.br`... e plataformas como `github.io`). O domínio **nunca é cortado**: um domínio
  longo cortado no meio ("banco-do-br…tendimento.com") esconde as letras que separam o site
  verdadeiro do falso. O que falta de espaço sai nesta ordem: o caminho, os subdomínios (cortados
  no começo, com "…") e o texto "Não seguro" (fica o cadeado). O CSS faz isso sem JS: `.address-host`
  é um flex `row-reverse wrap` de altura fixa, o DOM vem na ordem de prioridade (domínio,
  subdomínio, texto) e o que não cabe na linha cai para a segunda, escondida (`sidebar.css`). Se o
  domínio sozinho não cabe numa linha (mais de ~26 caracteres na sidebar de 260 px), uma sonda
  invisível o mede (`address-field.tsx`) e o campo entra no modo `.address-wraps`: o domínio
  ocupa o campo e quebra em quantas linhas precisar (depois de um hífen, ou em qualquer
  caractere), o campo cresce, e ficam só o domínio e o cadeado (o host inteiro está no tooltip e no
  `aria-label`). Os subdomínios e o "Não seguro" não aparecem nesse modo.
- IDN (`shared/idn-host.ts`): o rótulo só aparece em Unicode quando todas as letras são de um
  único script (ASCII conta como latim; han com kana ou hangul é permitido) e não é cirílico ou
  grego que só tem letras parecidas com as latinas. Senão fica em punycode.
- `http:` mostra "Não seguro" (ícone e texto em cor secundária) no campo e na paleta. A queda de
  https para http digitado continua, agora com o indicador. Vale também para `127.0.0.1` e
  `localhost` (decisão em aberto: Chrome isenta o loopback).

## Diálogos de página (H-05, H-07, E10)

O Electron não expõe `alert`/`confirm`/`prompt`. O preload das abas (`src/preload/tab-guard.ts`,
em todos os quadros) os troca por funções que perguntam ao main por IPC síncrono, e os diálogos
nativos do Electron ficam desligados (`disableDialogs`). O main decide:

- só a aba ativa mostra o diálogo; ao fundo é descartado com o retorno padrão e a aba ganha um
  marcador (`dialogBlocked`), que some quando ela é aberta ou recarrega;
- o diálogo nativo mostra a origem ("127.0.0.1:9601 diz:"), vinda do quadro (dado do Chromium);
- depois de 3 diálogos em 10 s, a caixa "Bloquear mais diálogos deste site" (por aba, até
  recarregar);
- o diálogo fecha junto com a aba; janela escondida descarta (no macOS um diálogo sem janela-pai
  é síncrono e travaria o app);
- `prompt()` continua devolvendo `null`: o diálogo nativo não tem campo de texto.

`beforeunload` só pergunta quando o usuário agiu: fechar, recarregar, voltar, ir a um endereço ou
clicar/digitar na aba da frente (`functions/user-intent.ts`). Uma pergunta por ação (os quadros
seguintes repetem a resposta), nunca em loop, e uma aba em segundo plano que se segura sozinha não
ganha diálogo nem roubo de foco.

## Atalhos (H-06, E11)

`functions/handle-early-shortcut.ts` casa a tecla com a tabela de `shared/shortcuts.ts` (a mesma do
menu) em `before-input-event`, antes da página, com `preventDefault` do keyDown e do keyUp. O menu é
só rótulo. Segurar a tecla só repete o zoom e o passo da busca (⌘G, ⇧⌘G). Atalho novo na tabela
(como ⌘F, ⌘G e ⇧⌘G da busca na página) entra sozinho.

## window.close (H-09, H-10, E13)

- Só aba aberta por script (`window.open`, `target=_blank`) fecha por `window.close()`; a aba que o
  usuário abriu ignora o pedido (fica dormente com o histórico do evento `close`, recarrega se
  estava na frente; em laço, a vizinha assume) e o log registra o motivo.
- A aba de quem abriu abas que ainda existem nunca sai da sidebar por causa de um `opener.close()`
  de um pop-up (`judge-script-close.ts`). Limite conhecido: o Electron destrói o webContents assim
  que o Chromium pede o fechamento (o evento `close` não é cancelável) e o app não consegue vetar
  o `opener.close()`. O que protege é só o que o Chromium já faz: com o pop-up da mesma origem, ele
  roda o `beforeunload` da página do opener e, havendo um (e uma ação do usuário nela, como digitar
  o rascunho), cancela o fechamento em silêncio; o rascunho sobrevive. Sem `beforeunload`, ou com
  o pop-up de outra origem (o login em outro domínio, em outro processo, em que o `beforeunload`
  nem roda), a página do opener é descartada: a aba continua na sidebar, dormente, e recarrega
  quando aberta (na frente, na hora); o estado em JavaScript se perde. O que o usuário digitou num
  `<textarea>` costuma voltar (o `pageState` do histórico de navegação guarda os campos: medido com
  digitação real, o rascunho voltou ao reabrir a aba), mas isso depende de o `pageState` ter sido
  sincronizado antes do descarte (não medido com o fechamento em menos de 1 s depois de digitar nem
  com o pop-up de outra origem). A decisão de aceitar o limite é do Guilherme. Medido nos
  três casos de `e2e/hostile-pages.ts` (`window-close-opener-*`). Mexer em `window.opener` por
  script (um `Proxy` no pop-up) foi descartado: o `event.source` de uma mensagem do opener e
  `opener.opener` devolvem a janela real, então a proteção teria furos e mudaria o que os sites
  veem.
- O que uma página fechou por script também entra no ⇧⌘T.
- Ao encerrar o app (⌘Q, `app.quit()`, SIGTERM) o Electron destrói todas as views, e `closeDeadTab`
  sai logo com `ctx.quitting`: nada se reativa, se cria ou se remove no desmonte. Sem isso, a aba da
  frente (que não foi aberta por script) tinha o "pedido ignorado" e `keepTabAfterScriptClose`
  criava uma view nova no meio do desmonte: o Chromium caía com SIGTRAP (saída 133, relatório em
  `~/Library/Logs/DiagnosticReports`) e a abertura seguinte parava no aviso do macOS para reabrir
  janelas. Conferido no dev e no build empacotado (sem assinar, com `--use-mock-keychain`) com uma
  página web na frente: ⌘Q de verdade e SIGTERM, 5 de 5 saídas com 0 e nenhum relatório novo; os
  commits sem a correção saem com 133.
- `app.exit()` (o modo `--captura`) não emite `before-quit`: `ctx.quitting` seguia `false`, e o
  mesmo desmonte caía com SIGTRAP (o log terminava em "pedido ignorado ... not-script-opened", e o
  `confere-build.sh` não via, porque ignorava o código de saída). Quem sai por `app.exit` passa por
  `exitApp` (`functions/exit-app.ts`), que põe `ctx.quitting = true` antes. Conferido: dev
  (`--captura` com duas abas locais) e build empacotado sem assinar (com `--use-mock-keychain`), 3
  de 3 saídas com 0 em cada, e o `confere-build.sh --sem-assinatura` agora exige saída 0.

## Esquemas externos (H-16)

`mailto:`, `tel:` e demais esquemas registrados passam pela permissão `openExternal` da sessão:
só com gesto recente, uma pergunta por vez, diálogo "Abrir <esquema> em outro app?" com Cancelar
como padrão; nunca abre em silêncio. Esquema que nenhum app do Mac trata
(`app.getApplicationNameForProtocol` vazio) mostra a página de erro da aba (código -302).
