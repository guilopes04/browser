#!/bin/sh
# Auditoria antes de tornar o repositório público: procura dados pessoais e segredos
# nos arquivos que entrariam num commit (versionados e novos, fora do .gitignore) e no histórico.
# Sai com 1 se encontrar algo.
#   --so-arquivos     pula o histórico (o publica.sh reescreve o histórico num commit limpo
#                     e roda a auditoria completa sobre o resultado, antes de enviar)
#   AUDITA_REFS=<rev> audita o histórico só a partir desse ref (padrão: --all)
set -u
cd "$(dirname "$0")/.."
SO_ARQUIVOS=0
[ "${1:-}" = "--so-arquivos" ] && SO_ARQUIVOS=1
REFS=${AUDITA_REFS:---all}
PADROES='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|Q684XTAMJU|N72WPGA32N|gho_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]+|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|app-specific|senha de app:|password=|passwd|secret=|api[_-]?key|Bearer [A-Za-z0-9._-]{20,}|sk-[A-Za-z0-9]{20,}'
ACHOU=0
echo "== arquivos versionados e novos =="
# "deprecated" no package-lock traz o e-mail de contato de mantenedores de pacotes (não é dado nosso)
if git ls-files -z --cached --others --exclude-standard | xargs -0 grep -nIiE "$PADROES" 2>/dev/null | grep -vE '^scripts/audita-publicacao\.sh:|@exemplo\.invalid|^app/package-lock\.json:[0-9]+:[[:space:]]*"deprecated":'; then ACHOU=1; fi
if [ "$SO_ARQUIVOS" = 1 ]; then
  echo "== histórico: pulado (--so-arquivos) =="
else
  echo "== histórico ($REFS) =="
  # shellcheck disable=SC2086
  if git log -p $REFS 2>/dev/null | grep -nIiE "$PADROES" | grep -vE 'audita-publicacao|^[0-9]+:[[:space:]]*(Author|Co-Authored-By):|@exemplo\.invalid|^[0-9]+:[+ -][[:space:]]*"deprecated":|^[0-9]+:[+ -]PADROES=' | head -20 | grep .; then ACHOU=1; fi
fi
echo "== arquivos que nunca devem estar versionados =="
if git ls-files --cached --others --exclude-standard | grep -E '\.(key|p12|pem|cer|csr)$|apple-entitlement-pedido\.md|\.env(\.|$)|node_modules/'; then ACHOU=1; fi
if [ "$ACHOU" = 1 ]; then echo "BLOQUEADO: encontrado dado sensível. Não publicar."; exit 1; fi
echo "OK: nada sensível nos arquivos."
if [ "$SO_ARQUIVOS" = 1 ]; then
  echo "LEMBRETE: antes de tornar público, reescrever o histórico num único commit limpo (o primeiro commit tinha dados pessoais)."
else
  echo "OK: histórico limpo."
fi
exit 0
