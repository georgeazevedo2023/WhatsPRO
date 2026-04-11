---
title: Formularios WhatsApp — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [formularios, forms, form-bot, validacao, templates, webhook, detalhado]
sources: [src/components/admin/forms/, supabase/functions/form-bot/, supabase/functions/form-public/]
updated: 2026-04-10
---

# Formularios WhatsApp — Coleta de Dados Interativa (13 Sub-Funcionalidades)

> Os Formularios WhatsApp sao **questionarios interativos** que rodam dentro do proprio chat. Em vez de mandar o lead para um site externo, o formulario acontece na conversa: o bot faz uma pergunta, o lead responde, o bot valida e faz a proxima. No final, os dados sao salvos automaticamente no CRM.
>
> Funciona assim: o atendente (ou a IA) envia `FORM:orcamento` no chat. O bot assume a conversa, envia a mensagem de boas-vindas, e comeca a perguntar: "Qual seu nome?" → "Qual seu email?" → "Qual o tipo de servico?" → "Obrigado! Seus dados foram registrados." → Dados salvos como lead + card no Kanban.
>
> Existem **2 tipos** de formulario: (1) **No chat** — via trigger `FORM:slug`, o bot pergunta campo por campo dentro do WhatsApp. (2) **Na landing page** — formulario visual com campos lado a lado, preenchido no navegador antes de abrir o WhatsApp.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]] (formularios na landing page), [[wiki/casos-de-uso/ai-agent-detalhado]] (IA recebe dados do formulario), [[wiki/casos-de-uso/leads-detalhado]] (leads criados automaticamente)

---

## 8.1 Construtor de Formularios (Form Builder)

**O que e:** Editor visual onde o admin monta o formulario campo por campo. Tem 3 abas: Campos (editor principal), Configuracoes, e Preview (como vai ficar no chat).

**Como funciona:**
- **Lista de campos** no lado esquerdo — arrastar para reordenar
- **Editor do campo** no lado direito — tipo, label, obrigatorio, validacao
- **Adicionar campo** — botao "+" com seletor de tipo
- **Preview** — simula como o formulario aparece no chat do WhatsApp

**Configuracoes do formulario:**
- Nome e descricao
- Mensagem de boas-vindas (exibida ao iniciar)
- Mensagem de conclusao (exibida ao terminar)
- URL de webhook (envia dados para sistema externo ao completar)
- Maximo de submissoes (limita quantas vezes pode ser preenchido)
- Data de expiracao (formulario desativa automaticamente)
- Status: Ativo / Rascunho / Arquivado

**Cenario real:** Admin cria formulario "Orcamento Pintura": campo 1 "Nome" (texto, obrigatorio), campo 2 "Telefone" (phone, obrigatorio), campo 3 "Tipo de servico" (select: Interior/Exterior/Fachada), campo 4 "Area em m²" (number, min 1 max 999), campo 5 "Observacoes" (long_text, opcional). Preview mostra como vai ficar no chat.

> **Tecnico:** Componente `FormBuilder.tsx` (440+ linhas, 3 tabs). `FieldEditor.tsx` (editor por campo). `FormPreview.tsx` (preview chat-like). Hooks: `useUpdateForm()`, `useUpsertFormFields()`. Auto-slug: kebab-case + base36(Date.now()). Unique constraint: (agent_id, slug). Tabela `whatsapp_forms` + `form_fields`.

---

## 8.2 Os 16 Tipos de Campo

**O que e:** Cada campo do formulario tem um tipo que define como o lead responde e como a resposta e validada.

| Tipo | O que e | Validacao | Exemplo |
|------|---------|-----------|---------|
| **short_text** | Texto curto (1 linha) | Opcional min/max chars | "Seu nome?" |
| **long_text** | Texto longo (paragrafo) | Opcional min/max chars | "Descreva o servico" |
| **number** | Numero | Min/max configuravel | "Area em m²?" |
| **scale** | Escala (ex: 0-10) | Min/max da escala | "Nota de 0 a 10?" |
| **email** | E-mail | Regex de email | "Seu email?" |
| **phone** | Telefone | Min 10 digitos com DDD | "Seu celular?" |
| **cpf** | CPF | 11 digitos + checksum | "Seu CPF?" |
| **cep** | CEP | Exatamente 8 digitos | "Seu CEP?" |
| **date** | Data | Formato DD/MM/AAAA | "Data preferida?" |
| **time** | Hora | Formato HH:MM | "Horario preferido?" |
| **select** | Selecao unica | Numero (1-N) ou texto | "Tipo: Interior/Exterior?" |
| **multi_select** | Selecao multipla | Virgula ou espaco separando | "Interesses? (pode escolher varios)" |
| **yes_no** | Sim ou Nao | sim/nao/s/n | "Tem seguro?" |
| **file** | Upload de arquivo | Tipos e tamanho max | "Envie a foto do local" |
| **signature** | Confirmacao de aceite | Texto exato (padrao "ACEITO") | "Digite ACEITO para confirmar" |
| **poll** | Enquete nativa WhatsApp | Toque na opcao | Botoes clicaveis no WhatsApp |

**Cenario:** Formulario medico: "Nome?" (short_text) → "Data de nascimento?" (date) → "Tem alergias?" (yes_no) → "Quais medicamentos toma?" (long_text) → "Nota para o atendimento anterior?" (scale 0-10)

> **Tecnico:** Enum `FieldType` em `src/types/forms.ts` (16 valores). Validacao no form-bot: CPF checksum (2 digitos verificadores), email regex, CEP 8 digits strip non-digits, phone min 10 digits, date DD/MM/AAAA, time HH:MM, scale/number min/max de `validation_rules` JSONB. Select: match por indice (1-based) ou texto case-insensitive. Poll: via `/send/menu` (UAZAPI, type=poll), fallback texto se falhar.

---

## 8.3 12 Templates Prontos

**O que e:** Ao criar um formulario, o admin pode comecar do zero ou escolher entre 12 modelos prontos que ja vem com campos pre-configurados.

| Template | Campos | Uso |
|----------|--------|-----|
| **NPS** | Nota 0-10 + comentario | Pesquisa de satisfacao |
| **Sorteio** | Nome + telefone + CPF + aceite | Inscricao em sorteio |
| **Satisfacao** | Nota servico + nota produto + recomendaria + comentario | Pesquisa pos-compra |
| **Cadastro** | Nome + email + CPF + nascimento + cidade | Pre-cadastro cliente |
| **Consulta** | Nome + especialidade + data + hora + convenio | Agendamento medico |
| **Orcamento** | Tipo servico + area m² + cidade + prazo + descricao | Pedido de orcamento |
| **Evento** | Nome + email + empresa + cargo + participantes | Inscricao em evento |
| **Pesquisa Produto** | Produto + orcamento + prazo + uso | Qualificacao de interesse |
| **Anamnese** | Nome + nascimento + queixa + alergias + medicamentos | Pre-consulta medica |
| **Vaga** | Nome + email + cargo + experiencia + portfolio | Candidatura a emprego |
| **Chamado** | Tipo problema + descricao + urgencia + nome | Abertura de suporte |
| **Feedback** | Nota atendente + tempo espera + resolvido + sugestoes | Feedback pos-atendimento |

**Cenario:** Admin quer formulario de orcamento → seleciona template "Orcamento" → 5 campos ja pre-configurados → ajusta labels → salva → pronto para usar.

> **Tecnico:** Templates em `FORM_TEMPLATES` array em `src/types/forms.ts` (linhas 125-790). Cada template: name, description, icon (lucide), color, welcome_message, completion_message, fields[]. Galeria: `TemplateGallery.tsx` com cards coloridos. Criacao: `useCreateForm()` mutation com campos do template.

---

## 8.4 Trigger no Chat (FORM:slug)

**O que e:** Para iniciar um formulario no chat do WhatsApp, basta enviar a mensagem `FORM:slug` (ex: `FORM:orcamento`). O bot assume e comeca a perguntar.

**Quem pode enviar o trigger:**
- O atendente manualmente (digita no chat)
- A IA automaticamente (quando detecta que precisa coletar dados estruturados)
- Uma automacao (regra do motor de automacao)

**Fluxo:**
1. Mensagem `FORM:orcamento` chega no webhook
2. form-bot intercepta ANTES do AI Agent
3. Busca formulario pelo slug + agent_id
4. Verifica: ativo? Nao expirou? Limite de submissoes?
5. Cria sessao (form_sessions) com status `in_progress`
6. Envia mensagem de boas-vindas + primeira pergunta
7. A partir daqui, cada resposta do lead e processada pelo form-bot (nao pela IA)

> **Tecnico:** Detection no webhook: `content.startsWith('FORM:')` → redireciona para form-bot. Edge function `form-bot/index.ts`. Busca: `whatsapp_forms` WHERE slug = X AND agent_id = Y AND status = 'active'. Checks: max_submissions (count form_submissions), expires_at. Sessao: INSERT em `form_sessions` (form_id, conversation_id, contact_id, current_field_index=0, collected_data={}, status='in_progress', retries=0).

---

## 8.5 Sessao do Formulario (form-bot)

**O que e:** Enquanto o formulario esta em andamento, o bot gerencia uma "sessao" — sabe em qual campo esta, o que ja foi respondido, e quantas tentativas o lead ja fez.

**Como funciona campo por campo:**
1. Bot envia a pergunta do campo atual (com instrucoes de formato se necessario)
2. Lead responde
3. Bot valida a resposta:
   - **Valida** → salva, avanca para proximo campo
   - **Invalida** → incrementa tentativas, reenvia pergunta com mensagem de erro
4. Apos 3 tentativas invalidas no mesmo campo → sessao abandonada

**Tratamentos especiais:**
- **Campo select:** Bot envia opcoes numeradas? **NAO!** Envia nomes limpos. Lead pode responder com o numero (1, 2, 3) OU com o texto ("Interior", "Exterior"). Ambos aceitos.
- **Campo poll:** Em vez de texto, envia enquete nativa do WhatsApp com botoes clicaveis.
- **Campo skip_if_known:** Se o lead ja tem nome/email no perfil, pula a pergunta.
- **Respostas de pular:** Lead pode digitar "pular", "skip", "–" ou "-" para pular campos opcionais.

**Timeout:** Sessao expira apos 24 horas de inatividade (lead parou de responder).

> **Tecnico:** Edge function `form-bot/index.ts` (526 linhas). Sessao em `form_sessions` (current_field_index INT, collected_data JSONB, retries INT, status ENUM). Validacao: funcoes separadas por tipo (validateCpf, validateEmail, etc.). Normalizacao: `normalizeAnswer()` converte resposta para tipo correto (number→parseFloat, yes_no→boolean, select→option text). Max retries: 3 (MAX_RETRIES constant). TTL: 24h (SESSION_TTL_MS = 86400000). Skip: check `field.skip_if_known` + existing lead data.

---

## 8.6 Validacoes por Tipo de Campo

**O que e:** Cada tipo de campo tem regras de validacao automaticas. O lead nao consegue avancar sem responder corretamente.

| Tipo | Regra de validacao | Exemplo de erro |
|------|-------------------|-----------------|
| **CPF** | 11 digitos + algoritmo de checksum (2 digitos verificadores) | "CPF invalido. Verifique e tente novamente." |
| **Email** | Regex: usuario@dominio.extensao | "Email invalido. Formato: nome@email.com" |
| **CEP** | Exatamente 8 digitos (remove pontos e tracos) | "CEP invalido. Informe 8 digitos." |
| **Telefone** | Minimo 10 digitos com DDD (remove formatacao) | "Telefone invalido. Informe com DDD." |
| **Data** | Formato DD/MM/AAAA | "Data invalida. Formato: DD/MM/AAAA" |
| **Hora** | Formato HH:MM | "Hora invalida. Formato: HH:MM" |
| **Numero** | Numerico + min/max se configurado | "Numero invalido" ou "Valor fora do limite" |
| **Escala** | Inteiro dentro do range (ex: 0-10) | "Informe um numero de 0 a 10" |
| **Sim/Nao** | sim/nao/s/n (case-insensitive) | "Responda 'sim' ou 'nao'" |
| **Selecao** | Indice (1-N) ou texto exato da opcao | "Opcao invalida. Escolha entre as opcoes." |
| **Assinatura** | Texto EXATO do aceite (padrao "ACEITO") | "Digite ACEITO para confirmar" |

> **Tecnico:** Validacoes em form-bot lines 12-87. CPF: 11 digits + Luhn-like check (sum digitos * posicao, mod 11). Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. CEP: strip non-digits, length === 8. Phone: strip non-digits, length >= 10. Select: try parseInt (1-based index) → fallback text match case-insensitive. Mensagens de erro: campo `error_message` no form_fields, fallback "Resposta invalida. Por favor, tente novamente."

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

## 8.11 Formulario na Landing Page (form-public)

**O que e:** Alem do formulario no chat (via FORM:slug), o mesmo formulario pode ser renderizado como **formulario visual numa pagina web** (landing page das campanhas). O lead preenche no navegador antes de abrir o WhatsApp.

**Diferenca do formulario no chat:**
| | No Chat (form-bot) | Na Landing (form-public) |
|---|-------------------|------------------------|
| Onde aparece | Dentro do WhatsApp | Numa pagina web |
| Como funciona | Pergunta por pergunta | Todos os campos de uma vez |
| Validacao | Servidor (edge function) | Cliente (JavaScript no navegador) |
| Acesso | Precisa de conversa | Publico (sem login) |

**Cenario:** Campanha com landing_mode='form' → lead clica no link → ve formulario bonito com todos os campos → preenche → clica enviar → lead criado + WhatsApp abre.

> **Tecnico:** Edge function `form-public/index.ts`. GET `?slug=X&instance_id=Y` → retorna form definition + fields (sem JWT). POST `{ slug, data, phone, ref_code?, bio_page?, bio_btn? }` → upsert contact + lead_profile (via leadHelper), INSERT form_submission, match utm_visit se ref_code, auto-create kanban card se campaign.kanban_board_id, tags. CORS: wildcard '*'. Componente: `LandingForm.tsx` com validacao client-side (CPF checksum, email regex, phone 10+, CEP 8 digits).

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

## Arvore de Componentes

```
WhatsappFormsPage.tsx (admin — /dashboard/forms)
+-- Agent selector (dropdown)
+-- FormsTab.tsx (lista + acoes)
    +-- TemplateGallery.tsx (12 templates + blank)
    +-- FormCard (cada formulario)
    |   +-- Badges "Usado em" (campanhas + bios)
    |   +-- Acoes: editar, submissoes, trigger, arquivar, excluir
    +-- FormBuilder.tsx (editor — Sheet lateral)
    |   +-- Tab Campos: lista + FieldEditor.tsx
    |   +-- Tab Configuracoes: nome, webhook, limites
    |   +-- Tab Preview: FormPreview.tsx (chat-like)
    +-- SubmissionsTable.tsx (tabela de respostas + export CSV)

LandingForm.tsx (formulario na landing page — chamado por CampaignRedirect)
+-- Campos dinamicos com validacao client-side
+-- Submit → form-public POST → redirect WhatsApp
```

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
