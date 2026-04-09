---
title: Erros e Lições
tags: [erros, bugs, licoes, preventivo]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-09
---

# Erros e Lições

> Consultado no INÍCIO de cada sessão. Verifique se o erro que você está prestes a cometer já está aqui.

---

## Regras Preventivas (resumo rápido)

| # | Regra | Origem |
|---|-------|--------|
| 1 | NUNCA reportar dados falsos — só confirmar após teste E2E completo | Regra de integridade |
| 2 | NUNCA dar nota/score parcial e depois mudar para pior | Regra de integridade |
| 3 | Token UAZAPI NUNCA no frontend — sempre via uazapi-proxy | Segurança |
| 4 | Não selecionar campo `token` da tabela `instances` no frontend | Segurança |
| 5 | types.ts só via `npx supabase gen types` — NUNCA editar manual | Padrão |
| 6 | Debounce NO RETRY on 500 — é timeout do gateway, não crash | AI Agent |
| 7 | Empty LLM response = silêncio — NUNCA enviar fallback ao lead | AI Agent |
| 8 | NUNCA dizer "não encontrei/não temos" ao lead — usar [INTERNO] | AI Agent |
| 9 | Clear context: tags = ['ia_cleared:TIMESTAMP'] — NUNCA [] (quebra handoff counter) | AI Agent |
| 10 | Shadow mode NUNCA sobrescreve full_name existente | AI Agent |
| 11 | Greeting + question: enviar greeting E continuar para LLM responder | AI Agent |
| 12 | SYNC RULE: alteração em feature do AI Agent deve sincronizar 8 locais | Consistência |
| 13 | Sequência de correção: Código → Validator → FAQ → Handoff (nunca pular) | AI Agent |
| 14 | `?? 0` ao incrementar contadores do DB — undefined/null → NaN silencioso | Forms |
| 15 | NUNCA setState fora de useEffect/handler; guards com return DEPOIS dos hooks | React |
| 16 | Getters NUNCA com side effects — separar leitura de transição de estado | Arquitetura |
| 17 | NUNCA check-then-insert em unique key — usar upsert ON CONFLICT | DB |
| 18 | NUNCA `.reverse()` / `.sort()` em arrays externos — usar `.slice().reverse()` | JS |
| 19 | NUNCA duplicar FIELD_MAP — usar `leadHelper.ts` compartilhado | Integrações |
| 20 | Bio lead captures DEVEM criar contact + lead_profile real — dados isolados são invisíveis | Bio Link |
| 21 | Todo sistema de captação DEVE setar `lead_profiles.origin` e tags `origem:X` | Atribuição |
| 22 | Edge functions admin-* DEVEM usar `getDynamicCorsHeaders(req)` e `verify_jwt=false` — gateway sem CORS headers bloqueia localhost e domínios diferentes | CORS |
| 23 | CORS estático (`browserCorsHeaders`) não funciona com múltiplas origens — usar `getDynamicCorsHeaders(req)` que checa Origin vs whitelist + localhost | CORS |
| 24 | `instances.id` é TEXT (não UUID) — FK para instances deve usar TEXT | DB |

---

## Histórico de Erros

### Duplicate greeting (pré v1.0)

**O que:** Greeting duplicado quando debounce disparava múltiplas chamadas simultâneas.
**Causa:** Sem lock atômico no greeting.
**Correção:** greeting_sent check nos últimos 30s + save-first lock.
**Regra:** Greeting race guard obrigatório.

### Debounce retry criando execuções duplicadas

**O que:** Retry no 500 do ai-agent causava duplicação de respostas.
**Causa:** 500 é timeout do gateway Supabase (~25s), não crash — a função continua rodando.
**Correção:** Removido retry completamente.
**Regra 6:** Debounce NO RETRY on 500.

### Clear context com tags vazias

**O que:** `tags = []` quebrava o handoff counter, causando handoff imediato na próxima mensagem.
**Causa:** Lógica de contagem dependia de tags não-vazias.
**Correção:** `tags = ['ia_cleared:TIMESTAMP']` ao invés de `[]`.
**Regra 9:** NUNCA usar tags vazias em clear context.

### Shadow sobrescrevendo nome do lead

**O que:** "Obrigado Pedro!" fazia shadow mode sobrescrever nome do lead com nome do vendedor.
**Causa:** Shadow extraía qualquer nome mencionado na conversa.
**Correção:** Shadow NUNCA sobrescreve full_name existente no lead_profile.
**Regra 10:** Shadow name protection.

---

### form-bot retries NaN — bypass silencioso de validação (2026-04-06)

**O que:** Formulário nunca abandonava após máximo de retries — campo com erro podia ser ignorado infinitamente.
**Causa:** `session.retries` vinha `undefined` do DB (coluna sem default no insert). `undefined + 1 = NaN`, `NaN >= 3 = false` → condição de abandono jamais ativada.
**Correção:** `(session.retries ?? 0) + 1` — nullish coalescing garante que undefined/null vira 0.
**Regra:** Sempre usar `?? 0` ao incrementar contadores que vêm do banco — o DB pode retornar null/undefined para colunas sem default.

### setState durante render — freeze/loop de re-render (2026-04-06)

**O que:** `WhatsappFormsPage` chamava `setSelectedAgentId(agents[0].id)` direto no body do componente. React lança warning "Cannot update a component while rendering a different component" e pode entrar em loop infinito.
**Causa:** Auto-select do primeiro agente foi escrito como lógica condicional no render, fora de efeito.
**Correção:** Movido para `useEffect([agents, selectedAgentId])`. Guard de redirect (`if (!isSuperAdmin)`) deve vir DEPOIS de todos os hooks — React exige ordem constante.
**Regra:** NUNCA chamar setState fora de handler ou useEffect. Guards de redirect com `return` devem vir após todos os hooks.

### Circuit breaker getter com side effect — transição de estado inconsistente (2026-04-06)

**O que:** Getter `isOpen` fazia transição OPEN→HALF_OPEN como side effect. Múltiplos acessos ao getter no mesmo tick poderiam transicionar o estado mais de uma vez ou em momento errado.
**Causa:** Getters JavaScript são funções puras por convenção — sem efeitos colaterais. O código misturava leitura de estado com mutação de estado.
**Correção:** `isOpen` tornou-se getter puro (read-only: `state==='OPEN' && elapsed < resetMs`). Criado método privado `checkState()` para a transição, chamado explicitamente em `call()`.
**Regra:** Getters NUNCA devem ter side effects. Separar leitura de estado de transição de estado.

### Race condition na criação de contato — unique constraint em submissões simultâneas (2026-04-06)

**O que:** Dois submits simultâneos do mesmo número em `form-public` causavam erro 500 — o segundo insert violava unique constraint na coluna `jid`.
**Causa:** Padrão check-then-insert: ambas as requisições passam pelo check "existe?" ao mesmo tempo, ambas encontram null, ambas tentam inserir.
**Correção:** `upsert ON CONFLICT jid` — operação atômica no DB. O segundo submits atualiza em vez de inserir, sem erro.
**Regra:** NUNCA usar check-then-insert para entidades identificadas por unique key. Sempre usar `upsert ON CONFLICT`.

### Array mutation no ChatPanel — .reverse() muta o array original (2026-04-06)

**O que:** `.reverse()` chamado direto no array retornado pela query Supabase mutava o array em place. Comportamento indefinido se a referência escapar (cache do React Query, closures).
**Causa:** `Array.prototype.reverse()` muta o array original — não cria uma cópia.
**Correção:** `.slice().reverse()` — `slice()` sem argumentos cria cópia rasa antes de inverter. Aplicado em 3 locais no ChatPanel.
**Regra:** NUNCA chamar `.reverse()` ou `.sort()` direto em arrays externos (results de query, props). Sempre `.slice().reverse()` / `[...arr].sort()`.

---

### Bio lead captures isolados — dados capturados mas invisíveis (2026-04-07)

**O que:** Leads capturados via Bio Link (M14 Fase 3) iam para `bio_lead_captures` e paravam ali. Não criavam contact, não criavam lead_profile, não apareciam no CRM, Kanban, Leads ou AI Agent. Tabela nem tinha migration.
**Causa:** `bio_lead_captures` foi implementada como INSERT simples sem criar entidades downstream. Além disso, a tabela nunca teve migration (funcionava por estar criada diretamente no DB mas sem versionamento).
**Correção:** M15 F1 — bio-public agora chama `upsertContactFromPhone()` + `upsertLeadFromFormData()` (via `leadHelper.ts` compartilhado). Migration criada. `contact_id` FK adicionada.
**Regra 20:** Todo sistema de captação DEVE criar contact + lead_profile real. Dados isolados são invisíveis ao resto do sistema.

### FIELD_MAP duplicado em 2 edge functions (2026-04-07)

**O que:** O mapeamento `nome→full_name, email→email, cpf→cpf...` estava copiado identicamente em `form-public` e `form-bot`. Qualquer alteração num campo precisaria ser feita em 2 lugares.
**Causa:** Cada edge function foi desenvolvida em milestone separado (M12, M13) e copiou o código.
**Correção:** Extraído para `_shared/leadHelper.ts` com `FORM_FIELD_MAP`, `upsertContactFromPhone()` e `upsertLeadFromFormData()`. Ambas as funções agora importam do módulo compartilhado.
**Regra 19:** NUNCA duplicar FIELD_MAP ou lógica de upsert de lead — usar `leadHelper.ts`.

### FK type mismatch — instances.id é TEXT, não UUID (2026-04-09)

**O que:** Migration poll_messages falhava com "Key columns instance_id and id are of incompatible types: uuid and text".
**Causa:** `public.instances.id` é TEXT (não UUID). A migration usava `instance_id UUID REFERENCES instances(id)`.
**Correção:** Alterado para `instance_id TEXT NOT NULL REFERENCES instances(id)`.
**Regra 24:** Sempre verificar o tipo real da coluna referenciada antes de criar FK. `instances.id` é TEXT.

---

*Adicionar novos erros acima desta linha, seguindo o formato: O que → Causa → Correção → Regra*
