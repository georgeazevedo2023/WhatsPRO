---
title: Deploy Checklist
tags: [deploy, checklist, producao]
sources: [CLAUDE.md, wiki/erros-e-licoes.md]
updated: 2026-04-05
---

# Deploy Checklist

> Consultar ANTES de cada deploy. Nenhum item pode ser ignorado.

---

## Pré-Deploy

### Código
- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)
- [ ] Testes passam 100% (`npx vitest run`)
- [ ] Build produção OK (`npm run build`)
- [ ] Nenhum `console.log` de debug
- [ ] Nenhum `as any` novo

### Segurança
- [ ] Token UAZAPI nunca exposto no frontend
- [ ] Auth manual em edge functions novas
- [ ] RLS habilitado em tabelas novas
- [ ] Secrets via Supabase Vault (não .env)

### AI Agent (se alterado)
- [ ] SYNC RULE verificada (8 locais sincronizados)
- [ ] Sequência de correção respeitada (Código → Validator → FAQ → Handoff)
- [ ] E2E test batch executado e aprovado
- [ ] Validator rules atualizadas se necessário

### Banco de Dados
- [ ] Migrations testadas localmente
- [ ] types.ts regenerado (`npx supabase gen types`)
- [ ] RLS policies testadas

---

## Deploy

- [ ] `npm run build` sem erros
- [ ] Edge functions deployadas (`npx supabase functions deploy <nome>`)
- [ ] Docker build + push para ghcr.io
- [ ] Stack atualizada no Portainer
- [ ] Smoke test: login → helpdesk → enviar mensagem → AI responde

---

## Pós-Deploy

- [ ] Registrar em `log.md`
- [ ] Atualizar `wiki/roadmap.md`
- [ ] Verificar Supabase dashboard (erros, usage)
- [ ] Monitorar health-check endpoint
- [ ] Testar fluxo completo em produção

## Links

- [[wiki/erros-e-licoes]] — Erros para não repetir
- [[wiki/deploy]] — Infraestrutura
- [[wiki/ai-agent]] — Se alterou o agente
