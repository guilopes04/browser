#!/bin/sh
# Confere o resultado do "npm run dist": assinatura, hardened runtime, entitlements, Gatekeeper,
# ticket de notarização e se o app abre a partir do .dmg (monta, roda com --captura e desmonta).
#
#   scripts/confere-build.sh [--sem-notarizacao] [pasta-dist]
#
#   --sem-notarizacao  pula spctl e stapler (para builds ad-hoc ou sem assinar)
#   pasta-dist         padrão: $GILAS_DIST ou ~/Library/Caches/gilas-browser/dist
#   CONFERE_SAIDA=<pasta>  onde guardar a captura da janela (padrão: pasta temporária)
set -eu

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
NOTARIZADO=1
DIST=${GILAS_DIST:-$HOME/Library/Caches/gilas-browser/dist}
for arg in "$@"; do
  case "$arg" in
    --sem-notarizacao) NOTARIZADO=0 ;;
    -h | --ajuda) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) DIST=$arg ;;
  esac
done

falha() { printf 'ERRO: %s\n' "$1" >&2; exit 1; }
passo() { printf '\n--> %s\n' "$1"; }

VERSAO=$(node -p "require('$RAIZ/app/package.json').version")
APP="$DIST/mac-arm64/Gilas Browser.app"
DMG="$DIST/Gilas-Browser-$VERSAO-arm64.dmg"
ZIP="$DIST/Gilas-Browser-$VERSAO-arm64.zip"
[ -d "$APP" ] || falha "app não encontrado: $APP"
[ -f "$DMG" ] || falha "dmg não encontrado: $DMG"
[ -f "$ZIP" ] || falha "zip não encontrado: $ZIP"

passo 'Assinatura e hardened runtime'
codesign --verify --deep --strict "$APP" || falha 'a assinatura do app não passa na verificação'
INFO=$(codesign -dvv "$APP" 2>&1)
echo "$INFO" | grep -E 'Identifier=|Authority=|TeamIdentifier=|flags=|Timestamp=' || true
echo "$INFO" | grep -q 'flags=.*runtime' || falha 'hardened runtime desligado'
if [ "$NOTARIZADO" = 1 ]; then
  echo "$INFO" | grep -q 'Authority=Developer ID Application' || falha 'o app não está assinado com Developer ID Application'
  echo "$INFO" | grep -q 'Timestamp=' || falha 'a assinatura não tem carimbo de tempo seguro'
fi

passo 'Entitlements do app principal'
ENTS=$(codesign -d --entitlements - "$APP" 2>&1)
echo "$ENTS" | grep -E 'com\.apple\.' || true
echo "$ENTS" | grep -q 'allow-jit' || falha 'falta com.apple.security.cs.allow-jit (o V8 não roda sem ela)'
if echo "$ENTS" | grep -q 'web-browser.public-key-credential'; then
  falha 'a entitlement restrita de navegador está no app sem perfil de provisionamento: o macOS mata o app na abertura'
fi

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
  rm -rf "$TMP/ud" "$PONTO"
}
trap limpa EXIT
hdiutil attach "$DMG" -nobrowse -readonly -noverify -mountpoint "$PONTO" -quiet || falha 'não consegui montar o .dmg'
BIN="$PONTO/Gilas Browser.app/Contents/MacOS/Gilas Browser"
[ -x "$BIN" ] || falha 'o .dmg não tem Gilas Browser.app/Contents/MacOS/Gilas Browser'
CAPTURA="$SAIDA/captura-dmg.png"
rm -f "$CAPTURA"
"$BIN" --captura="$CAPTURA" --abas="$RAIZ/bench/tabs.json" --user-data-dir="$TMP/ud" > "$TMP/app.log" 2>&1 &
PID=$!
I=0
while kill -0 "$PID" 2>/dev/null && [ "$I" -lt 90 ]; do sleep 1; I=$((I + 1)); done
if kill -0 "$PID" 2>/dev/null; then falha 'o app não terminou a captura em 90 s'; fi
wait "$PID" || true
PID=''
[ -s "$CAPTURA" ] || { tail -20 "$TMP/app.log"; falha 'o app abriu do .dmg mas não gerou a captura'; }
echo "OK: o app abriu a partir do .dmg e gravou $CAPTURA ($(wc -c < "$CAPTURA" | tr -d ' ') bytes)"
printf '\nOK: %s (%s), %s (%s)\n' "$(basename "$DMG")" "$(du -h "$DMG" | cut -f1)" "$(basename "$ZIP")" "$(du -h "$ZIP" | cut -f1)"
