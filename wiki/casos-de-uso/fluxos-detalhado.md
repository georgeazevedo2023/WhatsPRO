---
title: Fluxos v3.0 — Casos de Uso Detalhados
tags: [fluxos, orquestrador, casos-de-uso, m18, subagentes, templates]
sources: [wiki/fluxos-visao-arquitetura, wiki/fluxos-roadmap-sprints, log.md]
updated: 2026-04-12
---

# M18 — Fluxos v3.0 — Casos de Uso

> Orquestrador de fluxos conversacionais que unifica Bio Link, Campanhas, Formulários, Funis e AI Agent em experiência única. Produção: `USE_ORCHESTRATOR` por instância.

---

## O que é

Um **Fluxo** é uma automação conversacional completa: define o que acontece do momento que um lead chega até a resolução. O admin configura uma vez, o orquestrador executa para cada lead de forma personalizada.

**Diferença do AI Agent simples:** o AI Agent responde a perguntas. O Fluxo *conduz* uma conversa com objetivo específico (vender, qualificar, suportar), com memória entre sessões, subagentes especializados e métricas por fluxo.

---

## Sub-funcionalidades (18)

### 1. Criação via Formulário Direto
Admin acessa `/flows/new`, escolhe modo "Formulário Direto", preenche 4 etapas:
- **Identidade:** Nome, Slug (auto-gerado), Descrição, Instância, **Caixa de entrada** (opcional — filtra por instância)
- **Configuração:** Modo (active/shadow/assistant/off), Fluxo padrão da instância
- **Gatilhos:** Adicionar/editar/remover gatilhos
- **Publicar:** Resumo completo + publicar agora ou salvar como rascunho

Fluxo criado em <5 min. Ideal para admins experientes.

### 2. Criação via Conversa Guiada
Admin clica "Conversa Guiada", descreve em linguagem natural o que quer ("quero qualificar leads de financiamento de veículos"). IA pergunta, sugere subagentes, configura steps automaticamente. Admin aprova e publica.
- **Edge function:** `guided-flow-builder` (gpt-4.1-mini, response_format: json_object)
- **Sessão persiste 24h** — admin pode pausar e continuar
- **Output:** `draft_flow` JSON completo + `suggestions` contextuais

### 3. Instalação de Templates (1 Clique)
FlowTemplatesPage lista 12 templates pré-configurados. Admin clica "Instalar", RPC atômica cria flow+steps+triggers em 1 transação com rollback automático. Navega direto para `/flows/:id`.

**4 MVPs disponíveis:**
| Template | Subagentes | Caso de uso |
|----------|-----------|-------------|
| Vitrine de Produtos | greeting→qualification→sales→survey→handoff | Loja, e-commerce |
| SDR BANT | greeting→qualification(BANT)→sales→handoff | B2B, leads qualificados |
| Suporte Técnico | greeting→support→NPS→handoff | SaaS, serviços |
| Pós-Venda | greeting→survey→followup(D+7)→NPS | Retenção, onboarding |

### 4. Gatilhos (16 tipos em 4 grupos)
Como o fluxo é ativado para um lead:
- **Entrada:** keyword, qualquer_mensagem, primeiro_contato, numero_especifico
- **Campanha:** utm_source, utm_medium, qr_code, link_bio
- **Formulário:** form_slug, form_tag
- **Programado:** horario_especifico, dia_semana, tag_aplicada, webhook_externo, api_call, inatividade

### 5. Intent Detector (3 Camadas)
Classifica a intenção do lead a cada mensagem sem depender de LLM:
- **L1 Normalização (~5ms):** 50+ abreviações BR, dedup letras repetidas, emoji→sinal, remove acentos
- **L2 Fuzzy Match (~12ms):** Levenshtein, Soundex PT, 13 intents × 15 sinônimos, phrase match
- **L3 LLM Semântico (~200ms):** gpt-4.1-mini, só acionado se L2 confidence < 70

**13 intents:** produto, preco, disponibilidade, suporte, reclamacao, cancelamento, financiamento, agendamento, localizacao, horario, concorrente, elogio, saudacao

### 6. Subagente Greeting (P0)
4 casos tratados automaticamente:
- **Retornante (sessions>0 + tem nome):** saudação personalizada com nome, resumo contexto
- **Novo com nome já coletado:** greeting personalizado
- **Novo sem nome:** pede nome, armazena `waiting_for: 'name'`
- **Coleta de nome:** extrai nome de resposta livre (patterns BR + heurística ≤40 chars)

### 7. Subagente Qualification (P1)
Coleta estruturada de dados do lead:
- **16 tipos de campo:** text, email, phone, cpf, cnpj, date, boolean, select, multi_select, scale_1_5, scale_1_10, nps, currency_brl, url, address, custom
- **Smart fill:** pula perguntas já respondidas (configurável: `smart_fill_max_age_days`)
- **Mode adaptive:** LLM escolhe próxima pergunta com base no contexto
- **Mode fixed:** sequência predefinida
- Dados salvos em `lead_profiles.custom_fields` (JSONB)

### 8. Subagente Sales
Busca e apresenta produtos:
- Busca 3 camadas: ILIKE → AND palavra por palavra → fuzzy RPC (pg_trgm)
- 1 produto → `send/media` (foto + caption)
- 2+ produtos → carousel (max 10, anti-repetição via `products_shown[]`)
- Follow-up LLM leve (~200 tokens) após envio
- Tags automáticas: `interesse:PRODUTO`, `produto_enviado:SLUG`

### 9. Subagente Support
Responde dúvidas via knowledge base:
- Word overlap scoring (sem pgvector — sem custo extra)
- ≥0.80: responde diretamente (0 tokens LLM)
- 0.50–0.79: LLM enriquece a resposta
- <0.50: handoff para humano
- `unanswered_count` > N → handoff automático

### 10. Subagente Survey
Coleta respostas estruturadas (enquetes, NPS, pesquisas):
- Usa UAZAPI `/send/menu` (type: list, 2–12 opções)
- Fuzzy match para respostas em texto livre vs opções
- Tags automáticas de NPS: `nps_score:X`, `sentimento:X`
- Retry/skip por pergunta configurável

### 11. Subagente Followup
Agenda mensagens futuras:
- Armazena `followup_scheduled_at` + `followup_message` em `step_data` do `flow_state`
- Cron hourly (`process-flow-followups`) busca e envia
- Escalation levels configuráveis
- `post_action` após envio: next_step / complete / handoff

### 12. Subagente Handoff
Transfere para humano com contexto completo:
- 3 níveis de briefing: minimal (nome+intent) | standard +qualificação | full +histórico
- Atribui department_id / user_id configurável por fluxo
- Tags automáticas: `handoff:human`, `handoff:department`, `handoff:manager`

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

### Como uma mensagem é processada (com orchestrador ativo)

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

- [[wiki/fluxos-visao-arquitetura]] — Visão, 4 etapas, orquestrador, 12 templates
- [[wiki/fluxos-roadmap-sprints]] — 12 sprints com entregáveis e bugs corrigidos
- [[wiki/fluxos-banco-dados]] — Schema completo do banco
- [[wiki/fluxos-params-atendimento]] — Parâmetros P0-P3
- [[wiki/fluxos-params-inteligencia]] — Parâmetros P4, P5, P8
- [[wiki/modulos]] — Todos os módulos M1-M18
