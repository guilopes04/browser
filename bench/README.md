# Bancada de medição

Mede tempo de abertura e RAM de um navegador com as dez abas de `tabs.json` e captura a janela.
Só Node 22 (WebSocket global) e ferramentas do sistema; nenhuma dependência npm.

## Como rodar

```sh
swiftc -O bench/winlist.swift -o bench/winlist        # uma vez
export BENCH_WORK=/caminho/da/pasta/temporaria         # perfis temporários (padrão: <tmp>/navegador-bench)
node bench/measure.js chrome                           # 3 rodadas (padrão)
node bench/measure.js zen --rodadas=3
node bench/measure.js nosso                            # cwd app/, carrega só a aba ativa
node bench/measure.js nosso-todas                      # idem com --carregar-todas
node bench/measure.js chrome --teste                   # 1 rodada, grava results/<nome>-teste.{json,png}
node bench/capture.js Electron saida.png [parteDoTitulo]
```

Resultados em `bench/results/<nome>.json` (rodadas, mediana, capturas, notas), `<nome>-rodada<n>.png` e
`<nome>-amostras-cpu.json` (série de CPU de cada rodada, em ms desde o spawn). Feche outros navegadores antes:
a máquina tem 8 GB e a medição seguinte sairia errada.

## Protocolo (o nosso navegador é medido do mesmo jeito)

1. Perfil temporário novo por navegador (`<BENCH_WORK>/<nome>-profile`), copiado de um perfil-base já configurado
   (`<nome>-base`, criado abrindo o navegador sem abas) e **sem cache**. Nunca o perfil do usuário.
2. Janela pedida 1440×900 em (0,0). O macOS recorta para a área útil (barra de menus + Dock): na prática 1440×842 em (0,33).
3. Mesmos 10 URLs de `tabs.json`, tema claro (o macOS do ambiente está no escuro; o claro é forçado nas
   preferências do perfil temporário, sem mexer no sistema).
4. Cada rodada:
   - `tempoCarregadoMs`: de antes do spawn até as 10 páginas com `document.readyState === 'complete'` no mesmo instante
     de consulta (CDP no Chrome/Electron: `/json/list` + `Runtime.evaluate`; BiDi no Zen: `browsingContext.getTree` + `script.evaluate`).
     `paginasCompletasMs` mostra quando cada página ficou pronta.
   - `tempoJanelaMs`: primeira janela da árvore com ≥ 400×300 no CGWindowList (`winlist --seguir 25`, resolução ~25 ms).
   - `tempoOciosoMs`: início do primeiro trecho de 3 s com CPU da árvore < 10% (um núcleo = 100%), contado depois da
     janela aparecer. O %CPU do `ps` no macOS é média de vida inteira, então a CPU vem da variação do tempo de CPU (`ps time`)
     a cada 500 ms. `null` = não ficou ocioso em até 120 s após carregar. `tempoOciosoPosCargaMs` exige também já estar carregado.
   - 30 s depois de tudo carregado: RAM da árvore (raiz = pid do spawn, filhos por ppid, mais processos cujo comando contém o
     caminho do perfil). `footprintMB` = soma do `phys_footprint` (`/usr/bin/footprint`, conta memória comprimida/trocada);
     `rssMB` = soma do RSS do `ps`. Com a máquina em pressão de memória o RSS fica muito menor que a realidade; use o footprint.
   - A primeira aba é ativada (CDP `/json/activate` ou BiDi `browsingContext.activate`), a janela vai para a frente e é
     capturada com `screencapture -x -o -l <id>`.
   - Encerra (SIGTERM, depois `pkill -f <perfil>`) e confere que não sobrou processo.
5. Mediana de 3 rodadas por métrica.

### Zen

`--profile <perfil> --no-remote --remote-debugging-port=<porta>` e as URLs como argumentos. `user.js` pula boas-vindas e avisos
(`zen.welcome-screen.seen`, `browser.aboutwelcome.enabled`, etc.) e força o tema claro; `xulstore.json` fixa a janela em 1440×900.
O agente remoto liga `navigator.webdriver` e o Google troca a busca pela tela de captcha (`google.com/sorry`), uma página mais leve.
Por isso cada rodada do Zen tem uma segunda abertura **sem** `--remote-debugging-port`, só para a RAM
(`semAutomacao` na rodada e `medianaSemAutomacao` no resultado).

### nosso / nosso-todas

`cd app && node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . --abas=bench/tabs.json --remote-debugging-port=<porta> --user-data-dir=<perfil>`
(`nosso-todas` acrescenta `--carregar-todas`). O dono da janela no CGWindowList será `Electron` ou `Navegador`; a bancada acha a
janela pelo pid, não pelo nome. `nosso` espera só a aba ativa (as outras podem ficar suspensas) e exige 2 s estáveis; `nosso-todas`
espera as dez, como no Chrome. O app deve expor as páginas das abas como alvos CDP (`webContents` com URL http/https).
Páginas em `localhost` e `file://` (interface do próprio app) são ignoradas na contagem. Para comparar capturas com Chrome e Zen
o app precisa forçar o tema claro (`nativeTheme.themeSource = 'light'`), já que o macOS do ambiente está no escuro.
Para testar a bancada com outro app Electron (ex.: um app de mentira), use `BENCH_APP_DIR=<pasta> BENCH_ELECTRON=<binário>`.
A bancada foi validada com um app de mentira (`BaseWindow` + `WebContentsView`) antes de o app real existir.

## Cuidados descobertos

- O alvo CDP lista a URL da navegação em andamento enquanto o documento ainda é o `about:blank` inicial, que já diz `complete`;
  por isso a URL e o estado são lidos dentro da página (`location.href`).
- O Zen se atualiza sozinho (já trocou 1.21.16b por 1.23.2b no meio da bancada e relançou uma cópia sem perfil). O `user.js`
  desliga a atualização automática; confira a versão em `results/zen.json` (`versao`).
- A máquina está com pouca RAM livre e outros processos ativos; compare rodadas feitas com o mesmo nível de carga (`cargaAntes`).
- `results/<nome>-notas-extras.json` guarda notas escritas à mão que entram em `notas` do resultado.

## Arquivos

- `measure.js`: rodadas, métricas, mediana e notas. `capture.js`: captura por nome do dono da janela.
- `lib/system.js` (ps, footprint, janelas, encerramento), `lib/cdp.js`, `lib/bidi.js`, `lib/browsers.js` (perfis e argumentos).
- `winlist.swift`: lista janelas (`winlist`) ou vigia aparições (`winlist --seguir [ms]`).
