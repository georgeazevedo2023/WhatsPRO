---
title: Fluxos v3.0 — Orquestrador & Subagentes
tags: [fluxos, orquestrador, subagentes, m18, gatilhos, intent-detector, templates]
sources: [wiki/fluxos-visao-arquitetura, wiki/fluxos-roadmap-sprints, supabase/functions/orchestrator]
updated: 2026-05-04
---

# Fluxos v3.0 — Orquestrador & Subagentes (Sub-funcionalidades 1–12)

> Como o admin **cria** um fluxo, como ele é **ativado** para um lead (gatilhos), como a **intenção** é classificada e como cada **subagente especializado** atua. Sub-funcionalidades 1 a 12 do M18.

Para validador, shadow mode, métricas, migração, testes E2E e memória, ver [[wiki/casos-de-uso/fluxos-templates-metricas-migracao]].

---

## Criação e Templates

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

---

## Ativação e Classificação

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

---

## Subagentes (P0–P7)

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

---

## Links

- [[wiki/casos-de-uso/fluxos-detalhado]] — Índice de M18
- [[wiki/casos-de-uso/fluxos-templates-metricas-migracao]] — Validator, shadow, métricas, migração, E2E, memory (sub-funcs 13–18)
- [[wiki/fluxos-visao-arquitetura]] — Visão, 4 etapas, orquestrador, 12 templates
- [[wiki/fluxos-roadmap-sprints]] — Sprints com entregáveis e bugs corrigidos
- [[wiki/fluxos-params-atendimento]] — Parâmetros P0-P3
- [[wiki/fluxos-params-inteligencia]] — Parâmetros P4, P5, P8
- [[wiki/modulos]] — Todos os módulos M1-M18
