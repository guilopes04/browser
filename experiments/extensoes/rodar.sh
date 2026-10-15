#!/bin/bash
# Roda o harness para uma extensão, com perfil temporário e log do Chromium.
# Uso: ./rodar.sh <nome> <pasta-da-extensao> [caminho-do-popup]
# Variáveis: SCRATCH_DIR (perfis temporários), WAIT_MS, AGUARDAR_SONDA
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
NOME="$1"; EXT="$2"; POPUP="${3:-popup/index.html}"
SCRATCH_DIR="${SCRATCH_DIR:-/private/tmp/claude-501/-Users-guilhermelopes-Documents-Projects-navegador/b8b36086-abf3-450d-9b8c-7e0b2ae630f8/scratchpad/extensoes}"
PERFIL="$SCRATCH_DIR/perfil-$NOME"
mkdir -p "$SCRATCH_DIR" "$AQUI/logs"
[ -f "$AQUI/apis-usadas-$NOME.json" ] || node "$AQUI/analisar-apis-usadas.js" "$EXT" "$AQUI/apis-usadas-$NOME.json" >/dev/null
cd "$AQUI/../../app" || exit 1
SAIDA_JSON="$AQUI/resultado-$NOME.json"; [ "$NOME" = "bitwarden" ] && SAIDA_JSON="$AQUI/resultado.json"
# O Electron às vezes trava a thread principal logo após loadExtension; por isso tenta até 2 vezes.
for TENTATIVA in 1 2; do
  rm -f "$SAIDA_JSON"
  EXT_DIR="$EXT" EXT_NAME="$NOME" POPUP_PATH="$POPUP" PROFILE_DIR="$PERFIL" \
    ./node_modules/.bin/electron --enable-logging=stderr --v=0 "$AQUI/harness.js" \
    > "$AQUI/logs/$NOME-electron.log" 2>&1 &
  PID=$!
  for i in $(seq 1 ${LIMITE_S:-60}); do kill -0 $PID 2>/dev/null || break; sleep 1; done
  kill -0 $PID 2>/dev/null && echo "tentativa $TENTATIVA: estourou o limite, matando"
  pkill -9 -f "Electron.*harness.js" 2>/dev/null
  sleep 1
  [ -f "$SAIDA_JSON" ] && break
done
echo "tentativas: $TENTATIVA; processos restantes: $(pgrep -f 'Electron.*harness.js' | wc -l)"
