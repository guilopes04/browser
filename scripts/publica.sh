#!/bin/sh
# Constrói o Gilas Browser assinado e notarizado e, com --publicar, publica a release.
#
#   scripts/publica.sh                só constrói e confere (assinatura, Gatekeeper, ticket de notarização)
#   scripts/publica.sh --publicar     constrói, confere e publica no GitHub (veja "Publicar" abaixo)
#   --notas=<arquivo>                 notas da release (padrão: texto gerado com os hashes dos arquivos)
#   --sem-build                       reaproveita o que já está na pasta de saída (não refaz build nem notarização)
#   GILAS_COMMIT_EMAIL=<e-mail>       e-mail do commit limpo (padrão: o do git config, que fica público)
#   GILAS_DIST=<pasta>/dist           onde o build sai (padrão: ~/Library/Caches/gilas-browser/dist; fora do
#                                     ~/Documents, porque o iCloud põe FinderInfo no .app e o codesign recusa)
#
# Precisa do certificado "Developer ID Application" e do perfil de notarização browser-notary na keychain.
#
# Publicar (só com --publicar), nesta ordem:
#   1. reescreve o histórico num único commit limpo (backup em .bundle fora do repositório);
#   2. audita o commit limpo inteiro e para se achar dado pessoal;
#   3. envia o commit com push --force para main;
#   4. cria a release v<versão> com o .dmg e o .zip (a tag nasce no commit limpo);
#   5. torna o repositório público.
# A release vem depois do push de propósito: criada antes, a tag apontaria para o histórico antigo.
# Limite: o GitHub guarda por um tempo os commits antigos soltos, acessíveis pelo hash. Se o histórico
# antigo já esteve no GitHub e o dado era sensível, o mais seguro é recriar o repositório vazio.
set -eu

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
APP_DIR="$RAIZ/app"
REPO=guilopes04/browser
PUBLICAR=0
SEM_BUILD=0
NOTAS=''

passo() { printf '\n==> %s\n' "$1"; }
aviso() { printf 'AVISO: %s\n' "$1"; }
falha() { printf 'ERRO: %s\n' "$1" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --publicar) PUBLICAR=1 ;;
    --sem-build) SEM_BUILD=1 ;;
    --notas=*) NOTAS=${arg#--notas=} ;;
    -h | --ajuda) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) falha "argumento desconhecido: $arg (use --ajuda)" ;;
  esac
done

cd "$RAIZ"
VERSAO=$(node -p "require('$APP_DIR/package.json').version")
DIST=${GILAS_DIST:-$HOME/Library/Caches/gilas-browser/dist}
export GILAS_DIST="$DIST"
case "$DIST" in */dist) ;; *) falha 'GILAS_DIST deve terminar em /dist (a pasta é apagada a cada build)' ;; esac
DMG="$DIST/Gilas-Browser-$VERSAO-arm64.dmg"
ZIP="$DIST/Gilas-Browser-$VERSAO-arm64.zip"

# a) auditoria dos arquivos. O histórico antigo tem dado pessoal e só é descartado no passo
# de publicação, que audita o histórico novo (completo) antes de enviar qualquer coisa.
passo "1/4 Auditoria de dados sensíveis nos arquivos"
sh "$RAIZ/scripts/audita-publicacao.sh" --so-arquivos || falha 'a auditoria encontrou dado sensível; nada foi construído'

# b) build assinado e notarizado (o "npm run dist" espera a Apple, alguns minutos)
passo "2/4 Build assinado e notarizado (v$VERSAO)"
if [ "$SEM_BUILD" = 1 ]; then
  echo "Pulando o build (--sem-build): usando $DIST"
else
  # Teste rápido da chave: se a keychain pedir autorização, o codesign fica parado num diálogo do macOS.
  # Melhor descobrir agora do que no meio do build.
  IDENTIDADE=$(security find-identity -v -p codesigning | sed -n 's/.*\([0-9A-F]\{40\}\) "Developer ID Application.*/\1/p' | head -n 1)
  [ -n "$IDENTIDADE" ] || falha 'não achei o certificado "Developer ID Application" na keychain'
  TESTE=$(mktemp -d "${TMPDIR:-/tmp}/gilas-chave.XXXXXX")
  cp /bin/echo "$TESTE/teste"
  codesign --sign "$IDENTIDADE" --force --timestamp "$TESTE/teste" >/dev/null 2>&1 &
  TESTE_PID=$!
  echo 'Testando a chave de assinatura (se o macOS abrir um diálogo da keychain, aprove: senha do login e Sempre permitir)...'
  I=0
  while kill -0 "$TESTE_PID" 2>/dev/null && [ "$I" -lt 120 ]; do sleep 1; I=$((I + 1)); done
  if kill -0 "$TESTE_PID" 2>/dev/null; then
    kill "$TESTE_PID" 2>/dev/null || true
    rm -rf "$TESTE"
    falha 'o codesign ficou esperando a keychain: aprove o diálogo "codesign quer assinar usando a chave" (senha do login e Sempre permitir) e rode de novo'
  fi
  wait "$TESTE_PID" || { rm -rf "$TESTE"; falha 'o codesign não conseguiu assinar com a chave Developer ID'; }
  rm -rf "$TESTE"
  rm -rf "$DIST"
  (cd "$APP_DIR" && npm run dist)
fi

# c) conferência independente do que o electron-builder fez (assinatura, Gatekeeper, ticket, abrir do .dmg)
passo "3/4 Conferindo assinatura, Gatekeeper, notarização e abertura pelo .dmg"
sh "$RAIZ/scripts/confere-build.sh" "$DIST" || falha 'a conferência do build falhou'

# e) sem --publicar, termina aqui
if [ "$PUBLICAR" = 0 ]; then
  passo "4/4 Pronto (sem --publicar nada foi enviado)"
  echo "$DMG"
  exit 0
fi

# d) publicar
passo "4/4 Publicando em github.com/$REPO"
command -v gh >/dev/null 2>&1 || falha 'gh (GitHub CLI) não está instalado'
gh auth status >/dev/null 2>&1 || falha 'gh não está autenticado (gh auth login)'
[ -z "$NOTAS" ] || [ -f "$NOTAS" ] || falha "arquivo de notas não encontrado: $NOTAS"

# o histórico antigo só some do GitHub se main for a única ref: outras branches e tags o manteriam público
OUTRAS=$(git ls-remote --heads --tags origin | grep -v 'refs/heads/main$' || true)
[ -z "$OUTRAS" ] || { echo "$OUTRAS"; falha 'o remoto tem outras branches ou tags; apague-as antes, senão o histórico antigo continua acessível'; }
if gh release view "v$VERSAO" --repo "$REPO" >/dev/null 2>&1; then falha "a release v$VERSAO já existe em $REPO"; fi

EMAIL=${GILAS_COMMIT_EMAIL:-$(git config user.email || true)}
[ -n "$EMAIL" ] || falha 'sem e-mail para o commit: configure git config user.email ou GILAS_COMMIT_EMAIL'
aviso "o commit público vai levar o e-mail $EMAIL (troque por um noreply do GitHub com GILAS_COMMIT_EMAIL, se preferir)"
NOME=$(git config user.name || echo 'Guilherme Lopes')

BACKUP="${TMPDIR:-/tmp}/gilas-historico-antes-da-publicacao-$(date +%Y%m%d-%H%M%S).bundle"
git bundle create "$BACKUP" --all >/dev/null 2>&1 || falha 'não consegui criar o backup do histórico'
echo "Backup do histórico antigo: $BACKUP"

ATUAL=$(git symbolic-ref --short HEAD)
git checkout --orphan limpo
git add -A
git -c "user.name=$NOME" -c "user.email=$EMAIL" commit -q -m "feat(app): Gilas Browser v$VERSAO"

# 2. auditoria completa do histórico novo (só o commit limpo); se falhar, volta sem perder nada no disco
if ! AUDITA_REFS=limpo sh "$RAIZ/scripts/audita-publicacao.sh"; then
  git symbolic-ref HEAD "refs/heads/$ATUAL"
  git reset -q "$ATUAL"
  git branch -D limpo >/dev/null
  falha "o commit limpo não passou na auditoria; o histórico original foi mantido (backup: $BACKUP)"
fi

git branch -M main
git push --force origin main
COMMIT=$(git rev-parse HEAD)

# notas da release
if [ -z "$NOTAS" ]; then
  NOTAS="$DIST/notas-v$VERSAO.md"
  {
    echo "Gilas Browser v$VERSAO, para Mac com Apple Silicon."
    echo
    echo "Abra o .dmg e arraste o app para Aplicativos. O app é assinado com Developer ID e notarizado pela Apple."
    echo
    echo 'SHA-256:'
    echo
    echo '```'
    (cd "$DIST" && shasum -a 256 "$(basename "$DMG")" "$(basename "$ZIP")")
    echo '```'
  } > "$NOTAS"
fi

gh release create "v$VERSAO" --repo "$REPO" --target "$COMMIT" --title "Gilas Browser v$VERSAO" --notes-file "$NOTAS" "$DMG" "$ZIP"
gh repo edit "$REPO" --visibility public --accept-visibility-change-consequences

passo "Publicado"
echo "https://github.com/$REPO/releases/tag/v$VERSAO"
