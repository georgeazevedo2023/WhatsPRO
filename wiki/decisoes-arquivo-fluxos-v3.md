---
title: Decisões-Chave Arquivo — Fluxos v3.0 + M16/M17
tags: [decisoes, arquivo, fluxos, orquestrador, shadow, validator]
updated: 2026-04-13
---

# Decisões-Chave Arquivo — Fluxos v3.0 + M16/M17

> Arquivado de decisoes-chave.md em 2026-04-13 para manter o arquivo principal abaixo de 200 linhas.

---

## UI Funil = Cockpit (D9) + Motor Automacao (D8, 2026-04-08)

- FunnelDetail: 5 tabs — Canais, Formulario, Automacoes, IA, Config. AI Agent page = config GLOBAL
- Motor: Gatilho>Condicao>Acao. 7 gatilhos, 4 condicoes, 5 acoes. `automation_rules`. `automationEngine.ts`

## Shadow Mode — 4 Modos Operacao (D17, 2026-04-11)

- **4 modos:** IA Ativa (IA conversa) | IA Assistente (IA sugere) | Shadow (IA observa) | Desligado
- **Shadow:** 7 dimensoes: Lead, Vendedor, Objecao(7 tipos), Produto, Gestor, Resposta(escalada), Follow-up(deteccao+resgate)
- **5o servico:** Shadow Analyzer. Batch 5min (~R$1,60/dia/vendedor). Nao responde, so extrai
- **Wiki:** [[wiki/fluxos-shadow-mode]]

## Agent Profiles (D10, 2026-04-09)

- **Conceito:** Pacote reutilizavel prompt + handoff. Substitui sub-agents + funnel_prompt
- **Tabela:** `agent_profiles` (agent_id FK, name, slug, prompt, handoff_rule/max_messages/department_id/message, is_default)
- **Prioridade:** profileData > funnelData > agent. Prompt: `<profile_instructions>` ultima secao
- **Roteamento:** funil.profile_id → perfil. Sem funil → is_default=true. Backward compat: sub-agents so se !profileData

## Fluxos Unificados v3.0 (D11, 2026-04-11)

- **Decisao:** Unificar 17 modulos em "Fluxos" — interface unica com 3 modos (Conversa Guiada, Formulario, Templates)
- **12 templates:** Vitrine, Lancamento, Carrinho, Cardapio, Sorteio, SDR, Evento, Suporte, Agendamento, Pos-venda, Politica, Imobiliaria
- **Mapeamento:** Bio Link/UTM = Gatilho, Forms/Catalogo = Tool, Agent Profiles = Subagente, Motor = Motor, Dashboard = Metricas
- **Ordem:** 1. Formulario → 2. Templates → 3. Conversa Guiada
- **Wiki:** [[wiki/fluxos-visao-arquitetura]]

## Forms Absorvido (D16, 2026-04-11)

- **Decisao:** P12 Forms ABSORVIDO. P1 ganhou field_types(16)+collect_mode+smart_fill (7→10 sub-params). P9 ganhou lead_magnet+standalone_form (15→17 sub-params). Total: 14→13 params.

## Detector Unificado de Intents (D15, 2026-04-11)

- 1 detector, 3 camadas (normalização→fuzzy→LLM). 13 intents por prioridade. Performance real: 100% L2, 0% LLM.
- trigger_config: intents[] + keywords como boost + min_confidence
- **Wiki:** [[wiki/fluxos-detector-intents]]

## 4 Servicos de Infraestrutura (D14, 2026-04-11)

- **Decisao:** Adicionar 4 servicos (nao subagentes) ao pipeline do orquestrador
- **Memory:** Curta (cache/sessao) + Longa (banco/permanente: profile, purchases, preferences, sessions)
- **Audio:** STT entrada (Whisper/Scribe) + TTS saida (ElevenLabs/Kokoro). 4 modos: always, mirror, never, ask
- **Validator:** Verificacoes auto + LLM score (0-10) + brand voice + fact-check catalogo + shadow mode
- **Metrics:** Cronometro envolvente. Breakdown por camada. 3 dimensoes: lead, IA, atendente
- **Wiki:** [[wiki/fluxos-servicos]]

## Transbordo Distribuido + Exit Rules (D13, 2026-04-11)

- **Decisao:** Transbordo NAO e etapa separada. Cada subagente tem exit_rules embutidos
- **Padrao:** exit_rule = { trigger, message, action } — trigger dispara saida, message pro lead, action = destino
- **Destinos:** next_subagent, handoff_human, handoff_department, handoff_manager, followup, another_flow, tag_and_close, do_nothing
- **Obrigatorio:** pelo menos 1 exit rule por subagente (previne loop infinito)
- **Reconhecimento:** Etapa 0 do Orquestrador (banco SQL, sem LLM, ~50ms). Saudacao e Subagente #1

## Orquestrador + Subagentes (D12, 2026-04-11)

- **Decisao:** Refatorar ai-agent monolito (~2600 linhas) para orquestrador leve (~300 linhas) + subagentes especializados (~200 linhas cada)
- **Subagentes:** greeting, qualification, sales, support, handoff, followup, survey, custom
- **Ciclo:** receiveMessage → resolveFlow → buildContext → executeAgent → processResult → advanceFlow
- **Ganho:** Prompt LLM de ~3000 palavras → ~300-500 (80% menor, mais barato, mais rapido, mais preciso)
- **Wiki:** [[wiki/fluxos-visao-arquitetura]]

## Schema Banco — Fluxos v3.0 (G1, 2026-04-11)

- 14 tabelas, 4 grupos. FK: `instance_id TEXT`. Versioning: `flows.version + flow_states.flow_version`. RLS: 3 políticas padrão.
- **Wiki:** [[wiki/fluxos-banco-dados]]

## Shadow Mode — Pipeline sem Envio (D18, 2026-04-12)

- **Decisao:** `flows.mode = 'shadow'` → pipeline roda completo (intent, subagente, validator) mas NÃO envia ao lead
- **Envios bloqueados:** sendToLead, handleMediaSend — ambos gated por `isShadow`
- **Logging:** Via `flow_events` com flag `shadow: true` (NÃO em shadow_extractions — batch_id NOT NULL, S11)
- **Response:** `{ shadow: true, message_sent: false }` — E2E confirmado

## Validator — 3 Ações + Correção Automática (D19, 2026-04-12)

- **3 ações:** `pass` (envia), `correct` (envia texto corrigido), `block` (não envia + loga)
- **corrected_text:** Aplicado no sendToLead (`validation.corrected_text ?? result.response_text`)
- **3 falhas consecutivas:** `step_data.validator_failures >= 3` → auto handoff + log
- **last_response:** Salvo em step_data após cada envio — usado por check `no_repetition`
- **10 checks:** size, language, prompt_leak, price, repetition, greeting, name_freq, emoji, markdown, pii

## Metrics — Colunas Dedicadas em flow_events (D20, 2026-04-12)

- **Decisao:** Timing e custo salvos em `flow_events.timing_breakdown` e `cost_breakdown` (JSONB dedicados)
- **NÃO no input JSONB** — input é para dados de evento, timing/cost são metadados de infraestrutura
- **6 marks:** intent_ms, resolve_ms, context_ms, subagent_ms, validator_ms, send_ms + total_ms
- **logFlowEvent:** Aceita params opcionais `timingBreakdown?` e `costBreakdown?`
