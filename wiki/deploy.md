---
title: Deploy & Infraestrutura
tags: [deploy, docker, ci-cd, producao]
sources: [CLAUDE.md]
updated: 2026-04-05
---

# Deploy & Infraestrutura

## Produção

| Item | Valor |
|------|-------|
| URL | crm.wsmart.com.br |
| Servidor | Hetzner CX42 (65.108.51.109) |
| Orquestração | Docker Swarm + Traefik + SSL |
| Gestão | Portainer (stack "whatspro") |
| Registry | ghcr.io/georgeazevedo2023/whatspro:latest |

## CI/CD

GitHub Actions → build → push para ghcr.io → deploy via Portainer

## Comandos

```bash
npm run dev              # Dev server local
npm run build            # Build produção
npx supabase functions deploy <name>  # Deploy edge function
```

## Edge Functions Deploy

- 30 funções em Deno
- Deploy individual: `npx supabase functions deploy <nome>`
- Secrets via Supabase dashboard (não .env)

## Links

- [[wiki/deploy-checklist]] — Checklist de deploy
- [[wiki/arquitetura]] — Stack completa
