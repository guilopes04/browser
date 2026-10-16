#!/bin/sh
# Confere o resultado do "npm run dist": assinatura, hardened runtime, entitlements, fuses do Electron,
# integridade do app.asar, Gatekeeper, ticket de notarização e se o app abre a partir do .dmg
# (monta, roda com --captura e desmonta).
#
#   scripts/confere-build.sh [--sem-notarizacao] [--sem-assinatura] [pasta-dist]
#
#   --sem-notarizacao  pula spctl e stapler (para builds assinados só com ad-hoc)
#   --sem-assinatura   para o "npm run dist:sem-assinar": pula assinatura, entitlements e Gatekeeper e
#                      confere só fuses, asar e abertura
#   As duas opções abrem o app com --use-mock-keychain: cada build ad-hoc tem outro cdhash e o macOS
#   pediria acesso à keychain "Gilas Browser Safe Storage" (cifra dos cookies) a cada um
#   pasta-dist         padrão: $GILAS_DIST ou ~/Library/Caches/gilas-browser/dist
#   CONFERE_SAIDA=<pasta>  onde guardar a captura da janela (padrão: pasta temporária)
set -eu

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
NOTARIZADO=1
ASSINADO=1
DIST=${GILAS_DIST:-$HOME/Library/Caches/gilas-browser/dist}
for arg in "$@"; do
  case "$arg" in
    --sem-notarizacao) NOTARIZADO=0 ;;
    --sem-assinatura) NOTARIZADO=0; ASSINADO=0 ;;
    -h | --ajuda) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) DIST=$arg ;;
  esac
done

falha() { printf 'ERRO: %s\n' "$1" >&2; exit 1; }
passo() { printf '\n--> %s\n' "$1"; }

# valor esperado de cada fuse (nomes como o @electron/fuses os imprime). Mantenha igual ao electronFuses
# do app/electron-builder.yml e à tabela do docs/seguranca-build.md
FUSES_ESPERADOS='RunAsNode=Disabled
EnableCookieEncryption=Enabled
EnableNodeOptionsEnvironmentVariable=Disabled
EnableNodeCliInspectArguments=Disabled
EnableEmbeddedAsarIntegrityValidation=Enabled
OnlyLoadAppFromAsar=Enabled
GrantFileProtocolExtraPrivileges=Disabled'

# entitlements que o app não pode ter (o docs/seguranca-build.md explica cada uma)
ENTS_PROIBIDAS='cs.allow-unsigned-executable-memory
cs.allow-dyld-environment-variables
cs.disable-library-validation
device.camera
device.audio-input'

confere_fuses() { # <app>
  FUSES_BIN="$RAIZ/app/node_modules/@electron/fuses/dist/bin.js"
  [ -f "$FUSES_BIN" ] || falha "não achei $FUSES_BIN (rode npm ci em app/)"
  LIDOS=$(node "$FUSES_BIN" read --app "$1" 2>&1) || { echo "$LIDOS"; falha 'não consegui ler os fuses do app'; }
  echo "$LIDOS" | grep -E '^  [A-Za-z]+ is (Enabled|Disabled)$' | sed 's/ is / = /; s/^  undefined/  fuse 9 (sem nome no @electron\/fuses instalado, padrão do Electron)/'
  for esperado in $FUSES_ESPERADOS; do
    nome=${esperado%%=*}; valor=${esperado##*=}
    echo "$LIDOS" | grep -q "^  $nome is $valor\$" || falha "fuse $nome deveria estar $valor"
  done
}

confere_asar() { # <app>
  HASH=$(/usr/libexec/PlistBuddy -c 'Print :ElectronAsarIntegrity:Resources/app.asar:hash' "$1/Contents/Info.plist" 2>/dev/null) \
    || falha 'o Info.plist não tem ElectronAsarIntegrity para Resources/app.asar: com o fuse ligado o app não abriria'
  [ -n "$HASH" ] || falha 'o hash do app.asar no Info.plist está vazio'
  echo "ElectronAsarIntegrity: Resources/app.asar sha256 $HASH"
  [ -f "$1/Contents/Resources/app.asar" ] || falha 'falta Resources/app.asar'
  [ ! -e "$1/Contents/Resources/app" ] || falha 'existe uma pasta Resources/app solta ao lado do app.asar'
  [ ! -e "$1/Contents/Resources/app.asar.unpacked" ] || falha 'existe Resources/app.asar.unpacked: onlyLoadAppFromAsar quer tudo dentro do asar'
}

confere_entitlements() { # <rotulo> <caminho do bundle>
  E=$(codesign -d --entitlements - "$2" 2>&1)
  echo "$E" | grep -q 'cs.allow-jit' || falha "$1 sem com.apple.security.cs.allow-jit (o V8 não roda sem ela)"
  for chave in $ENTS_PROIBIDAS; do
    if echo "$E" | grep -q "com.apple.security.$chave"; then falha "$1 tem com.apple.security.$chave, que o app não pode ter"; fi
  done
  echo "$1: $(echo "$E" | grep -o 'com\.apple\.[A-Za-z.-]*' | sort -u | tr '\n' ' ')"
}

VERSAO=$(node -p "require('$RAIZ/app/package.json').version")
APP="$DIST/mac-arm64/Gilas Browser.app"
DMG="$DIST/Gilas-Browser-$VERSAO-arm64.dmg"
ZIP="$DIST/Gilas-Browser-$VERSAO-arm64.zip"
[ -d "$APP" ] || falha "app não encontrado: $APP"
[ -f "$DMG" ] || falha "dmg não encontrado: $DMG"
[ -f "$ZIP" ] || falha "zip não encontrado: $ZIP"

if [ "$ASSINADO" = 1 ]; then
  passo 'Assinatura e hardened runtime'
  codesign --verify --deep --strict "$APP" || falha 'a assinatura do app não passa na verificação'
  INFO=$(codesign -dvv "$APP" 2>&1)
  echo "$INFO" | grep -E 'Identifier=|Authority=|TeamIdentifier=|flags=|Timestamp=' || true
  echo "$INFO" | grep -q 'flags=.*runtime' || falha 'hardened runtime desligado'
  if [ "$NOTARIZADO" = 1 ]; then
    echo "$INFO" | grep -q 'Authority=Developer ID Application' || falha 'o app não está assinado com Developer ID Application'
    echo "$INFO" | grep -q 'Timestamp=' || falha 'a assinatura não tem carimbo de tempo seguro'
  fi

  passo 'Entitlements do app principal e dos helpers (só allow-jit)'
  confere_entitlements 'Gilas Browser.app' "$APP"
  if codesign -d --entitlements - "$APP" 2>&1 | grep -q 'web-browser.public-key-credential'; then
    falha 'a entitlement restrita de navegador está no app sem perfil de provisionamento: o macOS mata o app na abertura'
  fi
  HELPERS=0
  for h in "$APP"/Contents/Frameworks/*.app; do
    [ -d "$h" ] || continue
    confere_entitlements "$(basename "$h")" "$h"
    HELPERS=$((HELPERS + 1))
  done
  [ "$HELPERS" -gt 0 ] || falha 'não achei os helpers em Contents/Frameworks'
fi

passo 'Fuses do Electron'
confere_fuses "$APP"

passo 'Integridade do app.asar'
confere_asar "$APP"

if [ "$NOTARIZADO" = 1 ]; then
  passo 'Gatekeeper e ticket de notarização'
  SPCTL=$(spctl -a -vv -t install "$APP" 2>&1) || { echo "$SPCTL"; falha 'o Gatekeeper rejeitou o app'; }
  echo "$SPCTL"
  echo "$SPCTL" | grep -q 'Notarized Developer ID' || falha 'o app foi aceito, mas não como Notarized Developer ID'
  xcrun stapler validate "$APP" || falha 'o app não tem o ticket de notarização grampeado'
  xcrun stapler validate "$DMG" || falha 'o .dmg não tem o ticket de notarização grampeado'
  SPCTL_DMG=$(spctl -a -vv -t open --context context:primary-signature "$DMG" 2>&1) || { echo "$SPCTL_DMG"; falha 'o Gatekeeper rejeitou o .dmg'; }
  echo "$SPCTL_DMG"
fi

passo 'Abrindo o app a partir do .dmg'
TMP=$(mktemp -d "${TMPDIR:-/tmp}/gilas-confere.XXXXXX")
PONTO="$TMP/volume"
SAIDA=${CONFERE_SAIDA:-$TMP}
mkdir -p "$PONTO" "$SAIDA"
PID=''
limpa() {
  [ -z "$PID" ] || kill "$PID" 2>/dev/null || true
  pkill -f "$TMP/ud" 2>/dev/null || true
  hdiutil detach "$PONTO" -quiet 2>/dev/null || hdiutil detach "$PONTO" -force -quiet 2>/dev/null || true
  rm -rf "$TMP"/ud* "$PONTO"
}
trap limpa EXIT
hdiutil attach "$DMG" -nobrowse -readonly -noverify -mountpoint "$PONTO" -quiet || falha 'não consegui montar o .dmg'
BIN="$PONTO/Gilas Browser.app/Contents/MacOS/Gilas Browser"
[ -x "$BIN" ] || falha 'o .dmg não tem Gilas Browser.app/Contents/MacOS/Gilas Browser'
echo 'Fuses do app dentro do .dmg (o que o usuário recebe):'
confere_fuses "$PONTO/Gilas Browser.app"
# sem Developer ID, cada build ad-hoc tem outro cdhash e o macOS pediria acesso à keychain
# "Gilas Browser Safe Storage" (cifra dos cookies); com a tela bloqueada o pedido trava o app
KEYCHAIN_ARG=''
[ "$NOTARIZADO" = 1 ] || KEYCHAIN_ARG='--use-mock-keychain'
CAPTURA="$SAIDA/captura-dmg.png"
rm -f "$CAPTURA"
"$BIN" $KEYCHAIN_ARG --captura="$CAPTURA" --abas="$RAIZ/bench/tabs.json" --user-data-dir="$TMP/ud" > "$TMP/app.log" 2>&1 &
PID=$!
I=0
while kill -0 "$PID" 2>/dev/null && [ "$I" -lt 90 ]; do sleep 1; I=$((I + 1)); done
if kill -0 "$PID" 2>/dev/null; then falha 'o app não terminou a captura em 90 s'; fi
# a saída tem de ser 0: o app que cai ao encerrar (133 = SIGTRAP) já gravou a captura e passaria por bom
SAIDA_APP=0
wait "$PID" || SAIDA_APP=$?
PID=''
[ -s "$CAPTURA" ] || { tail -20 "$TMP/app.log"; falha 'o app abriu do .dmg mas não gerou a captura'; }
[ "$SAIDA_APP" -eq 0 ] || { tail -20 "$TMP/app.log"; falha "o app gravou a captura mas saiu com código $SAIDA_APP (esperado 0; 133 é SIGTRAP, uma queda no encerramento)"; }
echo "OK: o app abriu a partir do .dmg, gravou $CAPTURA ($(wc -c < "$CAPTURA" | tr -d ' ') bytes) e saiu com 0"

passo 'ELECTRON_RUN_AS_NODE=1 não pode virar Node'
ELECTRON_RUN_AS_NODE=1 "$BIN" $KEYCHAIN_ARG --user-data-dir="$TMP/ud-node" -e "console.log('NODE_PURO')" > "$TMP/node.log" 2>&1 &
PID=$!
I=0
while kill -0 "$PID" 2>/dev/null && [ "$I" -lt 5 ]; do sleep 1; I=$((I + 1)); done
if kill -0 "$PID" 2>/dev/null; then
  echo 'OK: com a variável ligada o app abriu normal (ficou rodando) em vez de executar como Node'
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
else
  wait "$PID" || true
  grep -q 'NODE_PURO' "$TMP/node.log" && falha 'ELECTRON_RUN_AS_NODE=1 ainda executa o binário como Node: o fuse runAsNode está ligado'
  tail -5 "$TMP/node.log"
  falha 'com ELECTRON_RUN_AS_NODE=1 o app saiu em menos de 5 s (esperado: abrir normal)'
fi
PID=''
pkill -f "$TMP/ud-node" 2>/dev/null || true
printf '\nOK: %s (%s), %s (%s)\n' "$(basename "$DMG")" "$(du -h "$DMG" | cut -f1)" "$(basename "$ZIP")" "$(du -h "$ZIP" | cut -f1)"
