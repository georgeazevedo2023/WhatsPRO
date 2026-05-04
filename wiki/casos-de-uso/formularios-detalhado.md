---
title: Formularios WhatsApp — Documentacao Detalhada (Indice)
tags: [formularios, forms, form-bot, validacao, templates, webhook, detalhado, indice]
sources: [src/components/admin/forms/, supabase/functions/form-bot/, supabase/functions/form-public/]
updated: 2026-05-04
---

# Formularios WhatsApp — Coleta de Dados Interativa (Indice das 13 Sub-Funcionalidades)

> Os Formularios WhatsApp sao **questionarios interativos** que rodam dentro do proprio chat. Em vez de mandar o lead para um site externo, o formulario acontece na conversa: o bot faz uma pergunta, o lead responde, o bot valida e faz a proxima. No final, os dados sao salvos automaticamente no CRM.
>
> Funciona assim: o atendente (ou a IA) envia `FORM:orcamento` no chat. O bot assume a conversa, envia a mensagem de boas-vindas, e comeca a perguntar: "Qual seu nome?" → "Qual seu email?" → "Qual o tipo de servico?" → "Obrigado! Seus dados foram registrados." → Dados salvos como lead + card no Kanban.
>
> Existem **2 tipos** de formulario: (1) **No chat** — via trigger `FORM:slug`, o bot pergunta campo por campo dentro do WhatsApp. (2) **Na landing page** — formulario visual com campos lado a lado, preenchido no navegador antes de abrir o WhatsApp.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]], [[wiki/casos-de-uso/ai-agent-detalhado]], [[wiki/casos-de-uso/leads-detalhado]]

---

## Sub-paginas (organizadas por area)

A documentacao das 13 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/formularios-construtor]] | **8.1** Construtor de Formularios (Form Builder), **8.2** Os 16 Tipos de Campo, **8.3** 12 Templates Prontos |
| [[wiki/casos-de-uso/formularios-execucao]] | **8.4** Trigger no Chat (`FORM:slug`), **8.5** Sessao do Formulario (form-bot), **8.6** Validacoes por Tipo de Campo, **8.11** Formulario na Landing Page (form-public) |
| [[wiki/casos-de-uso/formularios-integracao]] | **8.7** Webhook Externo ao Completar, **8.8** Auto-Criacao de Lead, **8.9** Contexto no AI Agent, **8.10** "Usado Em" (Campanhas e Bio Links), **8.12** Submissoes (Historico de Respostas), **8.13** Automacao (Trigger `form_completed`) |

---

## Como navegar pelo formularios-detalhado

- Vai **montar um formulario novo** (editor visual, escolher tipos de campo, partir de template)? → `formularios-construtor`
- Quer entender **como o formulario roda** no WhatsApp ou na landing page (trigger, sessao, validacoes)? → `formularios-execucao`
- Precisa saber **o que acontece depois** que o lead completa (webhook, lead criado, IA recebe contexto, submissoes, automacao)? → `formularios-integracao`

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `whatsapp_forms` | Definicao do formulario (name, slug, status, webhook_url, welcome_message) |
| `form_fields` | Campos do formulario (type, label, validation_rules, position, required) |
| `form_sessions` | Sessoes em andamento no chat (current_field, collected_data, retries, status) |
| `form_submissions` | Respostas completas (data JSONB com todos os campos preenchidos) |

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Formularios usados na landing page
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA recebe dados do formulario no prompt
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados automaticamente + LeadFormsSection
- [[wiki/casos-de-uso/broadcast-detalhado]] — Enquetes (poll) no broadcast
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
