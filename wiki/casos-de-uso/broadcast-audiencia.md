---
title: Broadcast — Audiencia e Listas
tags: [broadcast, audiencia, leads, grupos, importacao, csv, verificacao, detalhado]
sources: [src/pages/dashboard/Broadcaster.tsx, src/pages/dashboard/LeadsBroadcaster.tsx, src/components/broadcast/LeadImporter.tsx, src/components/broadcast/LeadDatabaseSelector.tsx]
updated: 2026-05-04
---

# Broadcast — Audiencia e Listas

> Esta sub-wiki cobre **para quem voce envia** um broadcast: os 2 modos de envio (grupos vs leads), as 4 formas de montar lista, as listas salvas (Lead Databases) e a verificacao de numeros validos. Para **o que enviar** ver [[wiki/casos-de-uso/broadcast-conteudo]]; para **quando/como disparar** ver [[wiki/casos-de-uso/broadcast-execucao]].

---

## 6.2 Dois Modos de Envio: Grupos vs Leads

**O que e:** O Broadcast tem 2 fluxos separados dependendo de para quem voce quer enviar.

### Modo Grupos
Envia para **grupos do WhatsApp** (aqueles grupos com varias pessoas). Voce seleciona quais grupos, e a mensagem e enviada em cada grupo selecionado. A mensagem aparece no grupo, visivel para todos os membros.

- Selecao de grupos com checkbox e busca por nome
- Mostra quantidade de membros de cada grupo
- Opcao de **excluir admins** (so envia para membros normais)
- Quando exclui admins, pode escolher manualmente quais participantes incluir

### Modo Leads
Envia para **contatos individuais** (mensagem privada, nao em grupo). Voce monta uma lista de leads e a mensagem e enviada 1 a 1 para cada numero.

- Funciona como mensagem privada — cada lead recebe individualmente
- O lead nao sabe que foi mensagem em massa (parece mensagem pessoal)
- Pode usar listas de leads ja salvas (Lead Databases)

**Cenario comparativo:**
- **Modo Grupos:** "Bom dia a todos! Lembrando da reuniao amanha." → 5 grupos selecionados → mensagem aparece em cada grupo.
- **Modo Leads:** "Ola [Nome]! Temos uma oferta especial para voce." → 300 leads → cada um recebe mensagem privada individual.

> **Tecnico:** Modo Grupos: pagina `Broadcaster.tsx` (rota `/dashboard/broadcast`), 3 passos (instancia → grupos → mensagem). `GroupSelector.tsx` com checkbox multi-select, `useInstanceGroups` hook, `ParticipantSelector.tsx` quando exclude_admins=true. Modo Leads: pagina `LeadsBroadcaster.tsx` (rota `/dashboard/broadcast/leads`), `LeadImporter.tsx` para montar lista. Hook: `useBroadcastSend.ts` (grupos), `useLeadsBroadcaster.ts` (leads).

---

## 6.3 Importador de Leads (4 Formas de Montar Lista)

**O que e:** Antes de enviar no modo Leads, voce precisa montar a lista de quem vai receber. O sistema oferece 4 formas de importar contatos:

### Colar Numeros
Cola uma lista de numeros de telefone (um por linha ou separados por virgula). Pode colar no formato "Nome - Numero" ou so o numero.

**Cenario:** Copia 50 numeros de uma planilha → cola no campo → sistema valida → 48 validos, 2 invalidos.

### Importar CSV
Upload de arquivo CSV com colunas de nome e telefone. Auto-detecta separador e colunas. Maximo 50.000 contatos, 10MB.

**Cenario:** Exporta lista do sistema antigo → importa CSV → 500 leads prontos para broadcast.

### Extrair de Grupos
Seleciona grupos do WhatsApp e extrai os membros como lista individual. Remove duplicatas entre grupos. Exclui admins automaticamente.

**Cenario:** 3 grupos com 100 membros cada → extrai → 250 leads unicos (50 eram membros de mais de 1 grupo).

### Adicionar Manual
Digita telefone e nome um por um. Para quando precisa adicionar poucos contatos especificos.

> **Tecnico:** Componente `LeadImporter.tsx` com 4 tabs: `PasteTab.tsx` (parse "Nome - Numero", validacao), `CsvTab.tsx` (auto-detect delimiter, column mapping, max 10MB/50k rows, CSV injection sanitize), `GroupsTab.tsx` (multi-group extract, exclude admins, dedup by JID), `ManualTab.tsx` (single input + validate). Dados salvos em `lead_database_entries` (phone, name, jid, verification_status, verified_name, source, group_name). Verificacao: `verifyNumbers()` com progress tracking.

---

## 6.4 Lead Databases (Listas Salvas)

**O que e:** Em vez de montar a lista do zero toda vez, voce pode salvar listas de leads para reutilizar. Funciona como "listas de contatos" que ficam salvas no sistema.

**Como funciona:**
- Criar database com nome e descricao (ex: "Clientes VIP Abril")
- Importar contatos via qualquer dos 4 metodos (colar, CSV, grupos, manual)
- Selecionar multiplas databases para um unico broadcast
- Verificar numeros (checar quais sao validos no WhatsApp)
- Editar, renomear ou excluir databases

**Cenario:** Loja cria 3 listas: "Clientes VIP" (50 contatos), "Novos Leads Abril" (200 contatos), "Inativos 90 dias" (150 contatos). Cada broadcast pode usar 1 ou mais listas combinadas.

> **Tecnico:** Tabela `lead_databases` (id, user_id, name, description, leads_count, created_at, updated_at). Tabela `lead_database_entries` (phone, name, jid, verification_status ENUM, verified_name, source, group_name — unique phone per database, ON DELETE CASCADE). Componentes: `CreateLeadDatabaseDialog.tsx`, `EditDatabaseDialog.tsx`, `ManageLeadDatabaseDialog.tsx`, `LeadDatabaseSelector.tsx` (multi-select), `LeadList.tsx`. RLS: users veem proprias, super_admins veem todas.

---

## 6.11 Verificacao de Numeros

**O que e:** Antes de enviar para uma lista de leads, o sistema pode **verificar quais numeros sao validos** no WhatsApp. Numeros invalidos (desativados, nao existem) sao marcados e podem ser removidos da lista.

**Status possiveis:**
- **Valido** (verde) — numero ativo no WhatsApp, pode receber mensagem
- **Invalido** (vermelho) — numero nao existe ou nao tem WhatsApp
- **Pendente** — ainda nao verificado
- **Erro** — falha na verificacao

**Acoes pos-verificacao:**
- "Selecionar so validos" — remove invalidos automaticamente
- "Remover invalidos" — limpa a lista

**Cenario:** Lista de 500 numeros importados de planilha antiga. Roda verificacao → 420 validos, 65 invalidos, 15 erros. Remove invalidos → envia para 420.

> **Tecnico:** Funcao `verifyNumbers()` com progress tracking. Estado: verification_status ENUM (pending|valid|invalid|error). Campo verified_name: nome confirmado pelo WhatsApp. Verificacao via UAZAPI endpoint de check number. Componente `ContactsStep.tsx` mostra contagem por status. Filtros: validos/invalidos. Batch verification com progress bar.

---

## Links Relacionados

- [[wiki/casos-de-uso/broadcast-detalhado]] — Indice das 12 sub-funcionalidades
- [[wiki/casos-de-uso/broadcast-conteudo]] — O que enviar (texto, midia, carrossel, enquete, templates)
- [[wiki/casos-de-uso/broadcast-execucao]] — Quando e como disparar (agendamento, delay, progresso, historico)
- [[wiki/casos-de-uso/leads-detalhado]] — Base de leads usada como destinatario
