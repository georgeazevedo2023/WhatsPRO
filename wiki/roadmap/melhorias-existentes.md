---
title: Roadmap — Melhorias em Módulos Existentes (R18-R30)
type: roadmap-detail
updated: 2026-05-11
---

### Detalhamento das Melhorias em Módulos Existentes (R18–R30)

#### R18 — Custom Attributes em Contatos (M2)
**Descrição**: Permitir campos personalizados key-value nos contatos, além dos campos fixos (nome, telefone, email).

**Interface do admin**:
- Config de atributos: nome, tipo (text, number, date, select, boolean, url), obrigatório
- Atributos visíveis no painel do contato (M2 ContactInfoPanel)
- Editáveis inline pelo agente durante atendimento
- Filtráveis na lista de conversas

**Exemplo de uso**:
```
Contato: João Silva
├── [Fixos] Nome, Telefone, Email
├── [Custom] Empresa: "TechCo Ltda"
├── [Custom] Cargo: "Diretor de Marketing"
├── [Custom] Plano: "Enterprise"
├── [Custom] MRR: "R$ 2.500"
├── [Custom] Data renovação: "15/06/2026"
└── [Custom] Fonte: "Google Ads"
```

**Uso em funis (M10)**: `{{custom.empresa}}`, `{{custom.plano}}`, `{{custom.mrr}}`
**Tabelas**: `contact_custom_fields` (definição), `contact_custom_values` (valores por contato)

---

#### R19 — Tags em Contatos (M2)
**Descrição**: Sistema de tags aplicáveis diretamente ao contato (não à conversa), persistente entre conversas.

**Diferença de labels (atual) vs tags (novo)**:
| Aspecto | Labels (atual) | Tags (novo) |
|---------|---------------|-------------|
| Aplicado a | Conversa | Contato |
| Persiste entre conversas | Não | Sim |
| Visível em | Lista de conversas | Perfil do contato + listas |
| Uso principal | Categorizar atendimento | Segmentar contato |
| Exemplo | "urgente", "aguardando retorno" | "cliente_vip", "lead_quente", "churned" |

**Exemplos de tags**:
- Segmentação: `lead`, `cliente`, `ex-cliente`, `parceiro`
- Score: `lead_quente`, `lead_morno`, `lead_frio`
- Produto: `plano_basic`, `plano_pro`, `plano_enterprise`
- Origem: `google_ads`, `instagram`, `indicacao`, `evento`
- Comportamento: `comprou_recente`, `inativo_30d`, `vip`

**Auto-tagging**: Regras automáticas (ex: "Se comprou nos últimos 30 dias → tag `comprou_recente`")

---

#### R20 — API Pública REST (Infra)
**Descrição**: API REST completa para integrações externas, inspirada na API v2 do ClickFunnels.

**Autenticação**: Bearer token por workspace
**Base URL**: `https://{workspace}.whatspro.com/api/v1`

**Endpoints planejados**:
```
Contacts:    GET/POST/PUT/DELETE  /api/v1/contacts
Tags:        GET/POST/DELETE      /api/v1/contacts/:id/tags
Conversations: GET               /api/v1/conversations
Messages:    GET/POST             /api/v1/conversations/:id/messages
Products:    GET/POST/PUT/DELETE  /api/v1/products
Orders:      GET/POST/PUT         /api/v1/orders
Funnels:     GET                  /api/v1/funnels
Courses:     GET                  /api/v1/courses
Enrollments: GET/POST             /api/v1/courses/:id/enrollments
Forms:       GET                  /api/v1/forms
Submissions: GET                  /api/v1/forms/:id/submissions
Webhooks:    GET/POST/PUT/DELETE  /api/v1/webhooks
```

**Rate limiting**: 100 requests/minuto por token
**Paginação**: cursor-based (`?after=cursor_abc&limit=25`)
**Filtros**: `?status=active&tag=vip&created_after=2026-01-01`

---

#### R21 — Pipeline Analytics (M4)
**Descrição**: Dashboard analítico para pipelines de vendas com forecast e métricas de velocidade.

**KPIs**:
| Métrica | Cálculo | Exemplo |
|---------|---------|---------|
| Pipeline Value | Soma valores de todos os cards | R$ 234.500 |
| Weighted Forecast | Σ(valor × probabilidade do stage) | R$ 87.200 |
| Win Rate | Cards "Ganho" / Total | 32% |
| Avg Deal Size | Valor médio dos cards ganhos | R$ 4.500 |
| Sales Velocity | (Nº deals × Win rate × Avg size) / Avg cycle | R$ 12.800/dia |
| Avg Cycle Time | Tempo médio de "Novo" até "Ganho" | 14 dias |
| Stage Conversion | % que avança de cada stage | Qualificado→Proposta: 65% |

---

#### R22 — Probabilidade de Fechamento por Stage (M4)
**Descrição**: Cada coluna do Kanban tem uma probabilidade associada, usada para forecast.

**Exemplo**:
```
Novo (10%) → Qualificado (25%) → Proposta (50%) → Negociação (75%) → Ganho (100%)
                                                                   → Perdido (0%)
```

---

#### R23 — Lead Scoring Automático (M2/M4)
**Descrição**: Pontuação automática do contato baseada em interações e perfil.

**Critérios de scoring**:
| Ação | Pontos | Decay |
|------|--------|-------|
| Respondeu mensagem | +5 | -1/semana |
| Clicou link | +10 | -2/semana |
| Completou formulário | +20 | — |
| Comprou produto | +50 | — |
| Abriu conversa | +3 | -1/semana |
| VIP tag | +30 | — |
| Inativo 30+ dias | -20 | — |

**Classificação automática**:
- 0-20: ❄️ Frio → tag `lead_frio`
- 21-50: 🌡️ Morno → tag `lead_morno`
- 51+: 🔥 Quente → tag `lead_quente`

---

#### R26 — Agendamento de Reuniões Calendly-like (M8)
**Descrição**: Contato escolhe data/hora disponível via WhatsApp.

**Fluxo**:
```
Bot: "Vamos agendar sua consultoria! Qual o melhor dia?"
Bot: "📅 Horários disponíveis esta semana:
      1) Ter 22/03 — 10h, 14h, 16h
      2) Qua 23/03 — 9h, 11h, 15h
      3) Qui 24/03 — 10h, 14h
      Responda com dia e hora (ex: 2, 15h)"
Contato: "2, 15h"
Bot: "✅ Agendado! Consultoria com {{agente}} em:
      📅 Qua 23/03/2026 às 15h00
      ⏱️ Duração: 30 minutos
      📍 Google Meet: {{link}}
      Vou te lembrar 1h antes! 😊"
```

**Configuração**: calendário de disponibilidade por agente, duração padrão, buffer entre reuniões, integração Google Calendar.

---

#### R27 — GDPR Compliance (M2)
**Descrição**: Anonimizar/excluir dados pessoais de contatos conforme LGPD/GDPR.

**Ações**:
- Redact: substitui dados por "[REDACTED]" (mantém histórico anônimo)
- Delete: exclui contato e todo histórico permanentemente
- Export: gera arquivo com todos os dados do contato (portabilidade)
- Consent log: registra quando/como contato deu consentimento

---

#### R28 — Webhooks Tipados por Evento (Infra)
**Descrição**: Expandir webhooks de saída para múltiplos eventos tipados.

**Eventos disponíveis**:
```
contact.created        contact.updated        contact.deleted
contact.tag.added      contact.tag.removed
conversation.created   conversation.resolved  conversation.assigned
message.received       message.sent
order.created          order.paid             order.shipped       order.delivered
form.submitted
funnel.started         funnel.completed       funnel.abandoned
course.enrolled        course.completed       lesson.completed
```

---

#### R29 — Multi-workspace (Infra)
**Descrição**: Hierarquia organizacional para agências e empresas com múltiplas marcas.

**Hierarquia**: Organização → Workspace → Inboxes/Recursos
- Uma organização pode ter múltiplos workspaces
- Cada workspace tem seus próprios contatos, produtos, funis
- Billing e usuários gerenciados na organização
- Switch entre workspaces sem logout

---

#### R30 — Image Management com Resize (Infra)
**Descrição**: Upload de imagens com geração automática de múltiplos tamanhos.

**Tamanhos gerados**:
| Nome | Dimensão | Uso |
|------|----------|-----|
| thumbnail | 100x100 | Listas, avatares |
| small | 300x300 | Cards, previews |
| medium | 600x600 | Catálogo, chat |
| large | 1200x1200 | Página de produto |
| original | Full size | Download |

**Formatos**: WebP (default, menor), JPEG (fallback), PNG (quando transparência)
**Storage**: Supabase Storage com CDN, max 10MB por imagem

---

