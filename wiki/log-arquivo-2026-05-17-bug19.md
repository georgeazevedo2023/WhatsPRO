---
title: Log arquivado — 2026-05-17 (fim tarde) Bug 19 v7.37.5
type: log-arquivo
archived_from: log.md
archived_at: 2026-05-18
---

# 2026-05-17 (fim tarde) — Bug 19 fix: IA alucina interesse:CAT sem o lead pedir (v7.37.5)

User mandou print: lead disse "boa tarde" + "George" (só nome) → IA respondeu "George, para qual material você está procurando a porta? Temos opções em madeira, PVC ou alumínio." LLM alucinou produto "porta" sem o lead mencionar nada.

**Root cause:** o handler `set_tags` (ai-agent:2712) não validava se `interesse:CAT` cravado pelo LLM tinha CONEXÃO com o que o lead falou. Quando input é trivial ("oi", "George"), o LLM chuta uma categoria pra "ter algo a perguntar". Sem guard, tag `interesse:porta` foi aceita + entrou no qualificationContext + LLM perguntou material da porta. Auto-extract (Bug 13) NÃO foi o culpado (regex `porta|portas` não bate em "George"/"boa tarde").

**Fix v7.37.5:**
1. **Guard determinístico no handler `set_tags`:** quando LLM tenta cravar `interesse:CAT`, validar que o regex `interesse_match` da categoria bate em pelo menos uma msg incoming do lead nesta sessão (contextMessages + incomingText atual). Se não bater, rejeitar + log `interesse_hallucination_blocked`.
2. **Regra hardcoded no prompt:** "NUNCA ASSUMIR PRODUTO/CATEGORIA (Bug 19): PROIBIDO chamar set_tags com interesse:X ou perguntar sobre produto se lead AINDA NÃO mencionou. Se lead só enviou saudação/nome, pergunte 'No que posso te ajudar?' — JAMAIS assuma."
3. **Migration:** event `interesse_hallucination_blocked` adicionado ao CHECK constraint de `ai_agent_logs` (lição R114 — insert silencioso). Também `auto_field_extracted` (já em uso, faltava no constraint).

**Validação E2E 5 cenários (Playwright + Sandbox UAZAPI):**
- C1 trivial ("oi" → "Pedro"): IA "Pedro, em que produto ou material posso te ajudar?" ✅ sem chute, tag `motivo:compra` só
- C2 "quero comprar tinta": sale_closed_detected disparou handoff prematuro (achado paralelo Bug 20 — sale_closed regex muito agressivo). Mas Bug 19 ok: sem `interesse:` alucinado
- C3 "vcs tem tinta?": IA qualificou ambiente. Guard PERMITIU `interesse:tinta` (regex bate). ✅
- C4 "vcs vendem cama de casal?": excluded reply ("Infelizmente não trabalhamos com cama..."). ✅
- C5 "bom dia" → "preciso de um material": "Qual material de construção você está procurando?" — pergunta genérica sem chutar. ✅

**Regra preventiva:** todo handler que persiste estado controlado por LLM (tags, profile, kanban move) precisa validar contra EVIDÊNCIA no histórico do lead, não confiar apenas no que o LLM mandar. LLM em input trivial CHUTA pra "ter o que fazer" — defesas determinísticas existem pra isso.

Arquivos: `ai-agent/index.ts` (+~30 linhas guard + 1 regra prompt), `migrations/20260517170000_ai_agent_logs_interesse_hallucination_event.sql`. Deploy ai-agent. Screenshots em `wiki/validacoes/`.

**Backlog Bug 20 (achado nos testes):** regex `sale_closed` em `saleClosedDetection.ts` casa "quero comprar X" mesmo SEM qualificação prévia. Lead deveria pelo menos ter passado por algumas qualif antes de virar venda fechada. Frase: *"investigar bug 20 sale_closed regex agressivo 2026-05-18"*.
