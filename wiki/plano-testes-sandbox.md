---
title: Plano de Testes — Sandbox IA (15 cenários)
tags: [sandbox, testes, e2e, playwright, ai-agent, qualidade]
sources: [wiki/sandbox-ia-instancia, wiki/casos-de-uso/ai-agent-detalhado]
updated: 2026-05-06
---

# Plano de Testes — Sandbox IA

> 15 cenários reais via WhatsApp + 6 specs Playwright Onda 5. Usuário manda msg pelo celular pessoal pro **558185749970** (Sandbox IA). IA processa, sistema valida.

## Como executar

1. Usuário inicia o cenário enviando uma msg específica do **celular pessoal** pro `558185749970`.
2. Claude monitora `ai_agent_logs`, `conversation_messages`, `conversations.tags`, `lead_profiles` em tempo real via MCP.
3. Após cada cenário, Claude reporta **PASS/FAIL** com dados concretos do DB.
4. Se FAIL, Claude diagnostica + corrige + redeploya antes de seguir.

## Pré-checagem antes de qualquer cenário

```sql
-- Sandbox IA está OK?
SELECT i.status, ag.enabled
FROM instances i
JOIN ai_agents ag ON ag.instance_id = i.id
WHERE i.id = 'rb84e079eeab167';
-- Esperado: status=connected, enabled=true
```

---

## Bloco A — Smoke + Saudação (3 cenários, ~5 min)

### A1. Saudação simples

| | |
|---|---|
| **Você manda** | `oi` |
| **IA deve responder** | `Olá! Bem-vindo a Eletropiso, com quem eu falo?` |
| **Valido** | msg inbound + outbound + tag `motivo:saudacao` em `conversations.tags` |
| **Pass criteria** | resposta em ≤3s, conteúdo bate com `ai_agents.greeting_message` |

### A2. Identificação

| | |
|---|---|
| **Você manda** | `Pedro` (após A1) |
| **IA deve responder** | `Em que posso ajudar você hoje, Pedro?` |
| **Valido** | `lead_profiles.full_name = 'Pedro'`, tool `update_lead_profile` chamada nos `ai_agent_logs.tool_calls` |
| **Pass criteria** | nome salvo no DB + nome usado na resposta |

### A3. Lead retornando

| | |
|---|---|
| **Setup** | conversa anterior (A1+A2) já criou `lead_profiles` com nome Pedro |
| **Pré** | manda `clear context` na UI ou eu reseto via DB pra forçar nova conversa |
| **Você manda** | `oi` (mesmo número, conversa nova) |
| **IA deve responder** | usa `returning_greeting_message` em vez do greeting genérico (algo tipo "Oi Pedro, voltou pra gente! Como posso ajudar?") |
| **Valido** | mensagem outbound bate com `ai_agents.returning_greeting_message` |

---

## Bloco B — Qualificação por Categoria (4 cenários, ~10 min, valida R103)

### B1. Tinta — fluxo completo (ordem rigorosa) — **CRÍTICO PRO R103**

| | |
|---|---|
| **Você manda 1** | `tem tinta?` → IA pergunta **ambiente** |
| **Você manda 2** | `parede interna` → IA pergunta **tipo de tinta** (acrílica/esmalte/verniz) ← **R103 garante isso** |
| **Você manda 3** | `acrílica` → IA pergunta **cor** |
| **Você manda 4** | `branco` → IA chama `search_products` |
| **Esperado final** | search retorna vazio (catálogo Sandbox raso) → enrichment → handoff |
| **Valido tags geradas (ordem)** | `motivo:compra`, `interesse:tinta`, `ambiente:parede interna`, `tipo_tinta:acrilica`, `cor:branco` |
| **Pass criteria** | tag `tipo_tinta:*` PRESENTE (provando R103 fix). Sem tag `marca_indisponivel:branco,_parede,_interna` (provando R104 fix) |

### B2. Marca explícita — pula qualificação direta

| | |
|---|---|
| **Você manda** | `quero tinta Coral branca` |
| **IA deve** | chamar `search_products` IMEDIATO (sem perguntar nada) |
| **Valido** | `ai_agent_logs.tool_calls` da 1ª resposta tem `search_products` com query "tinta coral branca" |
| **Pass criteria** | tool_calls.length ≥ 1 + nome=`search_products` na primeira resposta |

### B3. Categoria sem field marca — porta

| | |
|---|---|
| **Você manda** | `preciso de uma porta` |
| **IA deve perguntar** | material (madeira/PVC/alumínio) — NÃO pergunta marca (porta não tem field marca) |
| **Valido** | tag `interesse:portas` + tag `material_porta:` mas nenhuma tag `marca_preferida:` |
| **Pass criteria** | sem fallback em fields errados |

### B4. Categoria desconhecida — fallback default

| | |
|---|---|
| **Você manda** | `vocês tem fita isolante?` |
| **IA deve** | cair na stage default (`especificacao` + `marca_preferida` + `quantidade`) |
| **Valido** | tag `interesse:` com algo (ex: `interesse:fita isolante`) + perguntas usam labels do default |

---

## Bloco C — Produtos & Catálogo (3 cenários, ~10 min)

### C1. Produto encontrado (envio de mídia)

| | |
|---|---|
| **Setup** | catálogo Sandbox tem 7 produtos (clonados do Eletropiso) |
| **Você manda** | `tem cabo 2.5mm?` |
| **IA deve** | search → 1+ produtos → `send_media` (foto) ou `send_carousel` (≥2) |
| **Valido** | `conversation_messages.media_type` = image/carousel + URL real |
| **Pass criteria** | mensagem outbound com mídia chega no WhatsApp |

### C2. Produto NÃO existe — enrichment + handoff

| | |
|---|---|
| **Você manda** | `tem tinta dourada glitter pra unha?` |
| **IA deve** | search falha 2x → enrichment 1/2 → enrichment 2/2 → handoff |
| **Valido tags** | `enrich_count:2`, `search_fail:N`, `lead_score` progressivo |
| **Pass criteria** | sem tag `marca_indisponivel:dourada,_glitter,_unha` (R104 fix). Handoff disparado. |

### C3. Produto excluído (D28)

| | |
|---|---|
| **Pré** | conferir `ai_agents.excluded_products` da Sandbox (clonado) |
| **Você manda** | algo da lista (ex: `tem caixa de correio?`) |
| **IA deve** | usar fallback configurado, NÃO fazer handoff, NÃO incrementar contador |
| **Valido** | tag `excluded_product_match:caixa_correio` (ou similar). `lead_msg_count` NÃO aumentou. |

---

## Bloco D — Handoff & Transferência (3 cenários, ~7 min)

### D1. Handoff explícito ("falar com vendedor")

| | |
|---|---|
| **Você manda** | `quero falar com vendedor` |
| **IA deve** | handoff IMEDIATO (palavra está em `handoff_triggers`) |
| **Valido** | tool_call `handoff_to_human` + `conversations.status_ia` → `shadow` + `assigned_to` populado |
| **Pass criteria** | mensagem outbound = `agent.handoff_message` |

### D2. Round-robin no Sandbox

| | |
|---|---|
| **Setup Sandbox** | só George na fila (Modo Fila OFF, default_assignee=George) |
| **Após D1** | `assigned_to = a1b4fd3e-...` (George) |
| **Valido** | painel direito (após F5) mostra "Agente Responsável: George" |

### D3. Após handoff, IA fica passiva (valida R106 + status_ia)

| | |
|---|---|
| **Você manda após D1** | `qual o preço?` |
| **IA deve** | NÃO responder (status_ia=shadow, IA passiva) |
| **Valido** | sem nova msg outbound da IA. Apenas msg inbound do lead. |
| **Pass criteria** | só atendente humano pode responder agora |

---

## Bloco E — Edge cases (2 cenários, ~10 min)

### E1. Fora de horário (R105 + R106)

| | |
|---|---|
| **Setup** | Claude seta temporariamente `business_hours` da Sandbox via MCP (ex: somente "sun closed" pra simular fora-de-horário em qualquer outro dia, ou setar todos os dias com janela impossível) |
| **Você manda 1** | `oi` (lead novo) |
| **IA deve** | enviar `out_of_hours_message` (R105 funciona) |
| **Você manda 2 e 3 em ≤30s** | `tudo bem?`, `alô` |
| **IA deve** | NÃO repetir a out_of_hours (R106 cooldown 60min) |
| **Valido** | apenas 1 msg outbound com out_of_hours nesta janela |
| **Cleanup** | Claude reseta `business_hours = NULL` |

### E2. Áudio (transcrição)

| | |
|---|---|
| **Você manda** | áudio de voz no WhatsApp |
| **IA deve** | transcrever (via `transcribe-audio` fn) → processar texto |
| **Valido** | msg inbound com `media_type=audio` + edge fn `transcribe-audio` chamada nos logs + resposta IA coerente com áudio |

---

## Métricas reportadas após cada cenário

Após PASS/FAIL, Claude mostra:

| Métrica | Origem |
|---|---|
| Tags coletadas | `conversations.tags` |
| lead_score atual | `lead_profiles.current_score` + tag `lead_score:N` |
| Latência IA (ms) | `ai_agent_logs.latency_ms` |
| Tokens consumidos | `ai_agent_logs.input_tokens + output_tokens` |
| Tools chamadas | `ai_agent_logs.tool_calls` |
| Status conversa | `conversations.status_ia` |

---

## Onda 5 Playwright (paralelo aos cenários reais)

Após os cenários WhatsApp passarem, podemos shipar 6 specs Playwright novos (~30 testes adicionais → 150 totais):

| Spec | Cobertura |
|---|---|
| `25-helpdesk-realtime.spec.ts` | Multi-session: msg chega no DB → outra UI atualiza sem F5 (valida cache stale B3) |
| `26-ai-agent-edit-save.spec.ts` | Editar campo + salvar real + reverter (CRUD com cleanup) |
| `27-kanban-drag-drop.spec.ts` | Drag-drop card entre colunas |
| `28-funnel-wizard-complete.spec.ts` | Funil 4 passos completos (criar → confirmar → deletar) |
| `29-broadcast-create.spec.ts` | Criar broadcast (sem disparar) + clonar + cancelar |
| `30-ui-regression-r93r94r95.spec.ts` | Cenários da Sprint F D30 (badge fila, header sync, dept populado) |

---

## Ordem recomendada

```
Sessão 1 (~30 min): Bloco A + Bloco B → valida R103/R104
Sessão 2 (~20 min): Bloco C + Bloco D → valida produtos + handoff
Sessão 3 (~15 min): Bloco E → edge cases
Sessão 4 (~6h): Onda 5 Playwright → cobertura UI
```

## Frase pra retomar

- **"executar A1 plano sandbox"** — começa do cenário 1
- **"executar Bloco B"** — pula direto pra qualificação por categoria
- **"executar E1"** — só edge case fora-de-horário (Claude seta business_hours antes)

## Cross-refs

- [[wiki/plano-testes-sandbox-v2]] — **v2 (blocos F/G/H/J)**: perfil cliente, objeções, venda fechada, métricas
- [[wiki/sandbox-ia-instancia]] — refs técnicas da instância
- [[wiki/erros-e-licoes]] — R103, R104, R105, R106
- [[wiki/playwright-onda1]], [[wiki/playwright-onda2]], [[wiki/playwright-onda3]], [[wiki/playwright-onda4]] — cobertura Playwright atual (120 testes)
