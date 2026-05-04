---
title: Funis — Inteligencia, IA, Perfis e Metricas
tags: [funis, automacao, agentico, perfis, ia, metricas, m17, detalhado]
sources: [supabase/functions/_shared/automationEngine.ts, src/components/funnels/AutomationRuleEditor.tsx, src/hooks/useFunnelMetrics.ts]
updated: 2026-05-04
---

# Funis — Inteligencia, IA, Perfis e Metricas (4 Sub-Funcionalidades)

> Esta sub-wiki cobre o **cerebro** do funil: o motor de automacao (gatilho -> condicao -> acao), os funis agenticos (IA personalizada por funil), os perfis de atendimento reutilizaveis, e o calculo de metricas agregadas.
>
> Ver tambem indice: [[wiki/casos-de-uso/funis-detalhado]]

---

## 10.6 Motor de Automacao (M17 F1)

**O que e:** Sistema de regras "SE acontecer X -> ENTAO fazer Y" dentro de cada funil. Funciona sem IA — e puramente logico, como um robozinho que segue instrucoes fixas.

**7 gatilhos (o que dispara a regra):**
1. **Card movido** — card mudou de coluna no Kanban
2. **Formulario concluido** — lead terminou de preencher
3. **Lead criado** — novo lead entrou no funil
4. **Conversa resolvida** — atendente finalizou ticket
5. **Tag adicionada** — tag especifica foi aplicada
6. **Etiqueta aplicada** — etiqueta visual foi colocada
7. **Enquete respondida** — lead votou numa enquete

**4 condicoes (filtro opcional):**
1. **Sempre** — executa em qualquer caso
2. **Tag contem** — so se lead tem tag especifica
3. **Funil e** — so se lead esta no funil X
4. **Horario comercial** — so dentro/fora do expediente

**6 acoes (o que fazer):**
1. **Enviar mensagem** — texto automatico pelo WhatsApp
2. **Mover card** — mover no Kanban para coluna X
3. **Adicionar tag** — aplicar tag na conversa
4. **Ativar IA** — ligar o agente IA na conversa
5. **Transferir** — handoff para departamento/atendente
6. **Enviar enquete** — disparar enquete nativa

**Cenario real:** Funil "Venda" com regra: "Quando formulario de orcamento for concluido (gatilho) -> mover card para 'Proposta' (acao 1) + enviar mensagem 'Orcamento recebido! Um consultor vai entrar em contato em breve.' (acao 2)".

> **Tecnico:** Tabela `automation_rules` (funnel_id FK, trigger_type ENUM, condition_type ENUM, action_type ENUM, trigger_config JSONB, condition_config JSONB, action_config JSONB, enabled BOOL, position INT). Engine: `_shared/automationEngine.ts` funcao `executeAutomationRules(funnel_id, trigger, data, conversation_id)`. form-bot chama apos form_completed. webhook chama apos poll_answered. Componente: `AutomationRuleEditor.tsx` (dialog com selects condicionais + config por tipo). Hooks: `useAutomationRules()`, `useCreateAutomationRule()`, `useUpdateAutomationRule()`, `useDeleteAutomationRule()`.

---

## 10.7 Funis Agenticos (M17 F2) — IA Personalizada por Funil

**O que e:** Cada funil pode ter **instrucoes especificas** para a IA e **regras de handoff** proprias. Assim, a IA se comporta diferente dependendo de qual funil o lead esta.

**Configuracao por funil:**
- **Prompt do funil** — instrucoes especificas (ex: "Este e um funil de sorteio. Confirme a inscricao e pergunte qual premio o lead prefere.")
- **Regra de handoff:**
  - "So se pedir" — IA nunca transfere por conta propria
  - "Apos N mensagens" — transfere apos X msgs sem resolver
  - "Nunca" — IA nunca transfere (resolve tudo sozinha)
- **Max mensagens** — limite antes do auto-handoff
- **Departamento** — para qual departamento transferir

**Prioridade:** Instrucoes do funil tem prioridade sobre instrucoes gerais do agente. Se o agente diz "seja formal" mas o funil diz "seja descontraido", vale "seja descontraido".

> **Tecnico:** Campos na tabela `funnels`: `funnel_prompt` TEXT, `handoff_rule` ENUM ('so_se_pedir'|'apos_n_msgs'|'nunca'), `handoff_max_messages` INT, `handoff_department_id` UUID FK. AI Agent: detecta tag funil:SLUG -> carrega funnels -> injeta `<funnel_instructions>` com funnel_prompt. Prioridade handoff: funnel > agent (handoff_message, department, max_messages).

---

## 10.8 Perfis de Atendimento (M17 F3) — Via Funil

**O que e:** Cada funil pode apontar para um **perfil de atendimento** (Agent Profile) — um pacote reutilizavel de comportamento da IA. Assim, varios funis podem compartilhar o mesmo perfil.

**Cenario:** Perfil "Vendedor Animado" usado pelo Funil "Venda Tintas" e pelo Funil "Venda Ferramentas". Se mudar o tom no perfil, ambos os funis mudam.

**Seletor:** No FunnelDetail tab "Agente IA", dropdown com perfis disponiveis.

> **Tecnico:** FK `funnels.profile_id` -> agent_profiles.id. Hook `useAgentProfilesByInstance()` carrega perfis habilitados. Prioridade: profileData > funnelData > agent. AI Agent: se profile_id -> carrega agent_profiles -> injeta `<profile_instructions>` como ULTIMA secao. Se nao tem profile_id -> usa funnel_prompt direto.

---

## 10.9 Metricas do Funil

**O que e:** Metricas agregadas mostrando o desempenho do funil como um todo.

**Hook `useFunnelMetrics` calcula:**
- Visitas da campanha (total + conversoes + taxa)
- Visualizacoes do Bio Link (views + clicks + leads + CTR)
- Submissoes do formulario (total + hoje)
- Total de leads (via tag funil:SLUG)
- Total de conversas
- Distribuicao por etapa Kanban (quantos em cada coluna)

**FunnelConversionChart (Dashboard):** Grafico horizontal agregado de TODOS os funis ativos: Visitas -> Capturas -> Leads -> Conversoes.

> **Tecnico:** Hook `useFunnelMetrics.ts` (167 linhas). Queries: utm_visits (campaign_id), bio_pages (view_count), bio_buttons (sum click_count), bio_lead_captures (count), form_submissions (count + today), conversations (contains tag), kanban_cards (group by column). FunnelConversionChart: componente no DashboardHome, agrega todos os funis ativos.

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `funnels` | Funis (type, status, FKs campanha/bio/form/kanban, funnel_prompt, handoff, profile_id) |
| `automation_rules` | Regras de automacao (funnel_id FK, trigger/condition/action + configs JSONB) |
| `agent_profiles` | Perfis de atendimento (prompt + handoff rules reutilizaveis) |

---

## Links Relacionados

- [[wiki/casos-de-uso/funis-detalhado]] — Indice das sub-wikis de Funis
- [[wiki/casos-de-uso/funis-wizard-tipos]] — Wizard, 7 tipos, importar e sidebar
- [[wiki/casos-de-uso/funis-operacao-visualizacao]] — Lista, detalhe, tag e cards no perfil
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA com contexto do funil + perfis

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Particionado em 2026-05-04.*
