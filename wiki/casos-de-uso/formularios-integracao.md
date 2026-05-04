---
title: Formularios — Integracoes Pos-Conclusao (Webhook, Lead, AI, Automacao)
tags: [formularios, forms, webhook, lead, ai-agent, automacao, submissoes, detalhado]
sources: [supabase/functions/form-bot/, supabase/functions/_shared/leadHelper.ts, src/components/admin/forms/SubmissionsTable.tsx]
updated: 2026-05-04
---

# Formularios — Integracoes Pos-Conclusao

> Esta wiki cobre **o que acontece depois que o lead completa o formulario**: o webhook externo (POST HTTP fire-and-forget), a auto-criacao de contato e perfil de lead, o contexto que a IA recebe pra nao repetir perguntas, os badges "Usado em" mostrando onde o formulario esta sendo aplicado, a tabela de submissoes (com export CSV), e o gatilho de automacao `form_completed`.
>
> Sub-funcionalidades cobertas: **8.7**, **8.8**, **8.9**, **8.10**, **8.12**, **8.13**.
>
> Voltar ao indice: [[wiki/casos-de-uso/formularios-detalhado]]

---

## 8.7 Webhook Externo ao Completar

**O que e:** Quando o formulario e concluido, o sistema pode enviar os dados automaticamente para um **sistema externo** via POST HTTP.

**O que e enviado:**
```json
{
  "form_id": "uuid-do-formulario",
  "submission_id": "uuid-da-submissao",
  "data": {
    "nome": "Pedro Silva",
    "email": "pedro@email.com",
    "tipo_servico": "Exterior",
    "area_m2": 120
  }
}
```

**Cenario:** Empresa tem sistema proprio de orcamentos. Formulario "Orcamento" configurado com webhook `https://api.empresa.com/orcamentos`. Quando lead preenche → dados enviados automaticamente para o sistema de orcamentos → equipe recebe notificacao la.

> **Tecnico:** Campo `whatsapp_forms.webhook_url` TEXT nullable. POST fire-and-forget no form-bot apos completion (nao bloqueia). Timeout padrao do fetch. Sem retry (se falhar, dados estao salvos no form_submissions).

---

## 8.8 Auto-Criacao de Lead

**O que e:** Ao completar o formulario, o sistema cria automaticamente um contato e perfil de lead com os dados coletados. Nao precisa cadastrar manualmente.

**Mapeamento de campos:**
| Campo do formulario | Vira no perfil do lead |
|--------------------|-----------------------|
| nome / nome_completo | Nome completo (full_name) |
| email | Email |
| cpf | CPF |
| cidade / city | Cidade |
| estado / state | Estado |
| empresa / company | Empresa |
| cargo / role | Cargo |
| Outros campos | Campos customizados (custom_fields) |

**O que acontece:**
1. Contato criado/atualizado (upsert por telefone)
2. Perfil de lead criado/atualizado (upsert por contact_id)
3. Submissao salva em form_submissions (dados completos)
4. Tags aplicadas: `formulario:SLUG` + `origem:formulario`
5. Card no Kanban criado (se campanha tem kanban_board_id)

> **Tecnico:** Modulo compartilhado `_shared/leadHelper.ts`. Funcoes: `upsertContactFromPhone()`, `upsertLeadFromFormData()`. `FORM_FIELD_MAP` define mappings. Campos nao mapeados → `custom_fields` JSONB. Upsert ON CONFLICT contact_id. Usado por: form-bot, form-public, bio-public. NUNCA duplicar FIELD_MAP localmente.

---

## 8.9 Contexto no AI Agent

**O que e:** Apos o lead preencher um formulario, a IA recebe todos os dados coletados no seu prompt. Assim, a IA **nao repete perguntas** que o formulario ja fez.

**O que a IA recebe:**
```
<form_data>
Este lead preencheu o formulario "orcamento":
nome: Pedro Silva
tipo_servico: Exterior
area_m2: 120
observacoes: Fachada de predio comercial
NAO pergunte novamente informacoes que ja foram coletadas acima.
</form_data>
```

**Cenario:** Lead preencheu formulario com nome, tipo de servico e area. Depois manda mensagem no WhatsApp. A IA ja sabe: "Pedro quer pintura exterior de 120m² na fachada de predio comercial" → responde direto sobre precos e prazos, sem perguntar nada que ja foi respondido.

> **Tecnico:** AI Agent detecta tag `formulario:SLUG` na conversa → query `form_submissions` pelo contact_id → injeta dados no prompt como bloco `<form_data>`. Instrucao hardcoded: "NAO pergunte novamente informacoes que ja foram coletadas acima."

---

## 8.10 "Usado Em" (Campanhas e Bio Links)

**O que e:** Na lista de formularios, cada card mostra badges indicando **onde aquele formulario esta sendo usado** — em quais campanhas e em quais Bio Links.

**Badges:**
- Icone de megafone (azul) = Campanha usando esse formulario
- Icone de link (verde) = Bio Link usando esse formulario

**Cenario:** Formulario "Orcamento" mostra 2 badges: "Campanha Agosto" (azul) + "Bio Link Loja" (verde). O admin sabe que se modificar o formulario, vai afetar 2 canais.

> **Tecnico:** Hook `useFormUsage()` em FormsTab.tsx. Queries: `utm_campaigns.select('name, form_slug').in('form_slug', slugs)` + `bio_buttons.select('form_slug, bio_pages(title)').in('form_slug', slugs)`. Badges: Megaphone (campanha), Link2 (bio).

---

## 8.12 Submissoes (Historico de Respostas)

**O que e:** O admin pode ver todas as respostas de cada formulario em formato de tabela, com opcao de exportar como CSV.

**O que mostra:**
- Data e hora de cada submissao
- Todos os campos preenchidos (expandivel)
- Preview dos 2 primeiros campos
- Contagem: total de submissoes + submissoes de hoje

**Acoes:** Expandir detalhes, exportar CSV.

> **Tecnico:** Componente `SubmissionsTable.tsx`. Hook `useFormSubmissions(formId)`. Stats via RPC `get_form_stats(formId)` → {total, today}. Tabela `form_submissions` (form_id, session_id, contact_id, data JSONB, submitted_at). Export CSV: headers = Data + all field keys.

---

## 8.13 Automacao (Trigger form_completed)

**O que e:** O motor de automacao (M17) pode disparar acoes automaticas quando um formulario e concluido. Exemplo: "quando formulario 'orcamento' for preenchido, mover card para coluna 'Proposta' e enviar mensagem de agradecimento".

**Configuracao:** No editor de regras de automacao do funil, escolher gatilho "Formulario concluido" + opcionalmente filtrar por slug especifico.

> **Tecnico:** Trigger type `form_completed` no automationEngine. Config: `{ form_slug?: string }` (opcional, filtra slug). Chamado no form-bot apos completion: `executeAutomationRules(funnel_id, 'form_completed', { form_slug }, conversation_id)`. Fire-and-forget. Componente: `AutomationRuleEditor.tsx`.

---

## Links Relacionados

- [[wiki/casos-de-uso/formularios-detalhado]] — Indice das sub-wikis
- [[wiki/casos-de-uso/formularios-construtor]] — Construtor, tipos e templates
- [[wiki/casos-de-uso/formularios-execucao]] — Execucao no chat e na landing
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA recebe dados do formulario no prompt
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados automaticamente

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Extraido de formularios-detalhado.md como parte do particionamento (regra 14).*
