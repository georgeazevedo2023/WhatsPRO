---
title: Motor de Automacao — Componentes (Gatilhos, Condicoes, Acoes)
tags: [automacao, gatilho, condicao, acao, engine, regras, detalhado, componentes]
sources: [supabase/functions/_shared/automationEngine.ts]
updated: 2026-05-04
---

# Motor de Automacao — Componentes (3 Sub-Funcionalidades)

> Esta sub-wiki cobre os **blocos de construcao** das regras de automacao: os 7 gatilhos (o que dispara), as 4 condicoes (o filtro) e as 6 acoes (o que fazer). Sao os tres pilares "QUANDO → SE → ENTAO" do motor.
>
> Voltar ao indice: [[wiki/casos-de-uso/motor-automacao-detalhado]]

---

## 9.1 Os 7 Gatilhos (Triggers) — O Que Dispara a Regra

**O que e:** O gatilho define **qual evento** faz a regra ser avaliada. Quando o evento acontece, o motor verifica se a condicao e verdadeira e, se for, executa a acao.

| # | Gatilho | O que dispara | Dados passados | Status |
|---|---------|--------------|---------------|--------|
| 1 | **Card movido** | Card muda de coluna no Kanban | coluna destino, coluna origem | Definido, hook pendente |
| 2 | **Formulario concluido** | Lead termina de preencher formulario | slug do formulario | ✅ Ativo (form-bot) |
| 3 | **Enquete respondida** | Lead vota numa enquete | id da enquete, opcoes escolhidas | ✅ Ativo (webhook) |
| 4 | **Lead criado** | Novo contato entra no sistema | (sem filtro) | Definido, hook pendente |
| 5 | **Conversa resolvida** | Atendente finaliza atendimento | (sem filtro) | Definido, NPS usa separado |
| 6 | **Tag adicionada** | Tag especifica aplicada na conversa | tag exata ou prefixo | Definido, hook pendente |
| 7 | **Etiqueta aplicada** | Etiqueta visual colocada na conversa | nome da etiqueta | Definido, hook pendente |

**Sub-filtros por gatilho (opcional):**
- Card movido: filtrar por coluna destino E/OU coluna origem
- Formulario: filtrar por slug especifico (vazio = qualquer formulario)
- Enquete: filtrar por enquete especifica E/OU opcao selecionada
- Tag: filtrar por tag exata ("motivo:compra") ou prefixo ("motivo:")

**Cenario detalhado:** Funil "Venda" tem regra com gatilho "Formulario concluido" + sub-filtro slug="orcamento". Quando lead preenche formulario de orcamento → gatilho dispara. Quando preenche formulario de cadastro → gatilho NAO dispara (slug diferente).

> **Tecnico:** Enum `TriggerType`: 'card_moved'|'form_completed'|'poll_answered'|'lead_created'|'conversation_resolved'|'tag_added'|'label_applied'. Funcao `matchesTriggerConfig(triggerType, triggerData, config)` faz matching. form_completed chamado no form-bot (linhas 443-463) com `executeAutomationRules(funnelId, 'form_completed', {form_slug}, conversationId)`. poll_answered chamado no webhook poll_update (linhas 330-344). Triggers 1,4,5,6,7 definidos no schema mas hooks de chamada nao implementados ainda.

---

## 9.2 As 4 Condicoes (Conditions) — O Filtro Antes da Acao

**O que e:** Apos o gatilho disparar, a condicao e um **filtro extra** que decide se a acao deve realmente ser executada. E opcional — se nao quiser filtro, usa "Sempre".

| # | Condicao | Como funciona | Config |
|---|---------|--------------|--------|
| 1 | **Sempre** | Executa sem nenhuma verificacao | Nenhuma |
| 2 | **Tag contem** | So executa se a conversa tem uma tag especifica | Tag exata ou prefixo |
| 3 | **Horario comercial** | So executa dentro OU fora do horario | Dentro/fora + horario + dias |
| 4 | **Funil e** | So executa se o lead esta num funil especifico | ID do funil |

**Detalhamento da condicao "Tag contem":**
- Verifica se a conversa tem a tag exata (ex: "motivo:compra")
- OU se tem alguma tag que comeca com o prefixo (ex: "motivo:" matcha "motivo:compra", "motivo:suporte", etc.)
- Se a conversa nao tem tags, retorna falso

**Detalhamento da condicao "Horario comercial":**
- Verifica a hora atual no fuso horario de Sao Paulo (America/Sao_Paulo)
- Pode ser "Dentro do horario" (ex: seg-sex 8h-18h) ou "Fora do horario"
- Padrao: segunda a sexta, 8h as 18h
- Dias da semana configuraveis (0=domingo a 6=sabado)

**Cenario:** Regra "Quando formulario concluido (gatilho) E conversa tem tag 'motivo:compra' (condicao) → mover card para Proposta (acao)". Se o lead preencheu o formulario mas a tag e "motivo:suporte", a acao NAO executa.

> **Tecnico:** Funcao async `evaluateCondition(conditionType, config, conversationId, funnelId, supabase)` → boolean. tag_contains: query `conversations.tags` WHERE id, check `tags.some(t => t === tag || t.startsWith(tag))`. business_hours: `new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })`, compara hour e day com config (start_hour default 8, end_hour default 18, work_days default [1,2,3,4,5]). funnel_is: comparacao simples de UUID. Desconhecido: retorna true (fail-open).

---

## 9.3 As 6 Acoes (Actions) — O Que Fazer

**O que e:** A acao e o que o motor faz quando o gatilho disparou E a condicao passou. Cada regra tem 1 acao.

### Acao 1: Enviar Mensagem
Envia uma mensagem de texto pelo WhatsApp para o lead. Util para confirmacoes automaticas, agradecimentos, lembretes.

**Cenario:** Formulario concluido → envia "Obrigado! Recebemos seu orcamento. Um consultor vai entrar em contato em breve."

**Fluxo interno:** Carrega conversa + contato → busca token da instancia → POST para UAZAPI `/send/text` → salva mensagem no historico do helpdesk.

### Acao 2: Mover Card
Move o card do lead para outra coluna no Kanban. Util para avancar etapas automaticamente.

**Cenario:** Formulario de orcamento preenchido → card move de "Novo" para "Proposta Enviada".

### Acao 3: Adicionar Tag
Aplica uma tag na conversa. Se ja existe tag com a mesma chave (ex: "etapa:"), substitui.

**Cenario:** Enquete respondida com "Compra" → adiciona tag "interesse:compra".

### Acao 4: Ativar IA
Liga o agente IA na conversa (status_ia = 'ligada'). Util para reativar a IA apos alguma acao manual.

**Cenario:** Lead preenche formulario com dados completos → IA ativada para dar continuidade com informacoes.

### Acao 5: Transferir (Handoff)
Coloca a conversa em modo shadow (IA para de responder) e opcionalmente atribui a um departamento ou atendente.

**Cenario:** Enquete respondida com "Falar com humano" → conversa transferida para departamento "Vendas".

### Acao 6: Enviar Enquete
Envia uma enquete nativa do WhatsApp (botoes clicaveis). Pode incluir imagem antes e auto-tags por opcao.

**Cenario:** Conversa resolvida → envia enquete NPS "Como foi seu atendimento?" com opcoes Excelente/Bom/Regular/Ruim/Pessimo.

> **Tecnico:** Funcao async `executeAction(actionType, config, conversationId, supabase)` → string (resultado). send_message: POST UAZAPI `/send/text` + INSERT conversation_messages. move_card: UPDATE kanban_cards SET column_id WHERE contact_id. add_tag: load tags, replace same-key, UPDATE conversations.tags. activate_ai: UPDATE conversations SET status_ia='ligada'. handoff: UPDATE conversations SET status_ia='shadow' + department_id + assigned_to. send_poll: POST UAZAPI `/send/menu` type=poll + INSERT poll_messages + conversation_messages + opcional imagem antes com delay 1500ms. Todas as acoes retornam string descritiva do resultado. Erros nao propagam (fire-and-forget com log).

---

## Links Relacionados

- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Indice das 9 sub-funcionalidades
- [[wiki/casos-de-uso/motor-automacao-execucao]] — Fluxo de execucao, gatilhos chamados, NPS, erros
- [[wiki/casos-de-uso/motor-automacao-editor]] — Editor visual e CRUD de regras
- [[wiki/casos-de-uso/funis-detalhado]] — Funis onde as regras vivem
- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Enquetes (acao send_poll)

---

*Rev 1 (2026-05-04): Sub-wiki tematica criada a partir do particionamento de motor-automacao-detalhado.md (regra 14, max 200 linhas).*
