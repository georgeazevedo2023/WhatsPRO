---
title: Fluxos v3.0 — Validator, Métricas & Migração
tags: [fluxos, validator, shadow, metricas, migracao, e2e, memory, m18]
sources: [wiki/fluxos-visao-arquitetura, wiki/fluxos-banco-dados, supabase/functions/orchestrator]
updated: 2026-05-04
---

# Fluxos v3.0 — Validator, Métricas & Migração (Sub-funcionalidades 13–18)

> Como toda resposta do LLM é **validada** antes de chegar ao lead, como rodar o fluxo em **modo observação** (shadow), como medir **métricas por fluxo**, como migrar instâncias gradualmente, rodar **E2E** e usar **memória persistente**. Sub-funcionalidades 13 a 18 do M18, mais visão técnica do pipeline e tabelas.

Para criação, gatilhos, intent detector e os 7 subagentes (sub-funcs 1–12), ver [[wiki/casos-de-uso/fluxos-orquestrador-subagentes]].

---

## Validação e Modo Observação

### 13. Validator (10 Checks, 0 Tokens)
Valida toda resposta do LLM antes de enviar ao lead:

| Check | O que faz |
|-------|-----------|
| size | Bloqueia respostas >500 chars |
| language | Detecta resposta fora do PT-BR |
| prompt_leak | Bloqueia 13 patterns de vazamento de sistema |
| price | Bloqueia preço divergente do catálogo (±10%) |
| repetition | Corrige frase idêntica à `last_response` |
| greeting_repeat | Remove saudação dupla |
| name_frequency | Max 1x nome por resposta |
| emoji | Max 5 emojis por mensagem |
| markdown | Remove artifacts (* _ ``` #) |
| PII | Bloqueia CPF/email/telefone expostos |

3 falhas acumuladas → handoff automático para humano.

### 14. Shadow Mode
Fluxo funciona em modo observação — pipeline roda completo (intent+subagente+validator+métricas) mas **não envia mensagem ao lead**.
- Ideal para testar fluxo em produção antes de ativar
- Todos os eventos logados em `flow_events` com `shadow: true`
- Tab "Inteligência" no FlowEditor exibe extrações do shadow

---

## Observabilidade e Migração

### 15. Métricas por Fluxo (FlowMetricsPanel)
Dashboard completo em `/flows/:id` tab "Métricas":
- **KPI cards:** sessões iniciadas, taxa conclusão (%), taxa handoff (%), custo total USD
- **Funil de conversão:** BarChart horizontal (active→completed→handoff→abandoned)
- **Timing médio:** PieChart por camada (intent/resolve/context/subagent/validator/send ms)
- **Top 10 intents:** com progress bars CSS e contagens
- **Botão Compartilhar:** gera token hex(16), URL pública válida 30 dias — compartilhar com cliente

### 16. Migração Gradual por Instância
Cada instância WhatsApp tem flag `use_orchestrator` (default false):
- Admin ativa via toggle na tab "Publicar" do FlowDetail
- Checklist de segurança obrigatório: tem flow publicado? triggers ativos? shadow 24h? E2E score ≥80?
- Rollback automático: 3 falhas em 5 min → desativa automaticamente, fallback para ai-agent

### 17. E2E Test Script
`supabase/functions/orchestrator/tests/e2e_orchestrator.sh`:
- 5 cenários: novo_lead_saudacao | coleta_nome | intent_produto | shadow_sem_envio | followup_agendado
- Score 20pts por cenário = 100pts máximo
- Threshold produção: ≥80
- Guard: verifica `E2E_INSTANCE_ID` configurado (NUNCA instância real)

### 18. Memory Service
Memória persistente entre sessões:
- **Short memory** (TTL 1h): contexto da sessão atual — via RPC `upsert_lead_short_memory`
- **Long memory** (permanente): perfil do lead — via RPC `upsert_lead_long_memory`
- Smart fill usa `long_memory.profile` para pular perguntas já respondidas
- Greeting usa `sessions_count` para distinguir leads novos de retornantes

---

## Fluxos Técnicos

### Como uma mensagem é processada (com orquestrador ativo)

```
WhatsApp → whatsapp-webhook
  → if (instance.use_orchestrator) → orchestrator/index.ts
      → flowResolver: qual flow ativar?
      → stateManager: carregar/criar flow_state
      → contextBuilder: lead + memory + agent config
      → intentDetector: L1 → L2 → L3
      → subagent dispatch: greeting/qualification/sales/support/survey/followup/handoff
      → validator: 10 checks → pass/correct/block
      → send via UAZAPI (se não shadow)
      → metrics: timing + cost → flow_events
  → else → ai-agent/index.ts (comportamento anterior)
```

### Banco de dados (14 tabelas)

| Tabela | Função |
|--------|--------|
| `flow_definitions` (`flows`) | Configuração do fluxo (nome, slug, mode, inbox_id?, config JSONB) |
| `flow_steps` | Steps do fluxo (subagent_type, position, step_data, exit_rules) |
| `flow_triggers` | Gatilhos de ativação (trigger_type, value, conditions) |
| `flow_states` | Estado por lead (status, current_step, message_count, step_data) |
| `flow_events` | Log de eventos (timing_breakdown, cost_breakdown, shadow flag) |
| `lead_short_memory` | Contexto de sessão (TTL 1h) |
| `lead_long_memory` | Perfil persistente do lead |
| `flow_step_executions` | Histórico de execuções por step |
| `guided_sessions` | Sessões da conversa guiada (TTL 24h) |
| `flow_report_shares` | Links compartilháveis de relatórios (30 dias) |
| `flow_followups` | Followups agendados (shadow mode — 7 tipos permitidos) |
| `instances` | +coluna `use_orchestrator BOOL DEFAULT false` |

---

## Links

- [[wiki/casos-de-uso/fluxos-detalhado]] — Índice de M18
- [[wiki/casos-de-uso/fluxos-orquestrador-subagentes]] — Criação, gatilhos, intent detector, subagentes (sub-funcs 1–12)
- [[wiki/fluxos-visao-arquitetura]] — Visão, 4 etapas, orquestrador, 12 templates
- [[wiki/fluxos-roadmap-sprints]] — Sprints com entregáveis e bugs corrigidos
- [[wiki/fluxos-banco-dados]] — Schema completo do banco
- [[wiki/fluxos-params-atendimento]] — Parâmetros P0-P3
- [[wiki/fluxos-params-inteligencia]] — Parâmetros P4, P5, P8
- [[wiki/modulos]] — Todos os módulos M1-M18
