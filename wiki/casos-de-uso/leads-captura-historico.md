---
title: Leads — Captura, Auto-Criação e Histórico
tags: [leads, csv, formularios, auto-criacao, historico, detalhado]
sources: [src/components/broadcast/lead-importer/CsvTab.tsx, supabase/functions/_shared/leadHelper.ts, src/components/leads/LeadFormsSection.tsx, src/components/leads/ConversationModal.tsx]
updated: 2026-05-04
---

# Leads — Captura e Histórico (Sub-Funcionalidades 3.7, 3.8, 3.9, 3.11)

> Esta sub-wiki cobre **como os leads entram no sistema** (importação manual, auto-criação por formulário/Bio/campanha) e **como o atendente revisita o histórico** (formulários respondidos, modal de conversa). É a porta de entrada e a memória do contato.
>
> Ver índice: [[wiki/casos-de-uso/leads-detalhado]]

---

## 3.7 Importacao CSV

**O que e:** Upload de um arquivo CSV (planilha simples) ou Excel com lista de leads para cadastrar em massa. Util quando a empresa ja tem uma base de clientes em outra ferramenta e quer migrar para o WhatsPRO.

**Como funciona:**
- Arrasta o arquivo ou clica para selecionar (ate 10MB, maximo 50.000 linhas)
- O sistema detecta automaticamente o formato (virgula, ponto-e-virgula ou tabulacao)
- Identifica automaticamente as colunas de nome e telefone (busca palavras como "nome", "name", "telefone", "phone")
- Se nao encontrar automaticamente, mostra uma tela para o usuario mapear as colunas manualmente
- Valida os telefones (minimo 10 digitos)
- Protege contra formulas maliciosas em CSVs (remove caracteres como =, +, -, @ do inicio das celulas)

**Cenario real:** Loja de materiais tem planilha do Excel com 500 clientes do sistema antigo. Exporta como CSV → arrasta para o WhatsPRO → sistema detecta colunas "Nome" e "Celular" → 500 leads criados em 30 segundos → prontos para receber broadcast.

> **Tecnico:** Componente `src/components/broadcast/lead-importer/CsvTab.tsx`. Parse: delimiter auto-detect (,;⇥). Header detection: keywords array (nome, name, telefone, phone, numero, celular, whatsapp, contato, fone, tel). Phone-to-JID conversion. Limites: 10MB file size, 50k rows. CSV injection prevention: sanitize leading =, +, -, @. Output: `Lead[]` array. Drag-drop: onDragOver/onDrop handlers.

---

## 3.8 Auto-Criacao de Leads

**O que e:** Leads sao criados automaticamente — sem ninguem precisar cadastrar manualmente — quando acontece qualquer um desses eventos:

1. **Lead preenche formulario** (na landing page ou no chat WhatsApp) → sistema cria contato + perfil do lead automaticamente
2. **Lead clica no Bio Link e se cadastra** → sistema cria contato + perfil com origin='bio'
3. **Lead acessa link de campanha e manda mensagem** → sistema vincula a visita da campanha ao contato

**Mapeamento de campos do formulario para o perfil do lead:**
- Campo "nome" do formulario → nome completo do lead
- Campo "email" → email do lead
- Campo "cpf" → CPF do lead
- Campo "cidade" → cidade do lead
- Campos extras → salvos como campos personalizados

**Cenario real:** Lead ve post no Instagram → clica no link da campanha → chega na landing page → preenche formulario com nome, email e interesse → clica "Enviar" → sistema cria o contato, preenche o perfil, cria card no Kanban, marca a visita da campanha como convertida, e abre o WhatsApp. Quando o lead manda mensagem, a IA ja sabe o nome dele e o que preencheu no formulario.

> **Tecnico:** Auto-criacao em 3 edge functions: `form-public` (POST → upsert contact + lead_profile via leadHelper.ts), `bio-public` (action='capture' → upsert via leadHelper), `whatsapp-webhook` (match utm_visit quando conversa inicia). Modulo compartilhado: `_shared/leadHelper.ts` com `FORM_FIELD_MAP` (nome→full_name, email→email, cpf→cpf, cidade→city), `upsertContactFromPhone()`, `upsertLeadFromFormData()`. Campos extras → `custom_fields` JSONB. Upsert ON CONFLICT contact_id. Tags automaticas: `formulario:SLUG`, `origem:formulario`, `bio_page:SLUG`, `origem:bio`, `campanha:NOME`.

---

## 3.9 Formularios Respondidos (LeadFormsSection)

**O que e:** Uma secao no detalhe do lead que mostra **todos os formularios que aquele lead ja preencheu**, com os dados de cada um.

**O que mostra:**
- **Badge de contagem** — ex: "2 formularios" (numero total)
- **Lista de formularios** com: nome do formulario, tipo do template, data de envio
- **Preview rapido** — mostra os 2 primeiros campos preenchidos
- **Expandir** — clica para ver todos os dados coletados naquele formulario

**Cenario real:** Lead "Maria" preencheu 2 formularios: "Orcamento Pintura" (5 abr) com nome, CPF, tipo de servico, e "Pesquisa Satisfacao" (8 abr) com nota e comentario. O atendente ve tudo sem precisar procurar.

> **Tecnico:** Componente `src/components/leads/LeadFormsSection.tsx`. Query: `supabase.from('form_submissions').select('*, whatsapp_forms(name, slug, template_type)').eq('contact_id', X)`. Collapse/expand com state local. Preview: primeiros 2 entries de `data` JSONB. Expandido: todas as key-value pairs.

---

## 3.11 Modal de Conversa

**O que e:** Ao clicar numa conversa na lista de historico do lead, abre uma **janela (modal)** com o chat completo — sem sair da pagina do lead. Assim o atendente pode ler a conversa inteira mantendo o perfil do lead visivel.

**O que mostra:**
- Todas as mensagens da conversa em ordem cronologica
- Direcao: mensagens do lead (icone azul), mensagens da IA/atendente (icone do sistema), notas privadas (icone amarelo em italico)
- Midia: imagens, audios (com transcricao), videos, documentos
- Data e hora de cada mensagem
- Rola automaticamente para o final ao abrir

**Cenario:** Gerente quer ver o que aconteceu na conversa de 3 dias atras. Clica na conversa na lista → modal abre → le as 30 mensagens → entende o contexto → fecha o modal → volta ao perfil do lead.

> **Tecnico:** Componente `src/components/leads/ConversationModal.tsx`. Dialog (shadcn/ui). Query: `supabase.from('conversation_messages').select('*').eq('conversation_id', X).order('created_at')`. Renderizacao por direction: incoming (User icon, blue), outgoing (Bot icon, primary), private_note (Headphones icon, yellow, italic). Media: image renderiza img, audio mostra transcription se presente. Auto-scroll: `scrollRef.current?.scrollTo({ top: 99999 })` no useEffect.

---

## Apêndice — Árvore de Componentes

```
Leads.tsx (pagina principal — lista + KPIs + graficos)
+-- Filtros: busca, data, origem, kanban stage
+-- KPIs: total, novos, CRM, perfil, horario
+-- Graficos: leads/dia, origem, motivo, interesses
+-- Tabela de leads (cada linha)
|   +-- Avatar + nome + telefone
|   +-- Ultima conversa
|   +-- Tags count
|   +-- IA block badge
|   +-- Kanban stage badge
|   +-- Acoes: ver, toggle IA, limpar contexto

LeadDetail.tsx (pagina de detalhe — 2 colunas)
+-- Coluna Esquerda
|   +-- LeadProfileSection.tsx
|   |   +-- Avatar + nome + telefone
|   |   +-- Badge de origem (OriginBadge)
|   |   +-- Badge "IA Bloqueada"
|   |   +-- Toggle IA por instancia
|   +-- Campos editaveis (origem, email, documento, nascimento)
|   +-- Secao Endereco (rua, numero, bairro, cidade, CEP)
|   +-- Secao Campos Adicionais (custom_fields)
+-- Coluna Direita
|   +-- Secao CRM (kanban stage + link pro board)
|   +-- LeadFormsSection.tsx (formularios respondidos)
|   +-- LeadFunnelCard.tsx (funil ativo + etapa + dias)
|   +-- LeadJourneyTimeline.tsx (timeline visual)
|   +-- Historico de conversas
|       +-- ConversationModal.tsx (modal com chat completo)
```

---

## Apêndice — Tabelas do Banco Envolvidas

| Tabela | O que guarda |
|--------|--------------|
| `contacts` | Registro base do contato (phone, jid, name, ia_blocked_instances) |
| `lead_profiles` | Perfil enriquecido (25+ campos — nome, cidade, interesses, ticket, etc.) |
| `conversations` | Conversas WhatsApp (tags, ai_summary, status_ia) |
| `conversation_messages` | Mensagens individuais |
| `bio_lead_captures` | Capturas via Bio Link |
| `utm_visits` | Visitas de campanhas UTM |
| `form_submissions` | Respostas de formularios |
| `kanban_cards` | Cards do CRM (contact_id FK) |
| `kanban_columns` | Colunas/etapas do Kanban |
| `kanban_boards` | Quadros do CRM |
| `funnels` | Funis de conversao |
| `ai_agent_logs` | Logs de acoes da IA |

---

## Links Relacionados

- [[wiki/casos-de-uso/leads-detalhado]] — Índice das 12 sub-funcionalidades
- [[wiki/casos-de-uso/leads-visao-perfil]] — Página geral, perfil, badge de origem, timeline
- [[wiki/casos-de-uso/leads-inteligencia-controle]] — Block IA, Clear context, funil, Kanban
- [[wiki/banco-de-dados]] — Esquema completo do banco
- [[wiki/integracao-funis]] — Como Campanhas + Bio + Forms se conectam aos Leads
