#!/usr/bin/env bash
# Healthcheck do vault: lista arquivos .md > 300 linhas.
# Skills/commands em .claude/* e geradores em dist/ são ignorados.
# Uso: bash scripts/check-md-length.sh [--strict]

set -euo pipefail
LIMIT=300
STRICT=${1:-}

mapfile -t offenders < <(
  find . -name "*.md" \
    -not -path "./node_modules/*" \
    -not -path "./.git/*" \
    -not -path "./.claude/*" \
    -not -path "./public/*" \
    -not -path "./dist/*" \
    -not -path "./.planning/*" \
    -not -path "./test-results/*" \
    -not -path "./docs/*" 2>/dev/null \
  | xargs wc -l 2>/dev/null \
  | awk -v lim="$LIMIT" '$1 > lim && $2 != "total" {printf "%6d  %s\n", $1, $2}' \
  | sort -rn
)

if [ ${#offenders[@]} -eq 0 ]; then
  echo "✅ Vault saudável: nenhum .md acima de $LIMIT linhas."
  exit 0
fi

echo "⚠️  Arquivos acima de $LIMIT linhas:"
printf "%s\n" "${offenders[@]}"
echo ""
echo "Total ofensores: ${#offenders[@]}"

if [ "$STRICT" = "--strict" ]; then
  exit 1
fi
