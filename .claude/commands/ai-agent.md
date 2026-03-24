# WhatsPRO AI Agent — Roadmap por Sprints

Você é o assistente do projeto WhatsPRO. Este comando apresenta o plano completo do módulo M10 — Agente de IA WhatsApp.

## Argumentos
- `/ai-agent` — Visão geral de todas as sprints
- `/ai-agent S1` a `/ai-agent S5` — Detalhes de uma sprint específica
- `/ai-agent status` — Status atual de implementação
- `/ai-agent arch` — Arquitetura técnica

---

## Visão Geral

**M10 — Agente de IA WhatsApp**: Agente autônomo por instância que responde leads automaticamente usando Gemini 2.5 Flash, com arquitetura multi-agente (orquestrador + sub-agentes), catálogo de produtos, handoff inteligente e painel admin completo.

### Arquitetura
```
Orquestrador (Router Agent)
├── SDR Agent (qualificação, coleta de dados)
├── Sales Agent (catálogo, produtos, carrossel)
├── Support Agent (FAQ, documentos, localização)
├── Scheduling Agent (agendamentos)
└── Handoff Agent (transbordo para humano)
```

### Decisões Técnicas
- **Cérebro**: Gemini 2.5 Flash (multimodal: texto, áudio, imagem)
- **Infra**: Edge functions Supabase (ai-agent + ai-agent-debounce)
- **Debounce**: 10s — agrupa mensagens em sequência
- **Scope**: 1 agente por instância (todas as inboxes usam o mesmo)
- **Handoff**: IA pausa mas continua ouvindo (shadow mode)
- **Voz**: Lead envia áudio → responde áudio (se > 150 chars)

---

## Sprint 1 — MVP: Agente Responde 📋

**Objetivo:** Agente recebe mensagem do lead e responde via Gemini com saudação + prompt configurável.

| Task | Status | Descrição | Detalhes |
|------|--------|-----------|----------|
| S1.1 | ✅ | Criar tabelas no banco | `ai_agents` (config por instância), `ai_agent_logs` (logs de interação), `ai_debounce_queue` (fila de debounce), `lead_profiles` (dados extraídos do lead). RLS em todas. |
| S1.2 | ✅ | Edge function `ai-agent-debounce` | Recebe msg do webhook → insere na fila → envia "digitando..." via UAZAPI → reseta timer 10s → quando timer expira, chama `ai-agent` com msgs agrupadas. |
| S1.3 | ✅ | Edge function `ai-agent` (cérebro) | Carrega config → monta prompt (system + contexto curto 10 msgs + msg do lead) → chama Gemini 2.5 Flash → envia resposta via uazapi-proxy → salva msg outgoing no banco → broadcast realtime → loga interação. |
| S1.4 | ✅ | Integrar no `whatsapp-webhook` | Após salvar msg incoming, verificar se instância tem `ai_agents.enabled=true` E conversa não está em cooldown de handoff → chamar `ai-agent-debounce`. Não processar msgs outgoing (fromMe=true). |
| S1.5 | ✅ | Admin tab "Geral" | Campos: nome do agente, mensagem de saudação (obrigatória), personalidade/tom de voz, ativar/desativar, select de instância vinculada. Card de preview da saudação. |
| S1.6 | ✅ | Admin tab "Cérebro" | Campos: prompt do orquestrador (textarea grande), modelo (select: gemini-2.5-flash), temperatura (slider 0-1), max tokens (input). Preview do prompt montado. |
| S1.7 | ✅ | Salvar GEMINI_API_KEY | Adicionar nos secrets do Supabase + na SecretsTab do admin. Validar key com chamada de teste. |

**Endpoints usados:**
- Gemini: `POST /v1beta/models/gemini-2.5-flash:generateContent`
- UAZAPI: `POST /send/text` (via uazapi-proxy)
- UAZAPI: presenceUpdate (typing indicator)

**Exemplo de fluxo:**
```
Lead: "Oi"                         → webhook → debounce (10s timer)
Lead: "tudo bem?"                  → webhook → debounce (reseta timer)
Lead: "vcs tem carros?"            → webhook → debounce (reseta timer)
[10s sem nova msg]                 → ai-agent processa 3 msgs juntas
IA: "Olá! Tudo ótimo! 😊 Sim, temos vários modelos! Qual tipo de carro você procura? Temos sedans, SUVs e hatches."
```

---

## Sprint 2 — Catálogo e Knowledge Base 📋

**Objetivo:** Agente consulta produtos, envia carrossel/mídia e responde FAQ.

| Task | Status | Descrição | Detalhes |
|------|--------|-----------|----------|
| S2.1 | ✅ | Criar tabelas de catálogo | `ai_agent_products` (SKU, título, categoria, subcategoria, preço, fotos[], enabled), `ai_agent_knowledge` (FAQ, docs, URLs), `ai_agent_media` (mídias de apoio, provas sociais). |
| S2.2 | ✅ | Admin tab "Catálogo" | CRUD de produtos com: upload de fotos (Storage público), campos SKU/título/categoria/subcategoria/descrição/preço. Toggle ativo/inativo. Filtros por categoria. Preview do carrossel. |
| S2.3 | ✅ | Admin tab "Conhecimento" | CRUD FAQ (pergunta + resposta). Upload de documentos (PDF, DOCX → Storage). Lista de mídias de apoio. Futuramente: URL do site para scraping. |
| S2.4 | ✅ | Tool `search_products` | Gemini chama function → SQL busca no `ai_agent_products` com filtros (categoria, subcategoria, faixa de preço, texto). Retorna max 10 resultados com título, preço, imagem. |
| S2.5 | 📋 | Tool `send_carousel` | Recebe array de produtos → formata como carrossel WhatsApp (max 10 cards) → envia via uazapi-proxy action send-carousel. Cada card: foto + título + preço + botão "Ver mais". |
| S2.6 | 📋 | Tool `send_media` | Envia: imagem individual (1 produto específico), PDF (catálogo), localização (endereço da loja), vCard (contato do vendedor). Usa uazapi-proxy actions send-media. |
| S2.7 | 📋 | Lógica de qualificação | IA afunila interesse antes de buscar: genérico "tem iPhone?" → pergunta modelo/cor/capacidade → quando <= 5 opções → envia carrossel. Específico "iPhone 17 Pro Max 256GB azul" → busca direta → envia foto individual. |

**Exemplo de fluxo com catálogo:**
```
Lead: "Oiee vcs tem iphone?"
IA: "Oi! 😊 Temos sim! Qual modelo te interessa mais?"
    [Envia carrossel: iPhone 15 | iPhone 15 Pro | iPhone 16 | iPhone 16 Pro | iPhone 16 Pro Max]
Lead: [Clica no card "iPhone 16 Pro"]
IA: "Ótima escolha! O iPhone 16 Pro temos em 3 opções:"
    [Envia carrossel: 128GB Preto R$7.499 | 256GB Azul R$8.299 | 512GB Natural R$9.999]
Lead: "Quero o de 256GB azul"
IA: "Perfeito! iPhone 16 Pro 256GB Azul por R$8.299. Aceita cartão ou Pix? Pix tem 5% de desconto!"
```

---

## Sprint 3 — Handoff e Integrações 📋

**Objetivo:** Agente transfere para humanos, atribui etiquetas/tags e integra com CRM Kanban.

| Task | Status | Descrição | Detalhes |
|------|--------|-----------|----------|
| S3.1 | ✅ | Admin tab "Regras" | Gatilhos de transbordo por texto (["atendente", "humano", "gerente"]). Limites: máx minutos de conversa (15-30), detecção de sentimento negativo (on/off), cooldown após handoff (30-60 min, max 1440). Horário comercial (JSONB por dia). Msg fora do horário. |
| S3.2 | ✅ | Tool `handoff` | IA detecta necessidade → atribui departamento/agente → muda status_ia para 'desligada' → salva cooldown expiry → envia msg "Transferindo para um atendente..." → broadcast status change. |
| S3.3 | 📋 | Tool `assign_label` / `set_tags` | IA atribui etiquetas automaticamente (ex: "Interessado", "Comprou") e tags no lead_profile (ex: {motivo: "compra", interesse: "iphone_16_pro", ticket_medio: 8299}). |
| S3.4 | 📋 | Tool `move_kanban` | Ao qualificar lead → cria/move card no CRM Kanban. Ex: lead demonstrou interesse → move para coluna "Qualificado". Lead comprou → move para "Fechado". |
| S3.5 | 📋 | Modo "shadow" | Durante handoff, IA continua lendo msgs mas não responde. Extrai: tempo resposta do atendente, tags automáticas, objeções mapeadas, resumo pós-atendimento. Dados vão para ai_agent_logs e lead_profiles. |
| S3.6 | 📋 | Admin tab "Extração" | Configurar campos que IA deve extrair: nome, cidade, CPF, data nascimento, email, empresa, cargo. Mapeamento para lead_profiles. Toggle por campo. |
| S3.7 | ✅ | Admin tab "Guardrails" | Tópicos bloqueados (textarea, 1 por linha). Frases proibidas. Limite máximo de desconto (%). Preview: "Se o lead perguntar sobre [tópico], a IA responderá: [msg padrão]". |

**Exemplo de fluxo com handoff:**
```
Lead: "Esse preço tá um absurdo, quero falar com o gerente!"
IA: [Detecta sentimento negativo + gatilho "gerente"]
IA: "Entendo sua preocupação! Vou transferir agora para nosso gerente. Um momento por favor 🙏"
    [Tool: handoff(reason="sentimento negativo + palavra gerente", cooldown=30)]
    [Tool: assign_label("Reclamação")]
    [Tool: set_tags({motivo: "preço", sentimento: "negativo"})]
    → status_ia = 'desligada', assigned_to = gerente_id
    → IA entra em shadow mode por 30 min
```

---

## Sprint 4 — Voz, Métricas e Playground 📋

**Objetivo:** Agente responde por áudio, métricas do agente visíveis, playground de teste.

| Task | Status | Descrição | Detalhes |
|------|--------|-----------|----------|
| S4.1 | ✅ | Admin tab "Voz" | Toggle ativar/desativar TTS. Campo: tamanho máximo de texto para converter em áudio (default 150 chars). Se resposta > max chars → envia texto. Select de voz (masculina/feminina). Preview de áudio. |
| S4.2 | 📋 | Lógica de áudio bidirecional | Lead envia áudio → Gemini transcreve (nativo, sem Groq) → processa como texto → se resposta <= 150 chars → gera áudio via Gemini TTS → upload Storage → envia como PTT via UAZAPI. Se > 150 chars → envia como texto. |
| S4.3 | 📋 | Admin tab "Métricas" | Dashboard com: taxa de qualificação, taxa de conversão, tempo médio resposta (IA vs atendente), horários/dias de pico (heatmap), total de interações, handoffs realizados. Filtros por período e instância. |
| S4.4 | 📋 | Admin tab "Playground" | Chat simulado: admin digita como lead, agente responde como IA. Cada mensagem mostra: sub-agente usado, tools chamadas, tokens consumidos, latência. Botão "Ajustar prompt" ao lado. Histórico de testes salvos. |
| S4.5 | 📋 | Sub-agentes configuráveis | Admin configura cada sub-agente (SDR, Sales, Support, Scheduling, Handoff) com: prompt individual, ativar/desativar, prioridade. Orquestrador usa essa config para rotear. |

**Exemplo de fluxo com áudio:**
```
Lead: [Envia áudio 15s] "Oi pessoal, tô procurando um hb20 2024 branco..."
IA: [Gemini transcreve: "Oi pessoal, tô procurando um hb20 2024 branco"]
    [Tool: search_products(marca="hyundai", modelo="hb20", ano=2024, cor="branco")]
    [Resposta: "Temos 2 HB20 2024 brancos! Sedan e Hatch."] → 47 chars < 150
    [Gemini TTS gera áudio]
    [Upload Storage → envia PTT via UAZAPI]
Lead: [Recebe áudio] "Temos 2 HB20 2024 brancos! Sedan e Hatch."
```

---

## Sprint 5 — Contexto Longo e Módulo de Leads 📋

**Objetivo:** IA com memória de longo prazo, módulo dedicado de leads.

| Task | Status | Descrição | Detalhes |
|------|--------|-----------|----------|
| S5.1 | 📋 | Contexto longo | Após cada conversa, IA gera resumo persistente em `lead_profiles`: interesses, objeções, dados coletados, sentimento, timeline. Próxima interação carrega esse contexto. Alimenta follow-up personalizado. |
| S5.2 | 📋 | Módulo M11 "Leads" | Nova página `/dashboard/leads` — lista de todos os leads com: foto, nome, telefone, tags, último contato, interesse, ticket médio. Filtros por tag/interesse/data. Separado do Disparador. |
| S5.3 | 📋 | Cartão do lead | Detalhes expandidos: dados extraídos (nome, cidade, CPF, nascimento), timeline de interações, tags, interesses, conversas anteriores, score. |
| S5.4 | 📋 | Integração lead_profiles ↔ CRM | Dados do lead_profile alimentam campos custom do Kanban. Tags do lead viram labels automáticas. Score do lead visível no card. |
| S5.5 | 📋 | Duplicar config de agente | Botão "Duplicar" na lista de agentes → copia config, prompts, conhecimento, regras para nova instância. Ajustar instância vinculada. |

---

## Auditoria v2.9.0 — Findings do AI Agent

### Segurança
| Issue | Severidade | Localização | Status |
|-------|-----------|-------------|--------|
| ai-agent aceita service role key na validação de token | Média | ai-agent/index.ts:25-33 | 📋 R43 |
| Shadow mode não verifica ia_blocked_instances | Média | ai-agent/index.ts:210-260 | 📋 Pendente |
| Sem rate limiting em tool calls (executeTool) | Média | ai-agent/index.ts | 📋 R41 |
| Function calling loop sem backoff entre attempts | Baixa | ai-agent-playground:167-208 | 📋 Pendente |

### Estabilidade
| Issue | Severidade | Localização | Status |
|-------|-----------|-------------|--------|
| Race condition no ai-agent-debounce (check-then-act) | Média | ai-agent-debounce/index.ts:60-98 | 📋 R50 |
| Fire-and-forget presence sem logging de erro | Baixa | ai-agent-debounce/index.ts:110-115 | 📋 Pendente |
| Sem timeout nos fetch() para UAZAPI/Gemini | Média | Todas edge functions | 📋 R42 |

### Recomendações
1. **R43**: Remover service role key da validação — aceitar apenas anon key + validar acesso via RLS
2. **R50**: Usar `upsert` com `onConflict: 'conversation_id'` no debounce em vez de check-then-act
3. **R42**: Adicionar timeout 30s em todos os fetch() (Gemini, UAZAPI, presence)
4. Adicionar check de `ia_blocked_instances` no shadow mode
5. Logar erros de presence update em vez de `.catch(() => {})`
6. Implementar exponential backoff no function calling loop

---

## Sprint 6 — Importação Rápida de Produtos ✅ (v3.0.0)

**Objetivo:** Admin cola URL de qualquer site → sistema extrai dados do produto automaticamente → preenche formulário para revisão.

| Task | Status | Descrição |
|------|--------|-----------|
| S6.1 | ✅ | Edge Function `scrape-product` — extrai título, preço, descrição, categoria, subcategoria, SKU, marca, fotos de qualquer URL |
| S6.2 | ✅ | Parser multi-camada: JSON-LD, `__NEXT_DATA__` (Next.js SSR), Open Graph, meta tags, CDN images, breadcrumbs |
| S6.3 | ✅ | `findKey()` recursivo para buscar campos específicos em qualquer nível do JSON (breadCrumbs, detailedDescription) |
| S6.4 | ✅ | UI "Importação Rápida" no dialog Novo Produto — Collapsible com input URL + botão + barra de progresso |
| S6.5 | ✅ | Fluxo de revisão: form preenchido automaticamente → admin revisa/edita preço/estoque → salva |

**Compatibilidade testada:** Ferreira Costa (Next.js), sites com JSON-LD, SPAs, e-commerces estáticos

**Edge Function**: `scrape-product` (auth: JWT user, timeout: 20s, CORS: *)
**Componente**: `CatalogConfig.tsx` — seção "Importação Rápida" no dialog

---

## Roadmap Futuro (pós Sprint 6)

| Feature | Sprint | Descrição |
|---------|--------|-----------|
| Web scraping em lote (rastreador de site) | S7+ | Raspar site inteiro da empresa → base de conhecimento automática |
| Follow-up automático (cadência) | S8+ | Módulo de cadência: "3 dias sem resposta → enviar msg X" |
| A/B Testing de prompts | S9+ | Testar variações do prompt, medir qual converte mais |
| CSAT por atendente | S9+ | Survey pós-atendimento via WhatsApp |
| Import CSV de produtos | S7+ | Upload em massa para o catálogo |
| Funis conversacionais (ex-M10) | S10+ | Flow builder visual (movido para M14) |

---

## Tabelas do Banco (Schema)

### ai_agents (1 por instância)
```
id, instance_id (UNIQUE FK), enabled, name, greeting_message,
personality, system_prompt, sub_agents (JSONB),
model, temperature, max_tokens, debounce_seconds,
handoff_triggers[], handoff_cooldown_minutes, handoff_max_conversation_minutes,
handoff_negative_sentiment, blocked_topics[], max_discount_percent,
blocked_phrases[], voice_enabled, voice_max_text_length,
context_short_messages, context_long_enabled,
business_hours (JSONB), out_of_hours_message,
created_at, updated_at
```

### ai_agent_products (catálogo)
```
id, agent_id (FK), sku, title, category, subcategory,
description, price, currency, in_stock, images[],
metadata (JSONB), position, enabled, created_at, updated_at
```

### ai_agent_knowledge (FAQ + docs)
```
id, agent_id (FK), type (faq|document|url|media),
title, content, media_url, metadata (JSONB),
position, created_at
```

### ai_agent_media (mídias de apoio)
```
id, agent_id (FK), type (support|social_proof|catalog_pdf),
title, description, media_url, media_type, tags[],
position, created_at
```

### ai_agent_logs (logs de interação)
```
id, agent_id (FK), conversation_id (FK),
event (message_received|response_sent|tool_called|handoff|error),
input_tokens, output_tokens, model, latency_ms,
sub_agent, tool_calls (JSONB), error, created_at
```

### lead_profiles (dados extraídos)
```
id, contact_id (UNIQUE FK), full_name, city, state, cpf,
birth_date, email, company, role, interests[],
tags (JSONB), last_purchase, average_ticket,
total_interactions, first_contact_at, last_contact_at,
sentiment_history (JSONB), notes, metadata (JSONB),
created_at, updated_at
```

### ai_debounce_queue (fila)
```
id, conversation_id (UNIQUE FK), messages (JSONB[]),
first_message_at, process_after, processed, created_at
```
