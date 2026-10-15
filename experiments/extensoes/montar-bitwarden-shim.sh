#!/bin/bash
# Copia o Bitwarden para a pasta temporária e injeta os stubs no service worker e na popup.
# Uso: ./montar-bitwarden-shim.sh <pasta-destino>
set -eu
AQUI="$(cd "$(dirname "$0")" && pwd)"
DEST="$1"
rm -rf "$DEST" && mkdir -p "$DEST" && cp -R "$AQUI/bitwarden/." "$DEST/"
cp "$AQUI/shim/chrome-stubs.js" "$DEST/chrome-stubs.js"
# service worker: stubs antes de tudo
{ cat "$AQUI/shim/chrome-stubs.js"; echo ";"; cat "$AQUI/bitwarden/background.js"; } > "$DEST/background.js"
# popup: primeiro script da página
python3 -I - "$DEST/popup/index.html" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace('<head>', '<head><script src="../chrome-stubs.js"></script>', 1)
open(p, 'w').write(s)
PY
echo "montado em $DEST"
