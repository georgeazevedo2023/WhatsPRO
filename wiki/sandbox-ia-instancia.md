---
title: Sandbox IA — Instância de Teste 558185749970
tags: [sandbox, testes, instancia, ai-agent, eletropiso]
sources: [DB prfcbfumyrrycsrcrvms, painel UAZAPI wsmart]
updated: 2026-05-06
---

# Sandbox IA — Instância de Teste

> Instância UAZAPI dedicada exclusivamente a testes E2E reais sem afetar atendentes do Eletropiso. Criada 2026-05-06 noite.

## Identificadores

| Item | Valor |
|---|---|
| **Número conectado** | `558185749970` |
| **Instance ID (DB)** | `rb84e079eeab167` |
| **Instance Name** | `Sandbox IA` |
| **Instance Token** | `9a6ff3f5-31ee-4302-9fd6-5d4bc488ff5e` |
| **Server URL** | `https://wsmart.uazapi.com` |
| **Status** | `connected` |
| **Inbox ID** | `337ad397-e615-4f92-90a7-6565fe46699b` |
| **Department ID** | `c641a685-342b-418b-b0af-524086064043` (Sandbox Vendas) |
| **AI Agent ID** | `9c71f43e-d102-444f-a9b6-96128b1cd731` (Sandbox Agent) |
| **Webhook URL** | `https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/whatsapp-webhook` |

## Configuração

- **Modo Fila:** OFF (single-assignee = George, sem round-robin pra simplicidade)
- **Default assignee:** George (super_admin)
- **business_hours:** `NULL` deliberado — Sandbox atende 24/7
- **AI Agent:** clone integral do agente Eletropiso (`r466a98889b5809`):
  - 23 service_categories (mesmas do Eletropiso real)
  - sub_agents, prompt_sections, validator_enabled, business_info, excluded_products
  - greeting_message, returning_greeting_message, handoff_triggers, etc
  - Única diferença vs Eletropiso: `business_hours = NULL`

## Webhook UAZAPI

Configurado no painel UAZAPI (`https://wsmart.uazapi.com`) da instância **Testador da Eletropiso**:

```
URL: https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/whatsapp-webhook
Method: POST
Eventos escutados: messages
Eventos excluídos: wasSentByApi, isGroupYes
```

Sem n8n no meio — UAZAPI bate direto no Supabase edge fn.

## Vantagens vs testar no Eletropiso real

| Aspecto | Eletropiso real | Sandbox IA |
|---|---|---|
| Polui métricas | Sim | Não |
| Afeta atendentes | Sim (round-robin pega Lucas/Alberto/etc) | Não (só George) |
| Pode mexer no agente | Risco de quebrar prod | Livre |
| Horário de atendimento | Limita testes | 24/7 |
| Conversas misturadas | Sim | Isoladas |

## Como criar nova instância similar (referência)

1. Conta UAZAPI cria instância e gera token
2. No painel UAZAPI, configurar webhook → URL do `whatsapp-webhook`
3. Cadastrar via SQL (template em `wiki/sandbox-ia-instancia.md` no commit `5672caf`):
   - INSERT em `instances` (id, name, token, owner_jid)
   - INSERT em `inboxes` apontando pra instance
   - INSERT em `departments` com `is_default=true`
   - UPDATE `inboxes.default_department_id` → dept criado
   - INSERT em `inbox_users` (super_admin com tudo)
   - INSERT em `department_members` (queue_position 10, available)
   - INSERT em `user_instance_access`
   - Clonar `ai_agents` da instância modelo

## Cleanup (se quiser deletar tudo)

```sql
-- Em ordem reversa de FKs
DELETE FROM ai_agents WHERE instance_id = 'rb84e079eeab167';
DELETE FROM department_members WHERE department_id = 'c641a685-342b-418b-b0af-524086064043';
DELETE FROM inbox_users WHERE inbox_id = '337ad397-e615-4f92-90a7-6565fe46699b';
DELETE FROM departments WHERE id = 'c641a685-342b-418b-b0af-524086064043';
DELETE FROM inboxes WHERE id = '337ad397-e615-4f92-90a7-6565fe46699b';
DELETE FROM user_instance_access WHERE instance_id = 'rb84e079eeab167';
DELETE FROM instances WHERE id = 'rb84e079eeab167';
```

## Cross-refs

- [[wiki/plano-testes-sandbox]] — 15 cenários de teste
- [[wiki/erros-e-licoes]] — R103 (ordem qualif), R104 (brand falso positivo), R105 (business_hours), R106 (cooldown out-of-hours)
- [[wiki/migracao-eletropiso-COMPLETA]] — projeto novo onde a Sandbox vive
