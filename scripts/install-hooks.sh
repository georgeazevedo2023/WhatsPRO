#!/usr/bin/env bash
# Instala git hooks do projeto (.git/hooks/ não é versionado por padrão).
# Rodar uma vez após clonar o repo.

set -euo pipefail
HOOK_DIR=".git/hooks"
PRE_COMMIT="$HOOK_DIR/pre-commit"

cat > "$PRE_COMMIT" << 'HOOK'
#!/usr/bin/env bash
# Auto-instalado por scripts/install-hooks.sh
# Bloqueia commit se algum .md > 300 linhas (regra CLAUDE.md).

bash scripts/check-md-length.sh --strict
HOOK
chmod +x "$PRE_COMMIT"
echo "✅ Hook instalado: $PRE_COMMIT"
echo "   Rodando $PRE_COMMIT em cada commit."
