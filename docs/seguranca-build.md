# Segurança do build: fuses, entitlements e como conferir

Verificado em 15/10/2026 com Electron 44.7.2, electron-builder 26.15.3 e `@electron/fuses` 1.8.0, em arm64 (macOS 27). Os testes abaixo rodaram no build de `npm run dist:sem-assinar` e em cópias dele. O que não deu para testar sem a identidade Developer ID está marcado como **não testado**.

Arquivos que mandam nisto: `app/electron-builder.yml` (`electronFuses`), `app/build/entitlements.mac.plist`, `app/build/entitlements.mac.inherit.plist` e `scripts/confere-build.sh`.

## 1. Fuses

Fuse é um byte gravado no binário do Electron (`Electron Framework`), não uma opção de runtime. O `electron-builder` grava os valores de `electronFuses` logo antes de assinar. Quem tem o app instalado não consegue ligar de volta uma capacidade que o fuse desligou sem alterar o binário, e alterar o binário quebra a assinatura.

| Fuse (`electronFuses`) | Valor | O que faz | Testado |
|---|---|---|---|
| `runAsNode` | desligado | `ELECTRON_RUN_AS_NODE=1` deixa de transformar o binário assinado num Node com os direitos do app (acesso aos arquivos do usuário, ao microfone etc., herdados da assinatura) | Sem o fuse, `ELECTRON_RUN_AS_NODE=1 Electron app -e ...` executou como Node. Com o fuse, o app abriu normal e ficou rodando |
| `enableNodeOptionsEnvironmentVariable` | desligado | `NODE_OPTIONS` e `NODE_EXTRA_CA_CERTS` do ambiente são ignorados (`NODE_OPTIONS=--require x.js` injetaria código no processo principal) | Sem o fuse, o `--require` rodou e criou o arquivo de marca. Com o fuse, não rodou |
| `enableNodeCliInspectArguments` | desligado | `--inspect`, `--inspect-brk` e o sinal `SIGUSR1` não abrem o inspetor do Node no processo principal | Sem o fuse, `--inspect=9333` imprimiu `Debugger listening on ws://127.0.0.1:9333/...`. Com o fuse, nada |
| `enableEmbeddedAsarIntegrityValidation` | ligado | Na abertura o Electron compara o hash do cabeçalho do `app.asar` com o `ElectronAsarIntegrity` do `Info.plist` e aborta se diferir. O electron-builder calcula e grava o hash | Um byte do cabeçalho alterado: `FATAL ... Integrity check failed for asar archive entry '<header>'`, saída 133, o app não abre |
| `onlyLoadAppFromAsar` | ligado | O Electron só procura o código em `Resources/app.asar`. Uma pasta `Resources/app/` solta não vale. Junto com o fuse acima, não há como carregar código que não passou pela validação | Sem `app.asar` e com `Resources/app/main.js` solto: sem o fuse o arquivo rodou, com o fuse não rodou (saída 1) |
| `enableCookieEncryption` | ligado | O banco de cookies (`Partitions/<espaço>/Cookies`) é cifrado com a chave da keychain `Gilas Browser Safe Storage`, como o Chrome faz | Sem o fuse, o valor ficou em texto puro no sqlite. Com o fuse, `value` vazio e `encrypted_value` com prefixo `v10` (67 bytes), e o texto do cookie não aparece em nenhum arquivo do perfil |
| `grantFileProtocolExtraPrivileges` | desligado | Páginas `file://` deixam de ter privilégios extras (fetch de outros `file://`, service workers, acesso universal entre frames). A shell vem de `app://shell`, nada do app usa `file://` | O app abre a shell por `app://` e navega normalmente |
| `resetAdHocDarwinSignature` | ligado | Não é um fuse: pede ao `@electron/fuses` que reassine ad-hoc depois de gravar | Veja a armadilha 1 |

Ficam como vêm do Electron: `loadBrowserProcessSpecificV8Snapshot` (desligado) e o 9º fuse da fiação do Electron 44, que o `@electron/fuses` 1.8.0 ainda não nomeia (o `read` o imprime como `undefined`, ligado). Se uma versão nova do `@electron/fuses` passar a nomeá-lo, avalie e inclua em `electronFuses` e em `FUSES_ESPERADOS` do `scripts/confere-build.sh`.

Estado do Electron 44.7.2 sem o empacotamento, para comparar: `RunAsNode` ligado, `EnableCookieEncryption` desligado, `EnableNodeOptionsEnvironmentVariable` ligado, `EnableNodeCliInspectArguments` ligado, `EnableEmbeddedAsarIntegrityValidation` desligado, `OnlyLoadAppFromAsar` desligado, `GrantFileProtocolExtraPrivileges` ligado.

### Cookies: transição de mão única

Com `enableCookieEncryption` ligado, cookies antigos em texto puro são cifrados quando regravados. Desligar o fuse de novo deixa o banco, nas palavras da documentação do electron-builder, efetivamente corrompido e inútil. Não volte atrás sem apagar `Partitions/*/Cookies*`.

### Keychain

A chave fica no item `Gilas Browser Safe Storage` (conta `Gilas Browser Key`) do login keychain. O macOS só deixa ler sem perguntar o app que criou o item. Consequências:

- Build ad-hoc (`dist:sem-assinar`): cada build tem outro cdhash. O primeiro acesso de um build novo a um item criado por outro build faz o macOS pedir a senha. Com a tela bloqueada o pedido não aparece e a rede do app trava (as páginas `http` ficam em "carregando" para sempre, a shell `app://` abre normal). Isso aconteceu nos testes. Para testar, abra com `--use-mock-keychain` (flag do Chromium). O `scripts/confere-build.sh` faz isso sozinho nos modos `--sem-assinatura` e `--sem-notarizacao`.
- Build Developer ID: o requisito de assinatura é o identificador mais o Team ID, então atualizar o app não pede nada de novo. Mas, se um build de teste ad-hoc já criou o item nesta máquina, o primeiro build assinado vai pedir permissão uma vez ("Sempre permitir"). Para evitar, apague o item de teste antes do primeiro build assinado: `security delete-generic-password -s "Gilas Browser Safe Storage"` (o Acesso às Chaves também serve). Os cookies cifrados pelo build de teste ficam ilegíveis e o Chromium recomeça com o banco limpo.

## 2. Entitlements

Os dois plists têm agora só `com.apple.security.cs.allow-jit`. O app principal usa `entitlements.mac.plist` e os helpers (renderer, GPU, rede, plugin) usam `entitlements.mac.inherit.plist`.

| Entitlement | Decisão | Por quê |
|---|---|---|
| `cs.allow-jit` | mantida | O V8 e o WebAssembly alocam código com `MAP_JIT`. Cópia assinada com hardened runtime e sem ela: o app morre com `SIGTRAP` ao iniciar o V8 |
| `cs.allow-unsigned-executable-memory` | removida | Não precisou. Com hardened runtime e só `allow-jit`: laço quente de 40 milhões de iterações (~70 ms, compilado pelo TurboFan), WebAssembly compilado e chamado 5 milhões de vezes, `new Function`, regexp, ordenação de 1 milhão de `Float64Array`, WebGL2 (ANGLE sobre Metal, Apple M2), canvas 2D, `OfflineAudioContext` e o visualizador de PDF (extensão `mhjfbmdgcfjbbpaeojofohoefgiehjai` carregou e o PDF abriu) funcionaram como no build sem hardened runtime. Esta entitlement desligava a proteção contra escrever e executar memória sem `MAP_JIT` |
| `cs.allow-dyld-environment-variables` | removida | Deixaria `DYLD_INSERT_LIBRARIES` injetar uma biblioteca no app assinado |
| `cs.disable-library-validation` | removida | Deixaria o app carregar bibliotecas de outro Team ID. Com a identidade Developer ID, todo o código do bundle tem o mesmo Team ID e a validação passa. **Não testado**: precisa da identidade real, e uma cópia ad-hoc falha na validação (`mapping process and mapped file (non-platform) have different Team IDs`), então nos testes de hardened runtime só as cópias de teste tinham esta entitlement. Um certificado autoassinado também não serve: o `codesign` não deriva Team ID dele |
| `device.camera` e `device.audio-input` | removidas | Nesta versão toda permissão de site é negada (`get-space-session.ts` só libera `fullscreen`, `clipboard-sanitized-write` e `pointerLock`). Sem a entitlement o macOS nem chegaria a perguntar |

Não testado (nenhum dos dois funciona nem no build sem hardened runtime, então o teste não distinguiria nada): o fallback de renderização por software (SwiftShader), que não consegui forçar com `--use-angle=swiftshader`, e WebGPU. Se um Mac sem GPU ou uma VM falhar ao criar contextos WebGL, é o primeiro lugar para olhar. Nesse caso reponha `cs.allow-unsigned-executable-memory` só em `entitlements.mac.inherit.plist` e registre aqui.

As chaves `NSCameraUsageDescription` e `NSMicrophoneUsageDescription` seguem no `Info.plist` (`extendInfo`), mas não aparecem para o usuário enquanto as entitlements estiverem fora.

A entitlement restrita de navegador (`com.apple.developer.web-browser.public-key-credential`) continua fora do plist até a Apple aprovar e o perfil de provisionamento entrar (veja `docs/senhas-decisao.md`).

## 3. Como conferir

Build assinado e notarizado (`npm run dist`):

```sh
scripts/confere-build.sh
```

Build sem assinar (`npm run dist:sem-assinar`, que escreve em `${GILAS_DIST:-~/Library/Caches/gilas-browser/dist}`):

```sh
GILAS_DIST=~/Library/Caches/gilas-browser/dist-seg npm run dist:sem-assinar   # em app/
scripts/confere-build.sh --sem-assinatura ~/Library/Caches/gilas-browser/dist-seg
```

O script confere, nesta ordem: assinatura e hardened runtime; entitlements do app e de cada helper (só `allow-jit`, nenhuma das removidas); os sete fuses; o `ElectronAsarIntegrity` e a ausência de `Resources/app` e de `app.asar.unpacked`; Gatekeeper e ticket de notarização; os fuses do app dentro do `.dmg`; a abertura do app a partir do `.dmg` com `--captura`; e que `ELECTRON_RUN_AS_NODE=1` não vira Node (o app abre normal e fica rodando). `--sem-notarizacao` pula spctl e stapler. `--sem-assinatura` pula também assinatura, entitlements e Gatekeeper.

À mão:

```sh
APP=~/Library/Caches/gilas-browser/dist/mac-arm64/"Gilas Browser.app"
node app/node_modules/@electron/fuses/dist/bin.js read --app "$APP"
codesign -d --entitlements - "$APP"
codesign -d --entitlements - "$APP"/Contents/Frameworks/*.app
/usr/libexec/PlistBuddy -c 'Print :ElectronAsarIntegrity' "$APP/Contents/Info.plist"
```

Cookie cifrado: abra o app com um `--user-data-dir` novo, visite uma página que grave um cookie persistente (`Max-Age`), saia com ⌘Q (o Chromium adia a gravação dos cookies em disco; sair normalmente garante que ela aconteça) e rode:

```sh
sqlite3 <user-data-dir>/Partitions/space-personal/Cookies \
  "select host_key, name, length(value), hex(substr(encrypted_value,1,3)), length(encrypted_value) from cookies"
# esperado: length(value) = 0 e prefixo 763130 (v10)
grep -rl 'texto-do-cookie' <user-data-dir>   # esperado: nada
```

Para mudar um fuse: edite `electronFuses` no `electron-builder.yml`, `FUSES_ESPERADOS` no `scripts/confere-build.sh` e a tabela acima. O script falha se um fuse não estiver no valor esperado.

## 4. Armadilhas

1. **Fuse novo mata o app no arm64.** Gravar um fuse altera bytes do `Electron Framework`, o que invalida a assinatura ad-hoc que o Electron já traz, e o kernel encerra o app com `SIGKILL` na abertura (saída 137, sem mensagem). Em build assinado o electron-builder reassina depois dos fuses, então não aparece. No `dist:sem-assinar` quem resolve é `resetAdHocDarwinSignature: true`.
2. **Tela bloqueada trava os testes com cookie cifrado.** Veja "Keychain" acima. Sintoma: a shell abre, as abas `http` não carregam e nenhum erro aparece. A causa ficou confirmada porque as mesmas cópias funcionaram com `--use-mock-keychain`.
3. **A captura de tela (`--captura`) saiu em branco em todos os testes desta rodada**, que rodaram com a tela bloqueada (inclusive com o Electron sem fuses, então não vem dos fuses). Não investiguei a causa. O `confere-build.sh` só confere que o arquivo existe e não está vazio, por isso, para olhar a imagem, rode com a sessão desbloqueada.
4. **`--remote-debugging-port` continua funcionando.** É uma opção do Chromium, não do Node, e nenhum fuse a controla. Quem consegue abrir o app com argumentos já executa código como o usuário, então não é uma fronteira nova, mas fica registrado: se a política for fechar isso em produção, é no código do processo principal (`app.commandLine`), não no empacotamento.
5. **Ao trocar de versão do Electron**, rode `read` de novo. Fuses novos entram com o padrão do Electron e só o `FUSES_ESPERADOS` dos sete conhecidos é conferido.
