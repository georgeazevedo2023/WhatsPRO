---
title: Decisões-Chave
tags: [decisoes, regras, padroes, seguranca, funis, automacao, polls, perfis, nps, fluxos-unificados]
sources: [CLAUDE.md, docs/REGRAS_ASSISTENTE.md]
updated: 2026-04-11
---

# Decisões-Chave

## Regras de Integridade

- NUNCA reportar dados falsos ou inconsistentes
- NUNCA dar nota/score parcial e depois mudar para pior
- NUNCA dizer que algo funciona baseado em teste parcial
- NUNCA quebrar código em produção
- Se resultado contradiz anterior → explicar POR QUE mudou

## Protocolo de Entrega (6 passos — NUNCA pular)

1. **Implementar** — código funcional, sem `as any`, sem magic strings
2. **TypeScript** — `npx tsc --noEmit` = 0 erros
3. **Testes** — `npx vitest run` = 100%
4. **Auditoria** — arquivos proibidos, dados legados, RLS
5. **Commit** — mensagem descritiva (feat/fix/chore + módulo)
6. **Documentar** — CLAUDE.md + PRD.md + vault

## SYNC RULE (8 locais)

Ao alterar feature do AI Agent, sincronizar:
1. Banco (coluna + migration)
2. Types.ts (gen types)
3. Admin UI (campo editável)
4. ALLOWED_FIELDS (AIAgentTab.tsx)
5. Backend (ai-agent/index.ts)
6. Prompt (prompt_sections)
7. system_settings defaults
8. Documentação (CLAUDE.md + PRD.md)

## Padrões de Código

- `handleError()` para erros user-facing (nunca só console.error)
- CSS variables para cores (nunca hardcoded HSL)
- Hooks reutilizáveis quando padrão repete 2+ vezes
- `edgeFunctionFetch` para chamar edge functions
- STATUS_IA constantes — NUNCA magic strings
- `leadHelper.ts` para criar leads — NUNCA duplicar FIELD_MAP ou upsert de lead_profiles
- Tags de origem: sempre `origem:X` (campanha/formulario/bio) — padronizado em todos os sistemas
- `lead_profiles.origin` deve ser setado na criação do lead (bio/campanha/formulario/funil)
- Tag `funil:SLUG` — setada automaticamente por form-public, bio-public, whatsapp-webhook quando recurso pertence a um funil
- Handoff priority: profile > funnel > agent (D10) — profileData.handoff_message > funnelData.handoff_message > agent.handoff_message
- Funis sao camada de orquestracao — NUNCA duplicar logica dos modulos internos (campaigns, bio, forms). Funil aponta via FK.
- `funnelTemplates.ts` define defaults por tipo — kanban columns, bio buttons, campaign UTM, form template. Centralizado.
- `funnelData` carregado early (antes dos handoff triggers) no ai-agent para estar disponivel em todos os paths de handoff

## Segurança

- Token UAZAPI NUNCA no frontend
- Auth manual em todas edge functions
- Supabase Vault para secrets
- Media URLs diretas do UAZAPI (sem re-upload)

## CORS — Edge Functions (2026-04-08)

- **`getDynamicCorsHeaders(req)`** — CORS dinâmico que checa Origin vs whitelist + aceita `localhost:*` automaticamente
- **`browserCorsHeaders`** — CORS estático (backward-compatible), usa primeiro origin do `ALLOWED_ORIGIN`
- **`webhookCorsHeaders`** — wildcard `*` para webhooks (UAZAPI, n8n)
- Edge functions admin-* DEVEM usar `getDynamicCorsHeaders(req)` e `verify_jwt=false`
- `ALLOWED_ORIGIN` suporta comma-separated: `https://crm.wsmart.com.br,https://app.whatspro.com.br`

## Formato de Discussão (2026-04-08): Contexto → Problema → Solução → 4 casos → Opções+recomendação → Documentar no vault

## UI Funil = Cockpit (D9) + Motor Automacao (D8, 2026-04-08)

- FunnelDetail: 5 tabs — Canais, Formulario, Automacoes, IA, Config. AI Agent page = config GLOBAL
- Motor: Gatilho>Condicao>Acao. 7 gatilhos, 4 condicoes, 5 acoes. `automation_rules`. `automationEngine.ts`

## Shadow Mode — 4 Modos Operacao (D17, 2026-04-11)

- **4 modos:** IA Ativa (IA conversa) | IA Assistente (IA sugere) | Shadow (IA observa) | Desligado
- **Shadow:** 7 dimensoes: Lead, Vendedor, Objecao(7 tipos), Produto, Gestor, Resposta(escalada), Follow-up(deteccao+resgate)
- **5o servico:** Shadow Analyzer. Batch 5min (~R$1,60/dia/vendedor). Nao responde, so extrai
- **Wiki:** [[wiki/fluxos-shadow-mode]]

## Formatacao (D7): NUNCA opcoes numeradas, SEMPRE nomes limpos — enquetes, selects, listagens

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

- **Decisao:** Keywords e Intents NAO sao sistemas separados. Unificar em 1 detector com 3 camadas progressivas
- **13 intents por prioridade:** Cancelamento > Pessoa > Suporte > Reclamacao > Produto > Orcamento > Status > Agendamento > FAQ > Promocao > B2B > Continuacao > Generico
- **Camada 1 Normalizacao (~5ms, R$0):** 50+ abreviacoes WhatsApp, remocao acentos, dedup letras, emojis como sinal
- **Camada 2 Fuzzy Match (~10ms, R$0):** Levenshtein distance (threshold ≤2 para ≥5 letras), Soundex portugues, dicionario sinonimos por intent
- **Camada 3 Semantico (~200ms, R$0.001):** LLM leve, so quando ambiguo (~20% das msgs). Prompt curto 100 tokens
- **Intent Pessoa (6 sub-params):** Detecta nome/depto/funcao, verifica disponibilidade, preferred_agent persistente, angry_detection
- **Intent Produto (7 sub-params):** Busca catalogo imediata, bypass qualificacao, auto_calculate quantidade, recompra via memoria longa, comparacao
- **Ambiguidade:** 2+ intents na mesma msg → responde ambos. Conflito → prioridade
- **Impacto Param 6 Gatilhos:** trigger_config muda de keywords para intents com keywords como boost
- **Performance:** 80% resolve sem LLM (~15ms), 20% precisa LLM (~200ms). Custo medio R$0,0002/msg
- **Wiki:** [[wiki/fluxos-detector-intents]]

## 4 Servicos de Infraestrutura (D14, 2026-04-11)

- **Decisao:** Adicionar 4 servicos (nao subagentes) ao pipeline do orquestrador
- **Memory:** Curta (cache/sessao: summary, products_shown, intents) + Longa (banco/permanente: profile, purchases, preferences, sessions)
- **Audio:** STT entrada (Whisper/Scribe) + TTS saida (ElevenLabs/Kokoro). 4 modos: always, mirror, never, ask
- **Validator:** Verificacoes auto (tamanho, idioma, prompt leak, preco, repeticao) + LLM score (0-10) + brand voice + fact-check catalogo + shadow mode
- **Metrics:** Cronometro envolvente. Breakdown por camada (50ms recog + 100ms mem + 800ms LLM + 200ms valid + 500ms TTS). 3 dimensoes: lead, IA, atendente
- **Pipeline:** Metrics.start → Audio.STT → Memory.load → Rota → Subagente → Validator → Audio.TTS → Envio → Metrics.end
- **Wiki:** [[wiki/fluxos-servicos]]

## Transbordo Distribuido + Exit Rules (D13, 2026-04-11)

- **Decisao:** Transbordo NAO e etapa separada no final. Cada subagente tem exit_rules embutidos
- **Padrao:** exit_rule = { trigger, message, action } — trigger dispara saida, message pro lead, action = destino
- **Destinos:** next_subagent, handoff_human, handoff_department, handoff_manager, followup, another_flow, tag_and_close, do_nothing
- **Obrigatorio:** pelo menos 1 exit rule por subagente (previne loop infinito)
- **final_handoff:** fallback quando fluxo termina naturalmente sem exit rule disparar
- **Arquitetura:** mudou de 5 etapas (Gatilho→Condicao→Acao→Transbordo→Metricas) para 4 etapas + Reconhecimento
- **Reconhecimento:** Etapa 0 do Orquestrador (banco SQL, sem LLM, ~50ms). Saudacao e Subagente #1
- **Saudacao:** 6 sub-parametros. extract_name toggle (ativo vs passivo). context_depth (minimal/standard/deep). LLM so quando deep
- **Produtos:** 8 sub-parametros. Filtros, display, carrossel, recomendacao (exact/smart/upsell)

## Orquestrador + Subagentes (D12, 2026-04-11)

- **Decisao:** Refatorar ai-agent monolito (~2600 linhas) para orquestrador leve (~300 linhas) + subagentes especializados (~200 linhas cada)
- **Subagentes:** greeting, qualification, sales, support, handoff, followup, survey, custom
- **Ciclo:** receiveMessage → resolveFlow → buildContext → executeAgent → processResult → advanceFlow
- **Ganho:** Prompt LLM de ~3000 palavras → ~300-500 (80% menor, mais barato, mais rapido, mais preciso)
- **Contrato:** Cada subagente recebe config + lead_context + flow_state. Retorna status + resultado estruturado
- **Parametro Qualificacao:** 7 sub-parametros (questions, max_questions, required_count, mode, fallback_retries, post_action, context_vars)
- **Fase MVP:** Sub-parametros 1-6. Fase 2: score + perguntas condicionais + tipos resposta
- **Wiki:** [[wiki/fluxos-visao-arquitetura]] (secoes 6-8) — plano-fluxos-unificados.md foi reorganizado

## Schema Banco — Fluxos v3.0 (G1, 2026-04-11)

- **14 tabelas** em 4 grupos: Definição (flows/steps/triggers) | Estado (states/events/memory) | Shadow (extractions/metrics/pending/followups) | Infra (intents/security/validator/media)
- **Padrão FK:** `instance_id TEXT REFERENCES instances(id)` — NUNCA `inbox_id UUID`
- **Versioning:** `flows.version + flow_states.flow_version` — lead não quebra se admin editar fluxo ativo
- **Shadow:** `flow_followups` (≠ `follow_up_executions` que já existe). 4 tabelas infra eram ausentes no schema original
- **RLS:** 3 políticas padrão em todas: super_admins + inbox_members + service_role
- **Wiki:** [[wiki/fluxos-banco-dados]]

## Arquivos HIGH RISK (nunca tocar sem aprovação)

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/ai-agent-playground/index.ts`
- `supabase/functions/e2e-test/index.ts`
- `src/integrations/supabase/types.ts`

## Reorganizacao Documentacao (2026-04-10)

CLAUDE.md 373→96 linhas. Conteúdo migrado: [[RULES.md]] (regras) | [[ARCHITECTURE.md]] (stack) | [[PATTERNS.md]] (padrões).
**Regra:** NUNCA inflar CLAUDE.md — orquestrador, não enciclopédia. Detalhes: [[wiki/arquitetura-docs]].

## G5 — UX Admin Fluxos v3.0 (2026-04-11)

- **Config subagentes:** Formulário dinâmico por tipo (3-5 campos chave) + toggle "⚙ Avançado (JSON)". Não JSON bruto puro — usuário médio não é dev.
- **Config serviços:** Defaults globais por instância + aparece contextualmente nos params relevantes (Memory TTL → P1, Audio → P3, Validator → P5). Admin nunca vê "Memory Service" — vê linguagem de negócio.
- **Exit Rules:** 5 presets configuráveis (max_messages, sem_resposta, intent_cancelamento, qualificacao_concluida, timeout) + "Regra personalizada (JSON)" para casos custom. Visual builder completo fica para S13+.
- **Conversa Guiada:** Split-screen chat + preview live (Supabase Realtime). IA usa contexto da instância. `flow_patch` incremental. `guided_sessions` TTL 24h — admin retoma de onde parou.
- **5 telas:** /flows | /flows/new (3 modos) | /flows/new Formulário 4 etapas | /flows/new Conversa Guiada | /flows/:id FlowEditor 5 tabs | /flows/:id/metrics
- **Wiki:** [[wiki/fluxos-wireframes-admin]]

## DT1 — custom_fields Location (2026-04-11)

- **Decisão:** `lead_profiles.custom_fields JSONB` — dado de negócio, não memória de IA
- **Coluna já existe** desde migration `20260322135030` com `DEFAULT '{}'` — S6 não precisa de migration
- **Escrita:** `UPDATE lead_profiles SET custom_fields = custom_fields || $answers WHERE id = $lead_id`
- **Leitura (smart_fill):** `lead_profiles.custom_fields[field_name]` + verifica `smart_fill_max_age_days`
- **Razão:** sobrevive reset de contexto IA, visível no CRM/helpdesk, filtrável em campanhas

## Links

[[wiki/erros-e-licoes]] | [[wiki/ai-agent]] | [[wiki/arquitetura]] | [[wiki/arquitetura-docs]] | [[wiki/fluxos-banco-dados]] | [[wiki/fluxos-wireframes-admin]]
