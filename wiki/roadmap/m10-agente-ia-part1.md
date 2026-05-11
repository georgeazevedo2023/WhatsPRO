---
title: Roadmap — M10 Agente de IA (parte 1)
type: roadmap-detail
updated: 2026-05-11
---

# M10 — Agente de IA WhatsApp (parte 1: T10.1-T10.6)

> Continuação em [[wiki/roadmap/m10-agente-ia-part2]].

#### M10 - Agente de IA WhatsApp 🔄

> **Visão**: Agente autônomo por instância que responde leads via Gemini 2.5 Flash com arquitetura multi-agente, catálogo de produtos, handoff inteligente e painel admin completo.
> Consulte `/ai-agent` para roadmap detalhado por sprint.

**Sprint 1 — MVP: Agente Responde**
| Task | Status | Descrição |
|------|--------|-----------|
| S1.1 Criar tabelas (ai_agents, logs, debounce, lead_profiles) | ✅ | 4 tabelas com RLS, indexes, triggers |
| S1.2 Edge function ai-agent-debounce | ✅ | Agrupa msgs 10s, typing indicator, cleanup queue |
| S1.3 Edge function ai-agent (cérebro) | ✅ | Gemini 2.5 Flash, function calling, saudação obrigatória |
| S1.4 Integrar no whatsapp-webhook | ✅ | Detecta IA ativa → chama debounce (fire-and-forget) |
| S1.5 Admin tab "Geral" | ✅ | Nome, saudação, personalidade, ativar, instância |
| S1.6 Admin tab "Cérebro" | ✅ | Prompt, modelo, temperatura, debounce, contexto |
| S1.7 GEMINI_API_KEY nos secrets | ✅ | Configurada via CLI |

**Sprint 2 — Catálogo e Knowledge**
| Task | Status | Descrição |
|------|--------|-----------|
| S2.1 Tabelas catálogo/knowledge/media | ✅ | 3 tabelas com full-text search index |
| S2.2 Admin tab "Catálogo" | ✅ | CRUD com upload fotos, filtros, IA descrição, foto destaque |
| S2.3 Admin tab "Conhecimento" | ✅ | FAQ CRUD + upload docs (PDF/TXT/DOC/DOCX 20MB) |
| S2.4 Tool search_products | ✅ | Gemini function calling → SQL filtros |
| S2.5 Tool send_carousel | ✅ | Carrossel de produtos WhatsApp via UAZAPI |
| S2.6 Tool send_media | ✅ | Imagem/documento via UAZAPI (image, video, document) |
| S2.7 Lógica de qualificação | ✅ | Qualificar → buscar → carrossel/mídia no system prompt |

**Sprint 3 — Handoff e Integrações**
| Task | Status | Descrição |
|------|--------|-----------|
| S3.1 Admin tab "Regras" | ✅ | Gatilhos texto, limites tempo/sentimento, cooldown, horário |
| S3.2 Tool handoff | ✅ | Gemini function calling → desativa IA, loga handoff |
| S3.3 Tools assign_label / set_tags | ✅ | Labels = pipeline, tags = "chave:valor" cumulativas |
| S3.4 Tool move_kanban | ✅ | Busca board por instance_id, move card por contact name |
| S3.5 Modo shadow | ✅ | status_ia='shadow', extrai dados sem responder |
| S3.6 Admin tab "Extração" | ✅ | ExtractionConfig.tsx, campos JSONB em ai_agents |
| S3.7 Admin tab "Guardrails" | ✅ | Tópicos bloqueados, frases proibidas, limite desconto |

**Sprint 4 — Voz, Métricas e Playground**
| Task | Status | Descrição |
|------|--------|-----------|
| S4.1 Admin tab "Voz" | ✅ | Toggle TTS, max text length config |
| S4.2 Áudio bidirecional | ✅ | TTS via Gemini → PTT se response ≤ max_text_length |
| S4.3 Admin tab "Métricas" | ✅ | KPIs, tokens, latência, tool usage, heatmap horário |
| S4.4 Admin tab "Playground" | ✅ | Chat simulado com métricas |
| S4.5 Sub-agentes configuráveis | ✅ | 5 modos (SDR/Sales/Support/Scheduling/Handoff) com prompts individuais |

**Sprint 5 — Contexto Longo e Leads**
| Task | Status | Descrição |
|------|--------|-----------|
| S5.1 Contexto longo persistente | ✅ | conversation_summaries JSONB em lead_profiles, auto-append, últimas 5 injetadas no prompt |
| S5.2 Módulo M11 "Leads" | ✅ | Página /dashboard/leads com tabela, detail panel, conversation modal, block IA, clear context |
| S5.3 Cartão do lead | ✅ | 6 seções Accordion: Perfil, Endereço, Campos Adicionais, Histórico, Ações, Arquivos |
| S5.4 Integração lead_profiles ↔ CRM | ✅ | contact_id FK em kanban_cards, auto-create card, avatar no card, estágio no Leads |
| S5.5 Duplicar config de agente | 📋 | Copiar entre instâncias |

**Sprint 6 — Agent QA Framework (M2)**
| Task | Status | Descrição |
|------|--------|-----------|
| S6.0 Pre-requisitos | ✅ | Fix activeSubAgents→activeSub, 38 migrations, tabela e2e_test_batches, types.ts regenerado |
| S6.1 Histórico Persistente de Batches | ✅ | useE2eBatchHistory/Runs/CreateBatch/CompleteBatch hooks + BatchHistoryTab (5ª aba Playground) — commit 4fe98ad |
| S6.2 Fluxo de Aprovação Admin | ✅ | useE2eApproval + ApprovalQueue + ReviewDrawer + badge de pendentes no header — commit 95ad466 |
| S6.3 Barra de Evolução (Score Composto) | ✅ | agentScoring.ts (E2E 40%+Validator 30%+Tools 20%+Latência 10%) + AgentScoreBar com trend — commit 95ad466 |
| S6.4 Ciclo Automatizado Teste → Ajuste → Re-teste | ✅ | Migration regressão + pg_cron + e2e-scheduled edge function + E2eSchedulePanel + RegressionBadge + BatchHistoryPanel |

**Edge Functions**: `ai-agent`, `ai-agent-debounce`, `ai-agent-playground`
**Tabelas**: `ai_agents`, `ai_agent_products`, `ai_agent_knowledge`, `ai_agent_media`, `ai_agent_logs`, `lead_profiles`, `ai_debounce_queue`, `e2e_test_batches`
**Skill**: `/ai-agent` — Roadmap detalhado com exemplos de fluxo por sprint

##### T10.1 — Builder Visual Drag-and-Drop
**Descrição completa**: Interface de canvas onde o usuário arrasta e conecta blocos (nodes) para criar fluxos conversacionais. Cada node representa uma ação no WhatsApp.

**Tipos de nodes disponíveis**:
| Node | Ícone | Função | Exemplo |
|------|-------|--------|---------|
| 📨 Enviar mensagem | MessageSquare | Envia texto, mídia ou carrossel | "Olá {{nome}}! Temos uma oferta especial pra você" |
| ❓ Fazer pergunta | HelpCircle | Envia pergunta e aguarda resposta | "Qual seu orçamento? 1) Até R$500 2) R$500-2000 3) Acima de R$2000" |
| 🔀 Condição | GitBranch | Avalia resposta e direciona fluxo | Se resposta contém "1" → oferta básica; "2" → oferta premium |
| ⏱️ Delay | Clock | Aguarda tempo antes de continuar | Esperar 24h antes de enviar follow-up |
| ⚡ Ação | Zap | Executa ação no sistema | Criar card no Kanban, adicionar tag, disparar webhook |
| 🏁 Fim | Flag | Encerra o funil | Marcar contato como "qualificado" |
| 🔄 Goto | ArrowRight | Pula para outro step do funil | Voltar ao início se resposta inválida |
| 🤖 IA | Brain | Processar resposta com IA | Analisar sentimento da resposta, classificar intenção |

**Exemplo visual de fluxo**:
```
[Trigger: keyword "promo"]
    ↓
[📨 "Oi {{nome}}! Temos 3 planos incríveis"]
    ↓
[❓ "Qual área te interessa? 1) Marketing 2) Vendas 3) Suporte"]
    ↓
[🔀 Condição: resposta]
   ├─ "1" → [📨 Detalhes Marketing] → [❓ "Quer agendar uma demo?"]
   ├─ "2" → [📨 Detalhes Vendas] → [❓ "Quer agendar uma demo?"]
   ├─ "3" → [📨 Detalhes Suporte] → [❓ "Quer agendar uma demo?"]
   └─ outro → [📨 "Não entendi. Responda 1, 2 ou 3"] → [🔄 Goto: pergunta]
```

**Implementação técnica**:
- Biblioteca: React Flow (ou similar) para canvas
- Persistência: JSON serializado em `funnels.flow_data` (JSONB)
- Preview: Simulador de conversa lado a lado com o builder
- Undo/redo: Histórico de estados com Ctrl+Z

---

##### T10.2 — Templates de Funil
**Descrição completa**: Galeria de funis pré-configurados que o usuário pode clonar e customizar. Cada template inclui fluxo completo, mensagens de exemplo e configurações recomendadas.

**Templates incluídos**:

| Template | Steps | Objetivo | Conversão esperada |
|----------|-------|----------|-------------------|
| 🎯 Qualificação de Lead | 5 | Coletar nome, empresa, orçamento, necessidade | Lead qualificado no CRM |
| 🛒 Venda Direta | 7 | Apresentar produto → objeções → checkout | Pedido criado |
| 🔄 Reengajamento | 4 | Contato inativo há 30+ dias → oferta especial | Reativação |
| 👋 Onboarding | 6 | Novo cliente → tutorial → primeiro uso → feedback | Ativação |
| ⭐ NPS/Satisfação | 3 | Nota 0-10 → feedback aberto → agradecimento | Score coletado |
| 📅 Agendamento | 4 | Serviço desejado → data/hora → confirmação | Reunião marcada |
| 🎁 Lançamento | 5 | Teaser → revelação → oferta limitada → urgência → CTA | Venda no lançamento |
| 🔧 Suporte Técnico | 6 | Problema → categoria → tentativa de resolução → escalar | Ticket resolvido ou escalado |
| 📚 Mini-curso grátis | 5 | Inscrição → aula 1 (dia 1) → aula 2 (dia 2) → aula 3 (dia 3) → oferta | Venda do curso completo |
| 🏷️ Carrinho Abandonado | 3 | Lembrete (1h) → desconto (24h) → urgência (48h) | Recuperação de venda |

**Exemplo — Template "Qualificação de Lead"**:
```
Step 1: [📨] "Olá {{nome}}! Vi que você se interessou pelo nosso serviço. Posso te fazer algumas perguntas rápidas?"
Step 2: [❓] "Qual o tamanho da sua empresa? 1) 1-10 funcionários 2) 11-50 3) 51-200 4) 200+"
Step 3: [❓] "Qual seu principal desafio hoje? 1) Captar clientes 2) Reter clientes 3) Automatizar processos 4) Outro"
Step 4: [❓] "Qual seu orçamento mensal para essa solução? 1) Até R$500 2) R$500-2k 3) R$2k-5k 4) Acima de R$5k"
Step 5: [⚡] Criar card no Kanban "Leads Qualificados" + [📨] "Perfeito! Um consultor vai entrar em contato em até 2h. Obrigado!"
```

---

##### T10.3 — Condições/Branching
**Descrição completa**: Sistema de regras que avalia a resposta do contato e direciona para caminhos diferentes no funil. Suporta múltiplos tipos de condição.

**Tipos de condição**:

| Tipo | Operador | Exemplo |
|------|----------|---------|
| Texto exato | `equals` | Resposta = "sim" |
| Contém texto | `contains` | Resposta contém "preço" |
| Regex | `matches` | Resposta match `/^\d{5}-?\d{3}$/` (CEP) |
| Numérico | `between` | Resposta entre 1 e 5 |
| Lista de opções | `in` | Resposta ∈ ["1", "2", "3"] |
| Tag do contato | `has_tag` | Contato tem tag "cliente_vip" |
| Campo customizado | `attribute` | Contato.cidade = "São Paulo" |
| Horário | `time_between` | Hora atual entre 9h-18h |
| Dia da semana | `day_of_week` | Hoje é segunda a sexta |
| Timeout | `no_response` | Sem resposta há 30 minutos |
| Sentimento IA | `sentiment` | IA detectou sentimento "negativo" |
| Intenção IA | `intent` | IA classificou como "quer_cancelar" |

**Exemplo de branching complexo**:
```
[❓ "Gostaria de agendar uma demonstração?"]
    ↓
[🔀 Condição]
   ├─ contains("sim", "quero", "claro", "bora") → [📨 "Ótimo! Qual o melhor dia?"]
   ├─ contains("não", "agora não", "depois") → [⏱️ Delay 48h] → [📨 "Sem problemas! Quando quiser, é só chamar 😊"]
   ├─ contains("preço", "quanto", "valor") → [📨 "Nossos planos começam em R$97/mês..."]
   ├─ no_response(30min) → [📨 "Vi que ficou ocupado! Quando puder, me diga se quer agendar 😊"]
   └─ default → [📨 "Não entendi. Pode responder 'sim' ou 'não'?"] → [🔄 Retry max 2x]
```

---

##### T10.4 — Triggers Automáticos
**Descrição completa**: Eventos que iniciam automaticamente a execução de um funil para um contato. Múltiplos triggers podem apontar para o mesmo funil.

**Tipos de trigger**:

| Trigger | Configuração | Exemplo |
|---------|-------------|---------|
| 🔑 Keyword | Lista de palavras-chave | Contato envia "promoção" → inicia funil de vendas |
| 🏷️ Tag adicionada | Nome da tag | Contato recebe tag "lead_quente" → inicia funil de qualificação |
| 🏷️ Tag removida | Nome da tag | Contato perde tag "ativo" → inicia funil de reengajamento |
| 👤 Novo contato | Inbox/instância | Primeira mensagem → inicia funil de boas-vindas |
| 📋 Formulário enviado | ID do formulário (M12) | Preencheu form de orçamento → inicia funil de vendas |
| 🛒 Pedido criado | Status do pedido (M11) | Novo pedido → inicia funil pós-venda |
| 🛒 Carrinho abandonado | Tempo de inatividade | Pedido pendente há 1h → inicia funil de recuperação |
| 📅 Schedule (cron) | Expressão cron | Todo dia 9h → enviar dica do dia para inscritos |
| 📊 Kanban move | Board + coluna destino | Card moveu para "Negociação" → inicia funil de proposta |
| ⏰ Data específica | Campo de data do contato | 7 dias antes de `contato.data_renovacao` → inicia funil de renovação |
| 🔗 Webhook externo | Endpoint recebe POST | Sistema externo dispara evento → inicia funil |
| 💬 Inatividade | Dias sem interação | Sem mensagem há 30 dias → inicia funil de reengajamento |

**Regras de execução**:
- Um contato só pode estar em 1 execução do mesmo funil por vez
- Cooldown configurável: "não reiniciar funil se executou nos últimos X dias"
- Prioridade: se múltiplos triggers disparam, executar o de maior prioridade
- Horário de execução: respeitar janela de envio (ex: 8h-20h)

---

##### T10.5 — Variáveis Dinâmicas
**Descrição completa**: Placeholders que são substituídos por dados reais do contato, pedido ou sistema no momento do envio.

**Variáveis disponíveis**:

| Categoria | Variável | Exemplo de saída |
|-----------|----------|-----------------|
| **Contato** | `{{nome}}` | "João" |
| | `{{nome_completo}}` | "João Silva" |
| | `{{telefone}}` | "+5511999887766" |
| | `{{email}}` | "joao@email.com" |
| | `{{cidade}}` | "São Paulo" (de custom attribute) |
| | `{{tag_list}}` | "cliente_vip, plano_pro" |
| **Pedido** (M11) | `{{pedido_numero}}` | "#1234" |
| | `{{pedido_total}}` | "R$ 297,00" |
| | `{{pedido_status}}` | "Enviado" |
| | `{{pedido_tracking}}` | "BR123456789" |
| **Curso** (M13) | `{{curso_nome}}` | "Marketing Digital" |
| | `{{curso_progresso}}` | "60%" |
| | `{{proxima_aula}}` | "Módulo 3: Tráfego Pago" |
| **CRM** (M4) | `{{kanban_coluna}}` | "Negociação" |
| | `{{kanban_valor}}` | "R$ 5.000,00" |
| **Sistema** | `{{data_hoje}}` | "21/03/2026" |
| | `{{hora_atual}}` | "14:30" |
| | `{{dia_semana}}` | "sexta-feira" |
| | `{{empresa_nome}}` | "MinhaEmpresa" (system_settings) |
| **Funil** | `{{resposta_anterior}}` | Última resposta do contato |
| | `{{step_atual}}` | "3 de 7" |
| **Custom** | `{{custom.campo_x}}` | Qualquer custom attribute do contato |

**Formatadores**:
- `{{nome|upper}}` → "JOÃO"
- `{{nome|lower}}` → "joão"
- `{{nome|capitalize}}` → "João"
- `{{pedido_total|currency}}` → "R$ 297,00"
- `{{data_hoje|relative}}` → "hoje" / "amanhã" / "segunda-feira"

**Fallbacks**: `{{nome|fallback:"amigo"}}` → Se nome vazio, usa "amigo"

---

##### T10.6 — A/B Testing de Mensagens
**Descrição completa**: Testar automaticamente variações de mensagens em cada step do funil para otimizar conversão.

**Como funciona**:
1. No builder, o usuário cria 2-4 variantes de um step
2. O sistema distribui aleatoriamente (50/50 ou configurável)
3. Após N execuções (mínimo estatístico), declara vencedor
4. Opção de auto-otimizar: após vencedor, direcionar 100% para ele

**Exemplo**:
```
Step 3 — Mensagem de oferta:
  Variante A (50%): "🔥 Oferta relâmpago! 40% OFF só hoje. Quer aproveitar?"
  Variante B (50%): "Separei um desconto especial pra você: 40% OFF. Posso aplicar no seu pedido?"

Resultados após 200 execuções:
  Variante A: 34% respondeu "sim" (68/200)
  Variante B: 51% respondeu "sim" (102/200)
  → Vencedor: Variante B (+17% conversão)
```

**Métricas rastreadas por variante**:
- Taxa de resposta (respondeu vs ignorou)
- Taxa de conversão (avançou no funil vs abandonou)
- Tempo médio de resposta
- Sentimento da resposta (via IA)

**Dashboard**: Tabela comparativa com significância estatística (p-value < 0.05)

---

