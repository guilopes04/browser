# Senhas do iCloud no Electron: evidência do teste (15/10/2026, madrugada)

## O que foi testado

1. `node` (processo sem assinatura de navegador) inicia o helper nativo
   `/System/Cryptexes/App/System/Library/CoreServices/PasswordManagerBrowserExtensionHelper.app/Contents/MacOS/PasswordManagerBrowserExtensionHelper`
   com o argumento `chrome-extension://pejdijmoenmkgeppbflobdenhhabjlaj/` e envia `{"cmd":0}` no framing de native messaging.
   Resultado: `exit code=null sig=SIGKILL` em 4 ms, sem nenhuma mensagem de volta.
2. O mesmo, com o **Electron 44.7.2 como processo pai** (spawn a partir do main process):
   `helper (pai = Electron) saiu em 2ms code=null sig=SIGKILL`.
3. `codesign -d -vvvv` no helper mostra **Launch Constraints: Self + Parent**. A constraint de pai é:
   - `entitlements: com.apple.developer.web-browser.public-key-credential == true`, **ou**
   - par (`signing-identifier`, `team-identifier`) numa lista fechada: Chrome (EQHXZ8M8AV), Edge (UBF8T346G9), Firefox (43AQ936H96), Arc/Dia (S6N382Y83G), Brave (KL8N8XSYF4), BrowserOS, Vivaldi, Helium, Opera, Kagi/Orion, ungoogled-chromium, **Zen (app.zen-browser.zen, 9V5K9TP787)**, Wavebox, Quark, Whale, QQ, Island, Yandex, Comet, CocCoc, OpenAI Atlas, Neo/Norton, Avast, Avira, AVG, Waterfox, Ecosia.

## Conclusão

- A extensão Senhas do iCloud **não funciona** num app Electron comum: o bloqueio está no kernel (AMFI/launch constraint), antes de qualquer API do Electron.
- O Electron também não implementa `chrome.runtime.connectNative`, mas isso é secundário: mesmo com um shim, o helper seria morto.
- Único caminho para as Senhas do iCloud: a Apple conceder a entitlement `com.apple.developer.web-browser.public-key-credential` ao bundle id do navegador, e o app ser assinado com Developer ID + provisioning profile que a inclua. Isso depende do Gilas (conta de desenvolvedor e pedido à Apple).
- Enquanto isso, a alternativa combinada no README (Bitwarden via extensão da Chrome Web Store) está sendo testada em `experiments/extensoes/`.

Arquivos: `bench/winlist.swift` (lista de janelas), sonda em `scratchpad/pwprobe/probe.js` (reproduzível com `node probe.js`).
