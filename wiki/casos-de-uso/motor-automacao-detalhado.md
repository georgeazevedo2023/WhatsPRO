---
title: Motor de Automacao — Documentacao Detalhada de Todas as Sub-Funcionalidades
tags: [automacao, gatilho, condicao, acao, engine, regras, detalhado]
sources: [supabase/functions/_shared/automationEngine.ts, src/components/funnels/AutomationRuleEditor.tsx, src/hooks/useAutomationRules.ts]
updated: 2026-04-10
---

# Motor de Automacao — Regras Gatilho → Condicao → Acao (9 Sub-Funcionalidades)

> O Motor de Automacao e um sistema de regras **"SE acontecer X → ENTAO fazer Y"**. Funciona sem inteligencia artificial — e puramente logico, como um robozinho que segue instrucoes fixas. Cada funil pode ter varias regras, e elas sao avaliadas em ordem quando um evento acontece.
>
> Pense numa regra assim: "Quando o formulario de orcamento for preenchido (gatilho), E a conversa tiver a tag 'motivo:compra' (condicao), ENTAO mover o card para 'Proposta' e enviar mensagem 'Orcamento recebido!'" (acao). Isso tudo acontece automaticamente, sem ninguem clicar em nada.
>
> O motor e diferente da IA — a IA pensa e decide. O motor so segue regras fixas. Sao complementares: o motor faz as acoes repetitivas (mover card, enviar msg, aplicar tag), e a IA faz as acoes inteligentes (qualificar, buscar produto, negociar).
>
> Ver tambem: [[wiki/casos-de-uso/funis-detalhado]] (funis onde as regras vivem), [[wiki/casos-de-uso/ai-agent-detalhado]] (IA complementar ao motor)

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

## 9.4 Fluxo de Execucao (Como o Motor Processa)

**O que acontece quando um evento dispara:**

```
1. Evento acontece (ex: formulario concluido)
   ↓
2. Edge function chama executeAutomationRules(funnelId, trigger, data, conversationId)
   ↓
3. Motor carrega TODAS as regras do funil (enabled=true, ordenadas por position)
   ↓
4. Para CADA regra (em ordem):
   ↓
   a) O gatilho bate com o evento?
      Se NAO → pula para proxima regra
      Se SIM ↓
   ↓
   b) A condicao e verdadeira?
      Se NAO → pula para proxima regra
      Se SIM ↓
   ↓
   c) Executa a acao
      → Resultado registrado no log
   ↓
   d) Se deu erro, captura e continua
      → Erro de uma regra NAO para as outras
   ↓
5. Retorna array de logs (1 entrada por regra avaliada)
```

**Regras importantes:**
- Regras executam em **ordem de posicao** (position 0 primeiro, depois 1, 2, etc.)
- Erro em uma regra **nao para** as outras — isolamento total
- Execucao e **fire-and-forget** — nao bloqueia o webhook
- Resultado de cada regra e registrado num log interno

> **Tecnico:** Funcao `executeAutomationRules()` em automationEngine.ts (linhas 87-192). Query: `automation_rules WHERE funnel_id AND enabled=true AND trigger_type ORDER BY position ASC`. Loop for-of com try-catch por regra. Return: `AutomationExecutionLog[]` com {rule_id, rule_name, triggered, condition_passed, action_executed, action_result, error}. Logger: `createLogger('automationEngine', 'engine')` com structured JSON.

---

## 9.5 Editor Visual de Regras (AutomationRuleEditor)

**O que e:** Dialog no FunnelDetail (tab Automacoes) para criar e editar regras visualmente. Tem 4 secoes: nome, QUANDO (gatilho), SE (condicao), ENTAO (acao).

**Layout:**
1. **Nome da regra** + toggle ativado/desativado
2. **QUANDO** (dropdown de gatilho) + campos condicionais:
   - Card movido → campo UUID da coluna
   - Formulario → campo slug do formulario
   - Tag adicionada → campo texto da tag
   - Etiqueta → campo texto da etiqueta
   - Demais → sem campos extras
3. **SE** (dropdown de condicao) + campos condicionais:
   - Sempre → sem campos
   - Tag contem → campo texto da tag
   - Horario comercial → dropdown "Dentro/Fora"
   - Funil e → sem campos (nao exposto na UI)
4. **ENTAO** (dropdown de acao) + campos condicionais:
   - Enviar mensagem → textarea
   - Mover card → campo UUID da coluna
   - Adicionar tag → campo texto
   - Ativar IA → sem campos
   - Transferir → campo UUID do departamento
   - Enviar enquete → pergunta + lista de opcoes dinamica (2-12)

> **Tecnico:** Componente `AutomationRuleEditor.tsx`. Dialog max-w-lg, max-h-90vh, overflow-y-auto. Estado local com useState. Config builders: `buildTriggerConfig()`, `buildConditionConfig()`, `buildActionConfig()` serializam estado para JSONB. Save: `useCreateAutomationRule()` (novo) ou `useUpdateAutomationRule()` (editar). Toast success/error. Poll options: array dinamico com add/remove, min 2 max 12.

---

## 9.6 CRUD de Regras (Hooks)

**O que e:** 4 hooks React para gerenciar regras de automacao via Supabase.

| Hook | Acao | Query |
|------|------|-------|
| `useAutomationRules(funnelId)` | Listar regras do funil | SELECT * WHERE funnel_id ORDER BY position |
| `useCreateAutomationRule()` | Criar nova regra | INSERT com defaults (enabled=true, position=0) |
| `useUpdateAutomationRule()` | Editar regra existente | UPDATE WHERE id |
| `useDeleteAutomationRule()` | Excluir regra | DELETE WHERE id |

Todos invalidam o cache React Query `['automation_rules', funnelId]` apos mutacao.

> **Tecnico:** Hook `useAutomationRules.ts`. Tipos: `AutomationRule` interface com todos os campos. `CreateAutomationRuleInput` para criacao. TanStack React Query: useQuery + useMutation. Invalidacao: `queryClient.invalidateQueries(['automation_rules', funnelId])`. Toast: sonner.

---

## 9.7 Onde os Gatilhos Sao Chamados (Edge Functions)

**O que e:** Mapeamento de QUAL edge function chama QUAL gatilho.

| Gatilho | Edge Function | Arquivo | Linha | Status |
|---------|--------------|---------|-------|--------|
| form_completed | form-bot | form-bot/index.ts | 443-463 | ✅ Ativo |
| poll_answered | whatsapp-webhook | whatsapp-webhook/index.ts | 330-344 | ✅ Ativo |
| card_moved | — | — | — | Pendente |
| lead_created | — | — | — | Pendente |
| conversation_resolved | — | — | — | Pendente (NPS usa triggerNpsIfEnabled separado) |
| tag_added | — | — | — | Pendente |
| label_applied | — | — | — | Pendente |

**Nota:** 5 dos 7 gatilhos estao definidos no schema mas ainda sem hook de chamada nas edge functions. Quando implementados, basta adicionar a chamada `executeAutomationRules()` no ponto correto.

> **Tecnico:** form-bot: apos form completion, busca funnel vinculado ao form (`funnels WHERE form_id`), se existe chama engine com fire-and-forget `.catch(() => {})`. webhook poll_update: se `pollMsg.funnel_id` existe, import dinamico do automationEngine e chama com dados do poll.

---

## 9.8 NPS via Motor (triggerNpsIfEnabled)

**O que e:** O NPS (pesquisa de satisfacao pos-atendimento) usa o motor de automacao como infraestrutura mas tem sua propria funcao dedicada `triggerNpsIfEnabled()`.

**Fluxo:**
1. Atendente finaliza ticket (TicketResolutionDrawer)
2. Chama `triggerNpsIfEnabled(conversationId, instanceId)`
3. Funcao verifica: NPS habilitado? Sentimento negativo? 
4. Se OK, agenda envio da enquete com delay configuravel (ex: 30 minutos)
5. Apos delay, envia via UAZAPI `/send/menu` com is_nps=true
6. Resposta do lead chega via webhook poll_update
7. Se nota ruim (Ruim/Pessimo), notifica gerentes via tabela notifications

**Guard:** Se conversa tem tag `sentimento:negativo`, NPS NAO e enviado.

> **Tecnico:** Funcao `triggerNpsIfEnabled()` em automationEngine.ts (linhas 565-657). Config: 5 campos em ai_agents (poll_nps_enabled, poll_nps_delay_minutes default 5, poll_nps_question, poll_nps_options JSONB, poll_nps_notify_on_bad). Guard: `tags.some(t => t.includes('sentimento:negativo'))`. Delay: `setTimeout(async () => { ... }, delayMs)`. Poll enviada com `is_nps: true` em poll_messages. Nota ruim: webhook checa `BAD_OPTIONS = ['Ruim','Pessimo','Péssimo']`, se match e notify_on_bad=true, INSERT em notifications para cada gerente da inbox.

---

## 9.9 Tratamento de Erros e Logging

**O que e:** O motor e projetado para **nunca quebrar** — erros em uma regra nao afetam as outras, e nenhum erro bloqueia o webhook.

**3 niveis de protecao:**
1. **Nivel top** — se o motor inteiro falhar ao carregar regras, retorna array vazio e loga erro
2. **Nivel por regra** — cada regra tem try-catch proprio. Erro capturado no log, proxima regra continua
3. **Nivel por acao** — erros de rede (UAZAPI fora) e banco (update falhou) sao logados mas nao propagados

**Principio fail-open:** Se o motor nao entende uma condicao (tipo desconhecido), considera como "verdadeira" e executa a acao. Melhor fazer algo a mais do que perder a acao.

> **Tecnico:** Logger: `createLogger('automationEngine', 'engine')`. Logs structured JSON: level, fn, req, msg, ts + metadata. Top-level: `log.error('executeAutomationRules top-level error')`. Per-rule: `log.error('Rule execution error', {rule_id, rule_name, error})`. Per-action: UAZAPI errors → `log.warn('send_message action: UAZAPI returned error')`, DB errors → `log.warn('move_card action: update failed')`. Testes: 6 testes vitest (empty rules, supabase error, form_completed+always, non-matching config, condition always, multiple rules).

---

## Arvore de Componentes

```
FunnelDetail.tsx → Tab "Automacoes"
+-- Lista de regras (useAutomationRules)
|   +-- Card por regra: nome, toggle, gatilho→condicao→acao
|   +-- Botoes: editar, excluir
+-- AutomationRuleEditor.tsx (dialog)
    +-- Nome + toggle ativado
    +-- QUANDO: Select gatilho + sub-campos condicionais
    +-- SE: Select condicao + sub-campos condicionais
    +-- ENTAO: Select acao + sub-campos condicionais
    +-- Botoes: cancelar, salvar
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `automation_rules` | Regras (funnel_id FK, trigger/condition/action type+config JSONB, enabled, position) |
| `notifications` | Notificacoes para gerentes (NPS ruim) |

---

## Links Relacionados

- [[wiki/casos-de-uso/funis-detalhado]] — Funis onde as regras vivem
- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Enquetes e NPS (acao send_poll + NPS trigger)
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios que disparam form_completed
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA complementar ao motor
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Doc dedicado complementa funis-detalhado secao 10.6*
