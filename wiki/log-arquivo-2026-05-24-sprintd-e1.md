---
title: Log Arquivo — 2026-05-24 (Sprint D madrugada + E.1)
type: log-archive
---

# Log Arquivo — 2026-05-24 (madrugada)

> Entrada movida do `log.md` ativo (hard limit 300 linhas). Continuação em `log.md`.

---

## 2026-05-24 (madrugada) — EletropisoV2 router PROD + 36 erros TS zerados + Sprint E.1 memória longa (v7.45.1 + v7.46.0)

Sessão contínua via canal de controle WhatsApp. Usuário mandou: migrar EletropisoV2 pra router em prod (sem shadow), corrigir os 36 erros TS, e seguir pro próximo sprint.

**v7.45.1:** EletropisoV2 (`1062059a`) → `routing_mode='router'` em PROD (config validada: 24 cats + business_info + greeting). Rollback=monolith. Achado: monolito dava "Em que posso ajudar?" genérico a perguntas de produto ("telha brasilit") — router corrige. **36 erros TS do ai-agent zerados** (deno check 36→0, type-only, vitest sem regressão): SendTextMsgFn/SendPresenceFn/Logger→object + casts any em conversation/contact/instance/counterRow/greetResult + pfq local (CFA never) + loadActiveProfile(supabase as any) TS2589. Commits daf6502+ec8e9c4+6424489.

**v7.46.0 — Sprint E.1 (memória longa por lead):** pesquisa (Mem0/Zep/LangMem) → memória ESTRUTURADA, não vector (domínio bounded + Postgres). lead_profiles já era a tabela. migration aditiva (products_seen/qualification_stage/memory_updated_at). `leadMemory.ts`: buildLeadMemoryBlock injeta bloco key:value no topo de todo specialist; consolidateLeadMemory (fire-and-forget, sem LLM) deriva stage/products/interests de tool calls reais. greeting refinado p/ returning lead. **E2E real**: turno1 "sou Carlos, queria tinta" → captura (Carlos/tintas/3 produtos); turno2 retorno (conv limpa, lead_profiles mantido) → "Claro que lembro! Você estava vendo tintas, quer continuar?". 334 testes agent verdes. commit f6dcd94.

**Andamento Plano Orquestrador:** ~85% → **~88%** (Sprint E.1 de 3 pilares do E).

**Pendências:** Sprint E.2 (proatividade) + E.3 (RAG); monitorar EletropisoV2 router (0 runs ainda, tráfego baixo madrugada); D6 aposentar monolito após 30d; nome capturado quando vem junto com produto (product_specialist não persiste — edge case). 36 erros pré-existentes do whatsapp-webhook (fora de escopo).

**Frase de retomada:** *"Sprint E.1 memória longa shipped (v7.46.0). Próximo: Sprint E.2 proatividade (follow-ups) OU E.3 RAG; monitorar EletropisoV2 router em prod"*.
