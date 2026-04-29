---
title: AI Agent (M10)
tags: [ai-agent, openai, sdr, handoff, validator, tts, shadow, profiles, polls, service-categories]
sources: [CLAUDE.md, supabase/functions/ai-agent/]
updated: 2026-04-27
---

# AI Agent (M10)

## Visao Geral

Agente IA que atende leads via WhatsApp. Qualifica, busca produtos, envia carrosseis, enquetes, e faz handoff quando necessario.

**LLM Primario:** OpenAI gpt-4.1-mini (function calling nativo)
**Fallback chain:** Gemini 2.5 Flash → Mistral Small → templates estaticos

## 9 Tools

| Tool | Funcao |
|------|--------|
| `search_products` | Busca fuzzy no catalogo (pg_trgm) |
| `send_carousel` | Carrossel de ate 5 fotos com copy IA |
| `send_media` | Envia imagem, video, audio, documento |
| `handoff_to_human` | Transfere para atendente humano |
| `assign_label` | Aplica label na conversa |
| `set_tags` | Tags estruturadas (motivo, interesse, produto) |
| `move_kanban` | Move card no CRM |
| `update_lead_profile` | Atualiza dados do lead |
| `send_poll` | Enquete nativa WhatsApp (2-12 opcoes clicaveis) — M17 F4 |

## Agent Profiles (M17 F3)

Perfis de Atendimento substituem sub-agents. Cada perfil e um pacote reutilizavel de prompt + regras de handoff.

- **Tabela:** `agent_profiles` (agent_id, name, slug, prompt, handoff_rule, handoff_max_messages, handoff_department_id, handoff_message, is_default)
- **Roteamento:** funil.profile_id → perfil do funil. Sem funil → perfil is_default do agente.
- **Prioridade:** `profileData > funnelData > agent` em todos os paths de handoff
- **Injecao:** `<profile_instructions>` como ULTIMA secao do prompt (prioridade maxima)
- **Backward compat:** Sub-agents (TAG_TO_MODE) so rodam quando `!profileData`
- **Admin:** ProfilesConfig na tab Inteligencia. FunnelDetail tab IA = seletor de perfil.

## Fluxo SDR

1. Termos genericos → qualificar primeiro (ate `max_pre_search_questions`)
2. Termos especificos → buscar imediatamente
3. Search fail → enrichment (ate `max_enrichment_questions`) → handoff
4. `max_lead_messages` (default 8) → auto-handoff

## VALID_KEYS — whitelist do `set_tags` handler

`ai-agent/index.ts:2080` mantém um Set `VALID_KEYS` com chaves aceitas. Tag com chave fora da lista é rejeitada silenciosamente (log warn, sem retornar erro ao LLM). Lista atual inclui:

**Genéricas:** motivo, interesse, produto, objecao, sentimento, cidade, nome, search_fail, ia, ia_cleared, servico, agendamento, marca_indisponivel, acabamento, marca_preferida, quantidade, area, aplicacao, enrich_count, qualificacao_completa, funil, tipo_cliente, concorrente, intencao, motivo_perda, conversao, dado_pessoal, vendedor_*, venda_status, pagamento, lead_score, qualif_stage, ambiente, cor, especificacao

**Categoria-específicas (Eletropiso, 2026-04-29):** material_porta, ambiente_porta, tipo_porta, tipo_churrasqueira, ambiente_revestimento, aplicacao_revestimento, ambiente_fechadura, tipo_fechadura, tipo_escada, degraus, ambiente_pia, material_pia, material_janela, tamanho_janela, aplicacao_cabo, bitola, voltagem, marca_furadeira, diametro, tipo_cano

**Convenção:** quando categoria nova exige campo cuja chave conflita com outra categoria (ex: `material` em portas vs janelas), usar sufixo de categoria (`material_porta`, `material_janela`). Evita sobrescrita de tag entre conversas.

## Service Categories — Funil de Qualificação (M19-S10 v2)

Cada agente tem `ai_agents.service_categories JSONB` com **categorias de atendimento que viram funil de qualificação com etapas (stages) e score progressivo**. Editáveis pelo admin via tab dedicada "Qualificação".

**Hierarquia:** Categoria → Stage → Field
- **Categoria:** detectada pelo regex `interesse_match` em tags `interesse:X`
- **Stage:** etapa do funil com `min_score` / `max_score` e `exit_action` (`search_products` | `enrichment` | `handoff` | `continue`)
- **Field:** pergunta com `score_value` (pontos ganhos quando lead responde) + `priority`

**Comportamento em runtime:**
1. Lead manda mensagem → match na categoria via `interesse_match` regex
2. Score atual lido da tag `lead_score:N` (0 se ausente)
3. `getCurrentStage(score, category)` decide stage atual
4. `getNextField(stage, currentTags)` retorna próxima pergunta a fazer
5. LLM faz a pergunta usando `phrasing` template (`{label}` e `{examples}` substituídos)
6. Lead responde → AI Agent chama `set_tags(['key:valor'])` → handler soma `score_value` no `lead_score` + persiste em `lead_score_history`
7. Score atinge `max_score` do stage → `exit_action` dispara (search_products / enrichment / handoff)

**Score visibilidade:** persistente em tag `lead_score:N` por lead. Reset apenas em `ia_cleared:`. NUNCA visível ao lead. Visível ao gestor no Dashboard M19 + helpdesk.

**Backward compat v1→v2:** migration v2 detecta agentes com schema plano e remapeia automaticamente para 3 stages padrão (Identificação=qualif, Detalhamento=enrichment, Fechamento=handoff).

## Handoff

- So em pedido explicito ("vendedor", "atendente"), sentimento negativo persistente, ou pergunta sem resposta
- Preco/desconto/pagamento → agente responde, NUNCA handoff
- Apos handoff → status_ia = 'shadow' (extrai dados sem responder)
- Frustracao + trigger no mesmo batch → handoff direto
- **Prioridade handoff_message:** profileData > funnelData > agent (D10)
- **Prioridade handoff_department:** profileData > funnelData (M17 F3)

## Shadow Mode

- status_ia = 'shadow' — extrai dados sem enviar mensagens ao lead
- Campos extraidos: full_name, city, interests, reason, average_ticket, objections, notes
- Tags: cidade:X, quantidade:Y, orcamento:Z
- NUNCA sobrescreve full_name existente

## Enquetes Nativas (M17 F4)

- Tool `send_poll`: LLM decide quando enviar enquete
- Limites: 2-12 opcoes, max 255 chars pergunta, max 100 chars/opcao
- D7: NUNCA opcoes numeradas — nomes limpos apenas
- sideEffectTools: send_poll incluido (execucao sequencial)
- Salva em poll_messages + conversation_messages (media_type='poll')
- broadcastEvent() para helpdesk Realtime

## NPS Automatico (M17 F5)

- 5 campos em ai_agents: poll_nps_enabled, poll_nps_delay_minutes, poll_nps_question, poll_nps_options, poll_nps_notify_on_bad
- Trigger: conversa resolvida → delay configuravel → enquete NPS
- Guard: tag sentimento:negativo → NAO envia
- Nota ruim (Ruim/Pessimo) → notifica gerentes via notifications
- PollConfigSection no admin (tab Metricas)

## Validator Agent

- `_shared/validatorAgent.ts` — audita cada resposta IA
- Score 0-10: PASS / REWRITE / BLOCK
- Checks: frases proibidas, topicos bloqueados, limite de desconto, multiplas perguntas, info inventada
- Rigor: moderado (>=8), rigoroso (>=9), maximo (so 10)
- Safety net: codigo conta "?" — se >1, trunca para primeira pergunta

## TTS (Text-to-Speech)

- Chain: Gemini → Cartesia → Murf → Speechify → texto
- Audio split: frase curta como TTS + texto completo como follow-up
- 6 vozes configuraveis

## Prompt Studio

- 9 secoes editaveis (identity, sdr_flow, product_rules, handoff_rules, etc.)
- Template vars: {agent_name}, {personality}, {max_pre_search_questions}, etc.
- Defaults em system_settings.default_prompt_sections

## Motor de Automacao (M17 F1)

- automationEngine.ts: executeAutomationRules() — 7 gatilhos, 4 condicoes, 6 acoes
- Acoes: send_message, move_card, add_tag, activate_ai, handoff, send_poll
- AI Agent integrado: form-bot dispara form_completed, webhook dispara poll_answered
- triggerNpsIfEnabled() para NPS pos-resolve

## Sequencia de Correcao de Erros (OBRIGATORIA)

1. **Codigo + Prompt hardcoded** — bug no fluxo, logica errada
2. **Validator Agent** — adicionar regra no validatorAgent.ts
3. **FAQ/Knowledge Base** — inserir na ai_agent_knowledge
4. **Fallback: Handoff** — ultimo recurso

NUNCA pular etapas.

## Arquivos Criticos (HIGH RISK)

- `supabase/functions/ai-agent/index.ts` (~2600 linhas)
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts` (so via `npx supabase gen types`)

## Links

- [[wiki/arquitetura]] — Stack e LLM chain
- [[wiki/modulos]] — Outros modulos
- [[wiki/erros-e-licoes]] — Erros do agente
- [[wiki/decisoes-chave]] — D10: Agent Profiles
