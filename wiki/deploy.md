---
title: Deploy & Infraestrutura
tags: [deploy, docker, ci-cd, producao]
sources: [CLAUDE.md, supabase/config.toml, supabase/.temp/linked-project.json]
updated: 2026-06-04
audited_at: 2026-06-04
---

# Deploy & Infraestrutura

> Coordenadas resumidas no `CLAUDE.md` (seção "🚀 Deploy & Supabase"). Esta página é o detalhe.

## Produção (frontend)

| Item | Valor |
|------|-------|
| URL | crm.wsmart.com.br |
| Servidor | Hetzner CX42 (65.108.51.109) |
| Orquestração | Docker Swarm + Traefik + SSL |
| Gestão | Portainer (stack "whatspro") |
| Registry | ghcr.io/georgeazevedo2023/whatspro:latest |

## Supabase (backend)

| Item | Valor |
|------|-------|
| **Project ref ATUAL** | `prfcbfumyrrycsrcrvms` ⚠️ o antigo `euljumeflwtljegknawy` está MORTO (migração 2026-05-19) |
| Conta / Org | `eletropiso.wsmart@gmail.com` / org `mqebydjkmkvbmvzjfwgl` |
| URL | `https://prfcbfumyrrycsrcrvms.supabase.co` |
| PAT (deploy) | memória `reference_supabase_token_novo` — **NUNCA** colar o valor aqui (secret scanning bloqueia push) |

## CI/CD (frontend)

`git push origin master` → GitHub Actions → build → push para ghcr.io → Portainer atualiza a stack.

## Comandos

```bash
npm run dev              # Dev server local
npm run build            # Build produção
```

```powershell
# Deploy edge function — usar o BINÁRIO scoop, NÃO npx (npx falha com uv_spawn nesta máquina)
$env:SUPABASE_ACCESS_TOKEN = '<PAT eletropiso — ver memória reference_supabase_token_novo>'
supabase functions deploy <name> --project-ref prfcbfumyrrycsrcrvms --use-api
```

## Edge Functions Deploy

- ~32 funções em Deno; deploy individual via CLI scoop (`C:\Users\georg\scoop\shims\supabase.exe`).
- **`npx supabase` está QUEBRADO** nesta máquina (`node_modules/supabase/bin` vazio → `EUNKNOWN uv_spawn`). Usar sempre o binário scoop.
- **403 no deploy** = CLI logado na conta ANTIGA → exportar o PAT eletropiso (`reference_supabase_token_novo`).
- `--use-api` evita Docker e bundla os imports `_shared` automaticamente.
- **NUNCA** usar o MCP `deploy_edge_function` p/ fns com imports `_shared` (sobe conteúdo vazio → derruba prod). Só CLI.
- Secrets via Supabase dashboard / Vault (não .env).
- Pós-deploy: conferir `version`/`verify_jwt`/`ezbr_sha256` mudaram (`list_edge_functions`).

## Links

- [[wiki/deploy-checklist]] — Checklist de deploy
- [[wiki/arquitetura]] — Stack completa
