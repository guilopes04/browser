# Comportamento diante de páginas hostis

Frente 3 da auditoria de segurança (branch `seg-web`). Cada regra abaixo tem teste de unidade
(`app/test/*.test.ts`) e foi exercitada contra páginas hostis locais no app de verdade
(`npm run e2e:hostil`, `app/e2e/hostile-pages.ts` e `hostile-server.ts`).

## Gesto do usuário (base de tudo)

O main registra, por aba, o último gesto real na página: tecla digitada (`before-input-event`,
sem ⌘, sem repetição, sem Esc nem modificadores) e clique (`input-event`: mouseDown, mouseUp,
touchEnd). A página não forja isso: um `click()` de script não passa por aqui. O gesto vale 5 s
(`functions/user-gesture.ts`). O estado de todas as defesas fica em `ctx.guard` (`web-guard.ts`).

## Downloads (H-01, DADOS-01, E7)

- Com gesto na aba (ou pedido do próprio app, como "Salvar imagem como"): baixa na hora.
- Sem gesto: o download pausa e grava numa pasta temporária; o diálogo nativo pergunta "Este site
  quer baixar <nome> (<tamanho>). Permitir?", com Cancelar como padrão. Permitido, o arquivo
  concluído vai para Downloads; recusado, tudo some. Um diálogo por vez e 10 s de silêncio depois
  de uma recusa. Nada aparece em Downloads sem permissão.
- Nome reservado com `open(..., 'wx')`: downloads simultâneos do mesmo nome nunca se sobrescrevem.
- Ao concluir, `xattr -w com.apple.quarantine "0083;<hora hex>;Gilas Browser;"` e leitura de volta
  para conferir. Sem a quarentena o arquivo não fica e o ícone mostra falha.
- No máximo 20 downloads simultâneos por aba.
- Controles de direção de texto (U+202E e afins) saem do nome do arquivo.
- Flag `--pasta-downloads=<pasta>` para os testes não tocarem em `~/Downloads`.

## Pop-ups (H-02, E8)

- `window.open` e `target=_blank` só abrem com gesto recente na aba de origem; um gesto libera no
  máximo 3 (`functions/decide-popup.ts`).
- Bloqueado: o pedido é negado e a aba ganha `blockedPopups` (as URLs ficam só no main). A sidebar
  mostra "Pop-up bloqueado" com **Abrir** e dispensar; o aviso some quando a aba navega.
- A aba aberta por uma aba que não é a ativa nasce em segundo plano.
- `outlivesOpener: true`: fechar a aba que abriu não fecha os pop-ups.

## Endereço (H-03, H-04, E9)

- O campo mostra o host dividido: subdomínios em cor secundária e o **domínio registrável** em
  peso 600 (`shared/registrable-domain.ts`: dois últimos rótulos, mais as exceções `com.br`,
  `co.uk`, `gov.br`... e plataformas como `github.io`). O que não cabe é cortado no começo, com
  "…" (o caminho cede antes do host).
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
só rótulo. Segurar a tecla só repete o zoom. Atalho novo na tabela (⌘F, ⌘G da busca na página)
entra sozinho.

## window.close (H-09, H-10, E13)

- Só aba aberta por script (`window.open`, `target=_blank`) fecha por `window.close()`; a aba que o
  usuário abriu ignora o pedido (fica dormente com o histórico do evento `close`, recarrega se
  estava na frente; em laço, a vizinha assume) e o log registra o motivo.
- Nunca fecha quem abriu abas que ainda existem (`opener.close()` de um pop-up não derruba o opener).
- O que uma página fechou por script também entra no ⇧⌘T.

## Esquemas externos (H-16)

`mailto:`, `tel:` e demais esquemas registrados passam pela permissão `openExternal` da sessão:
só com gesto recente, uma pergunta por vez, diálogo "Abrir <esquema> em outro app?" com Cancelar
como padrão; nunca abre em silêncio. Esquema que nenhum app do Mac trata
(`app.getApplicationNameForProtocol` vazio) mostra a página de erro da aba (código -302).
