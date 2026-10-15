# Senhas: decisão de arquitetura (15/10/2026)

Base: `design/README.md` (decisões e incertezas), `docs/senhas-icloud-evidencia.md`, `docs/extensoes-no-electron.md`, `docs/apple-entitlement-pedido.md` (fora do git) e as fontes da web listadas no fim, todas abertas nesta data.

## 1. Veredito

O caminho principal é integrar as Senhas do iCloud direto no main process, sem extensão. Isso fica bloqueado até a Apple aprovar a entitlement de navegador, que já foi pedida. O Bitwarden não roda hoje no Electron e só vira plano B se a Apple negar.

## 2. Evidência

- O helper `PasswordManagerBrowserExtensionHelper` tem launch constraint de processo pai. Ele morre com SIGKILL em 2 ms quando o pai é o Electron 44.7.2 e em 4 ms quando é o `node`. Só passa se o pai tiver `com.apple.developer.web-browser.public-key-credential == true` ou estiver numa lista fechada de navegadores (Chrome, Zen e outros), conforme `docs/senhas-icloud-evidencia.md`.
- O bloqueio vem do kernel (AMFI), antes de qualquer API do Electron. Por isso nenhum shim ou `connectNative` resolve sem a entitlement.
- Bitwarden 2026.9.3 e uBlock Origin Lite carregam (`loadExtension` em ~30 ms), mas os dois service workers morrem no boot. O Bitwarden quebra por `chrome.webNavigation` e o uBOL por `chrome.permissions`. Das 105 APIs `chrome.*` que o Bitwarden usa, 41 faltam no service worker.
- Com stubs vazios, a popup do Bitwarden chega à tela de login e aceita digitação. Isso prova que as APIs que faltam são um conjunto finito, mas não prova que o autofill funcione. `alarms.onAlarm` nunca disparou em ~110 s, então o bloqueio automático e a sincronização ficariam quebrados. `webRequest` não entrega eventos.
- O pedido da entitlement saiu pelo formulário oficial em 15/10 às 02:24 (Request ID em `docs/apple-entitlement-pedido.md`). O certificado Developer ID Application e o perfil de notarização `browser-notary` já existem na keychain.

## 3. Caminho A: Senhas do iCloud

### 3.1 O formulário e o que a Apple pede (verificado na web)

- O formulário fica em https://developer.apple.com/contact/request/macos-browsers-passkeys/ e se chama "macOS Browsers Passkeys". Na página, o título é "Request the macOS Web Browser Public Key Credential Entitlement". A URL sai como link de pedido na página da entitlement, https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.web-browser.public-key-credential (lida pelo JSON da documentação). Sem login, o formulário redireciona para `idmsa.apple.com`, então não consegui reler os campos daqui. Os campos abaixo são os que o pedido enviado preencheu.
- Quem pode pedir: só quem tem o papel **Account Holder** da conta (segundo a documentação e um engenheiro da DTS no fórum 829169). Os outros papéis recebem "Your account can't access this page". Na conta individual do Gilas ele é o Account Holder, e o envio funcionou.
- Exige conta paga do Apple Developer Program (o pedido só passou depois de aceitar o Program License Agreement), com o bundle id já registrado como App ID (`com.gilas.browser`).
- Campos do formulário: nome do app, URL e Apple ID na App Store (vazios, porque o app não vai para a loja), bundle id, "é um navegador no macOS?", "suporta WebAuthn no conteúdo web?", "pretende integrar com passkeys do iCloud Keychain?" e um texto com a descrição do navegador e links para o código e para um build baixável.
- Critérios de revisão da documentação:
  - declarar os esquemas `http` e `https` no Info.plist;
  - ao abrir, oferecer um campo de URL, uma busca ou favoritos;
  - abrir uma URL http/https indo direto ao destino, sem redirecionar e sem alterar o conteúdo.
- Na aprovação, a Apple adiciona a entitlement à conta como **managed capability** (ajuda "Provisioning with managed capabilities"). Os perfis gerados para o App ID com essa capability passam a incluí-la. O tipo da entitlement é Boolean, para macOS 13.3+ e Mac Catalyst 16.3+.

### 3.2 O que o Gilas faz (passo a passo)

1. Feito: aceitar o contrato, registrar o App ID `com.gilas.browser` e enviar o pedido pelo formulário acima.
2. Feito: criar o certificado Developer ID Application e a credencial de notarização (`browser-notary`).
3. Falta: tornar o repositório público e publicar um build assinado e notarizado nas Releases, porque o pedido cita esses links. Ele já autorizou isso quando o app passar no crítico.
4. Falta: esperar o e-mail da Apple. Se ela pedir mais informações, responder ao e-mail com o link público do build.
5. Depois da aprovação, em Certificates, Identifiers & Profiles:
   - abrir Identifiers > `com.gilas.browser` e conferir se a capability aparece ativa (managed capabilities ficam na aba de capacidades adicionais do App ID);
   - em Profiles > +, escolher **Developer ID** (distribuição macOS), o App ID `com.gilas.browser` e o certificado Developer ID Application, e se pedir, marcar a entitlement gerenciada;
   - gerar, baixar e salvar em `app/build/browser-developer-id.provisionprofile`.

   Eu posso fazer isso na aba dele, como fiz com o formulário.
6. Testar o pareamento: o macOS mostra um PIN de 6 dígitos, o Gilas digita no navegador e confirma com Touch ID quando o Keychain pedir. Isso só ele pode fazer, porque usa o cofre real.

Conferir o perfil: `security cms -D -i app/build/browser-developer-id.provisionprofile | grep -A1 web-browser`.

### 3.3 O que muda no build

O `electron-builder` não está instalado no projeto e nada abaixo foi testado. Hoje só existe o `electron-vite` (a versão atual no npm é 26.15.3). A assinatura usa hardened runtime e Developer ID, e o perfil vai embutido como `Contents/embedded.provisionprofile`, o que a opção `provisioningProfile` faz. As opções `entitlements`, `entitlementsInherit`, `provisioningProfile`, `hardenedRuntime` (padrão true) e `notarize` foram conferidas no `scheme.json` do `app-builder-lib`.

`app/electron-builder.yml`:

```yaml
appId: com.gilas.browser
productName: Browser
directories:
  output: dist
files:
  - out/**
  - package.json
protocols:
  - name: Web
    schemes: [http, https]
mac:
  target:
    - target: dmg
      arch: [arm64]
    - target: zip
      arch: [arm64]
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist
  # só depois da aprovação da Apple:
  provisioningProfile: build/browser-developer-id.provisionprofile
  notarize: true
  extendInfo:
    NSCameraUsageDescription: Sites que você permitir podem usar a câmera.
    NSMicrophoneUsageDescription: Sites que você permitir podem usar o microfone.
```

Notarização pelo perfil já salvo na keychain:

```bash
APPLE_KEYCHAIN="$HOME/Library/Keychains/login.keychain-db" APPLE_KEYCHAIN_PROFILE=browser-notary npx electron-builder --mac
```

`app/build/entitlements.mac.plist` (app principal). Os três blocos marcados entram só quando o perfil existir. Uma entitlement restrita sem perfil embutido faz o macOS matar o app na abertura.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.device.camera</key><true/>
  <key>com.apple.security.device.audio-input</key><true/>
  <!-- depois da aprovação: -->
  <key>com.apple.developer.web-browser.public-key-credential</key><true/>
  <key>com.apple.application-identifier</key><string>TEAM_ID.com.gilas.browser</string>
  <key>com.apple.developer.team-identifier</key><string>TEAM_ID</string>
</dict>
</plist>
```

`app/build/entitlements.mac.inherit.plist` (helpers do Electron): só `com.apple.security.cs.allow-jit`, mais câmera e microfone se o renderer precisar. A entitlement restrita **não** vai nos helpers. Eles têm outros bundle ids (`com.gilas.browser.helper...`) que não batem com o perfil, e o processo que inicia o helper das Senhas é o main process, que é o pai que a launch constraint confere. `TEAM_ID` está em `docs/apple-entitlement-pedido.md`, que fica fora do git.

Verificar depois de assinar:
- `codesign -d --entitlements - dist/mac-arm64/Browser.app`
- `spctl -a -vv dist/mac-arm64/Browser.app`
- rodar de novo a sonda de `docs/senhas-icloud-evidencia.md` com o app assinado como pai. O helper precisa responder a `{"cmd":14}` em vez de levar SIGKILL.

### 3.4 O que ainda falta depois da aprovação (honesto)

A entitlement só destrava a abertura do helper. O Electron não tem `chrome.runtime.connectNative`, então o navegador precisa falar o protocolo do helper no main process.

A implementação de referência pública é **au2001/icloud-passwords-firefox** (https://github.com/au2001/icloud-passwords-firefox, Apache-2.0). A listagem original no AMO foi transferida para a Apple em 04/12/2024, e o repositório segue como alternativa de código aberto. Lendo `src/utils/api.ts`, `srp.ts` e `enums.ts`:

- **Transporte:** native messaging stdio, com host `com.apple.passwordmanager`, cada mensagem em JSON com 4 bytes de tamanho. O caminho do binário e as origens permitidas estão em `/Library/Google/Chrome/NativeMessagingHosts/com.apple.passwordmanager.json`: `pejdijmoenmkgeppbflobdenhhabjlaj` e `mfbcdcnpokpoajjciilocoachedjkima`. O main process inicia o helper passando uma dessas origens como argumento, como o Chrome faz. Não sei se o helper valida esse argumento.
- **Comandos (`cmd`):**
  - `GET_CAPABILITIES=14`, `HANDSHAKE=2`;
  - `GET_LOGIN_NAMES_FOR_URL=4`, `GET_PASSWORD_FOR_LOGIN_NAME=5`;
  - `SET_PASSWORD_FOR_LOGIN_NAME_AND_URL=6`, `NEW_ACCOUNT_FOR_URL=7`;
  - `TAB_EVENT=8`, `GET_ONE_TIME_CODES=16`, `END=0`.
- **Pareamento:** SRP-6a sobre o grupo de 3072 bits do RFC 5054 (g=5, SHA-256). O usuário SRP (`TID`) é aleatório, de 16 bytes, e a "senha" SRP é o **PIN de 6 dígitos** que o macOS mostra ao usuário. A troca é:
  1. o cliente manda `A` (`QID m0`, campo `PAKE` em base64, `PROTO` 1 = "SRP com verificação RFC", `HSTBRSR` = nome do navegador);
  2. o helper responde com `B` e o sal;
  3. o cliente manda `M`;
  4. o helper confirma com `HAMK` (`ErrCode` 1 = PIN errado).
- **Sessão:** depois do PIN, cada consulta vai em `SMSG.SDATA`, cifrada com AES-GCM, usando como chave os 16 primeiros bytes da chave compartilhada SRP e um IV de 16 bytes. Se o helper reiniciar, é preciso parear de novo.
- **Cobertura da referência:** listar contas do site, preencher, copiar e gerar senha estão prontos. Salvar conta nova, códigos de verificação e passkeys não estão. Os comandos 6, 7 e 16 existem no enum, mas o formato deles não está documentado ali, então precisariam de engenharia reversa.

Peças depois da aprovação:
1. Assinatura com o perfil e confirmação de que o helper responde. Meia peça.
2. Módulo `main/passwords/`: spawn, framing, SRP, AES-GCM e comandos 4 e 5, com testes contra um helper falso. Uma peça.
3. UI: pedir o PIN, sugerir contas no campo de login (script no mundo isolado), entrar no popover do escudo e copiar senha. Uma peça.
4. Salvar e atualizar senha (comandos 6 e 7). Meia a uma peça, com risco.
5. Passkeys sincronizadas, que a Apple espera porque o pedido respondeu "sim". O `app.configureWebAuthn({ touchID })` do Electron 44 só cria credenciais **presas ao aparelho, sem sincronizar no iCloud** (está no `electron.d.ts`). Passkeys do iCloud Keychain exigem um addon nativo com `ASAuthorizationWebBrowserPlatformPublicKeyCredentialProvider` e a interceptação de `navigator.credentials`. Uma a duas peças, não estudadas.

Total para senhas: ~3 peças. Passkeys: mais 1 a 2.

O código da referência é Apache-2.0. Se for portado, manter o aviso de licença e dizer o que mudou.

## 4. Caminho B: Bitwarden pela extensão

**Hoje não é viável.** O Bitwarden puro não inicia (service worker morto, popup em spinner). Também não há UI de `chrome.action` para abrir a popup, nem `alarms` funcionando para o bloqueio automático. Com stubs vazios ele chega ao login, mas nada indica que o autofill funcione sem implementações reais.

O que o navegador teria que implementar, com estimativa:

1. Camada de polyfill: preload no service worker (`ses.registerPreloadScript({ type: 'service-worker' })`) e nas páginas da extensão, falando com o main por IPC. Uma peça.
2. Modelo de abas e janelas: `tabs.query` com abas reais e `windowId` certo, `tabs.create/remove/getCurrent/update`, `windows.*` e eventos. Uma peça.
3. `webNavigation` (`onCommitted`, `onCompleted`, `onErrorOccurred`, `getAllFrames`, `getFrame`) e `permissions` (conceder o que está no manifest, com eventos). Uma peça.
4. `alarms.onAlarm`: timer no main que acorda o service worker. Meia peça.
5. UI da `chrome.action`: botão no rodapé da sidebar, badge e popup ancorada que fecha ao perder o foco. Uma peça visual.
6. `commands` (inclusive `_execute_action` e o atalho de autofill), `contextMenus` e `notifications`. Uma peça.
7. Validação real: login, desbloqueio, autofill e bloqueio por tempo com a conta do Gilas. Também exige que ele migre as senhas, exportando do app Senhas e importando no Bitwarden. Só ele faz.

Total: ~5,5 peças, mais o trabalho do Gilas.

A biblioteca `electron-chrome-extensions` 4.9.0 (02/07/2025) já cobre `action`, `tabs`, `windows`, `webNavigation`, `contextMenus`, `notifications` e `cookies`, com preload de service worker, e reduziria isso para ~3 peças. Ressalvas:
- a licença é GPL-3.0 ou uma licença paga (Patron), uma decisão do Gilas;
- a versão não foi testada no Electron 44;
- ela não cobre `permissions`, `alarms`, `commands.onCommand`, `webNavigation.onErrorOccurred` nem `tabs.captureVisibleTab`.

As peças 1, 2, 3 e 5 não são trabalho só de senhas. São a base de "extensões da Chrome Web Store", que já está no escopo do produto, e o uBlock Origin Lite quebra pelos mesmos motivos. Elas devem ser planejadas na peça de extensões, não na de senhas.

## 5. Recomendação final e escopo desta noite

**Recomendação:**
- Seguir com o Caminho A. Ele é o que o Gilas decidiu, o pedido já foi feito e a assinatura está pronta. A integração nativa (~3 peças) é menor e mais confiável que a camada de extensões para o Bitwarden (~5,5), e não depende de uma extensão de terceiros funcionar num Electron parcial.
- A arquitetura continua como está: nada depende de native messaging. As senhas entram depois como módulo do main (`main/passwords/`), sem passar por `session.extensions`.
- Se a Apple negar, o plano B é o Bitwarden em cima da camada de extensões, que será construída de qualquer forma.

**Entra nesta noite:**
- Este documento e o registro no progresso.
- Nenhum código de senhas. Sem a entitlement o helper não abre, então nada do módulo do protocolo pode ser validado contra o helper real.
- Se sobrar tempo depois das peças visuais e funcionais: o pipeline de build assinado e notarizado **sem** a entitlement restrita (seção 3.3 sem o perfil e sem os três blocos marcados). Ele serve à Release pública que o pedido da Apple cita e já deixa o encaixe pronto para o perfil. Isso exige instalar o `electron-builder` como dependência de desenvolvimento.

**Fica para depois:** as peças A1 a A5 (depois da aprovação) e toda a camada de extensões (peça de extensões, não de senhas).

## Fontes (abertas em 15/10/2026)

- Documentação da entitlement: https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.web-browser.public-key-credential (lida via `https://developer.apple.com/tutorials/data/documentation/bundleresources/entitlements/com.apple.developer.web-browser.public-key-credential.json`)
- Formulário: https://developer.apple.com/contact/request/macos-browsers-passkeys/ (exige login)
- Managed capabilities: https://developer.apple.com/help/account/reference/provisioning-with-managed-capabilities (a documentação aponta para https://help.apple.com/developer-account/#/dev38c81d4cd)
- Fórum, papel Account Holder: https://developer.apple.com/forums/thread/829169
- Fórum, título do formulário: https://developer.apple.com/forums/thread/837755
- Referência do protocolo: https://github.com/au2001/icloud-passwords-firefox (`src/utils/api.ts`, `src/utils/srp.ts`, `src/utils/enums.ts`, `src/ui/popup/challenge.tsx`)
- Opções do electron-builder: `https://unpkg.com/app-builder-lib/scheme.json` (`MacConfiguration`)
- electron-chrome-extensions: registro npm, README da versão 4.9.0
