---
title: Deploy Checklist
tags: [deploy, checklist, producao]
sources: [CLAUDE.md, wiki/erros-e-licoes.md]
updated: 2026-06-04
audited_at: 2026-06-04
---

# Deploy Checklist

> Consultar ANTES de cada deploy. Nenhum item pode ser ignorado.
> Coordenadas (ref/CLI/PAT) no `CLAUDE.md` → seção "🚀 Deploy & Supabase". Project ref ATUAL: `prfcbfumyrrycsrcrvms`.

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
- [ ] types.ts regenerado (`supabase gen types` — binário scoop, NÃO npx)
- [ ] RLS policies testadas

---

## Deploy

- [ ] `npm run build` sem erros
- [ ] Edge functions deployadas (`supabase functions deploy <nome> --project-ref prfcbfumyrrycsrcrvms --use-api` — binário scoop + PAT eletropiso; 403 = conta antiga)
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
