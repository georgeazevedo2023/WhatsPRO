# WhatsPRO Doc Check — Healthcheck do Vault

Quando o usuário invoca `/doc-check`, audite o vault em 3 dimensões e produza um relatório curto.

## 1. Hard limit 300 linhas

Execute via Bash:
```bash
bash scripts/check-md-length.sh
```

Reporte:
- ✅ Saudável (0 ofensores), OU
- ⚠️ Lista de arquivos > 300 linhas com sugestão de particionamento

## 2. Staleness de `audited_at`

Liste wikis ativas (em `wiki/*.md`, não em subpastas de arquivo) que:
- (a) Não têm `audited_at:` no frontmatter — **CANDIDATAS** pra auditar
- (b) Têm `audited_at:` há mais de **60 dias** comparado a today — **STALE**

```bash
# Lista wikis sem audited_at (excluir arquivo)
find wiki -maxdepth 1 -name "*.md" | while read f; do
  if ! grep -q "^audited_at:" "$f"; then
    echo "MISSING: $f"
  fi
done

# Lista com audited_at > 60 dias atrás
find wiki -maxdepth 1 -name "*.md" | while read f; do
  dt=$(grep "^audited_at:" "$f" | head -1 | sed 's/audited_at:\s*//')
  if [ -n "$dt" ]; then
    diff_days=$(( ($(date +%s) - $(date -d "$dt" +%s 2>/dev/null || echo 0)) / 86400 ))
    if [ "$diff_days" -gt 60 ]; then
      echo "STALE ($diff_days days): $f"
    fi
  fi
done
```

## 3. Wikis órfãs (não linkadas)

Identifique arquivos em `wiki/` que **não aparecem** em nenhum wikilink `[[...]]` de outro arquivo. Use grep agressivo:

```bash
find wiki -name "*.md" | while read f; do
  base=$(basename "$f" .md)
  # Conta quantos arquivos linkam pra esse (excluindo o próprio)
  count=$(grep -rl "\[\[.*${base}\]\]\|\[\[.*${base}|" --include="*.md" . | grep -v "^$f$" | wc -l)
  if [ "$count" -eq "0" ]; then
    echo "ORPHAN: $f"
  fi
done
```

## 4. Saída

Apresentar no formato:

```
📋 Doc Check — Vault WhatsPRO

✅ Hard limit 300: SAUDÁVEL (0 ofensores) [ou X ofensores listados]

📅 audited_at staleness:
   - Sem audited_at: N wikis [listar até 10]
   - Stale (>60d): N wikis [listar todas]

🔗 Wikis órfãs:
   - N órfãs [listar até 10]

🎯 Recomendações:
   1. [ação prioritária 1]
   2. [ação prioritária 2]
```

## 5. Auto-fix opcional

Se o usuário disser "fix" depois, pergunte qual dimensão:
- Particionar arquivos overflow
- Adicionar `audited_at: <today>` nas wikis sem o campo (apenas se revisado)
- Remover wikis órfãs ou adicionar ref no `index.md`

Sempre confirmar antes de aplicar mudanças destrutivas.
