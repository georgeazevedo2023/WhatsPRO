---
title: Motor de Automacao — Documentacao Detalhada (Indice)
tags: [automacao, gatilho, condicao, acao, engine, regras, detalhado, indice]
sources: [supabase/functions/_shared/automationEngine.ts, src/components/funnels/AutomationRuleEditor.tsx, src/hooks/useAutomationRules.ts]
updated: 2026-05-04
---

# Motor de Automacao — Regras Gatilho → Condicao → Acao (Indice das 9 Sub-Funcionalidades)

> O Motor de Automacao e um sistema de regras **"SE acontecer X → ENTAO fazer Y"**. Funciona sem inteligencia artificial — e puramente logico, como um robozinho que segue instrucoes fixas. Cada funil pode ter varias regras, e elas sao avaliadas em ordem quando um evento acontece.
>
> Pense numa regra assim: "Quando o formulario de orcamento for preenchido (gatilho), E a conversa tiver a tag 'motivo:compra' (condicao), ENTAO mover o card para 'Proposta' e enviar mensagem 'Orcamento recebido!'" (acao). Isso tudo acontece automaticamente, sem ninguem clicar em nada.
>
> O motor e diferente da IA — a IA pensa e decide. O motor so segue regras fixas. Sao complementares: o motor faz as acoes repetitivas (mover card, enviar msg, aplicar tag), e a IA faz as acoes inteligentes (qualificar, buscar produto, negociar).
>
> Ver tambem: [[wiki/casos-de-uso/funis-detalhado]] (funis onde as regras vivem), [[wiki/casos-de-uso/ai-agent-detalhado]] (IA complementar ao motor)

---

## Sub-paginas (organizadas por tema)

A documentacao das 9 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/motor-automacao-componentes]] | **9.1** Os 7 Gatilhos (Triggers), **9.2** As 4 Condicoes (Conditions), **9.3** As 6 Acoes (Actions) |
| [[wiki/casos-de-uso/motor-automacao-execucao]] | **9.4** Fluxo de Execucao, **9.7** Onde os Gatilhos Sao Chamados (Edge Functions), **9.8** NPS via Motor (triggerNpsIfEnabled), **9.9** Tratamento de Erros e Logging |
| [[wiki/casos-de-uso/motor-automacao-editor]] | **9.5** Editor Visual de Regras (AutomationRuleEditor), **9.6** CRUD de Regras (Hooks) + Arvore de Componentes + Tabelas do banco |

---

## Como navegar pelo motor-automacao-detalhado

- Quer entender os **blocos QUANDO/SE/ENTAO** (gatilhos, condicoes, acoes disponiveis)? → `motor-automacao-componentes`
- Precisa saber **como o motor roda** (fluxo, hooks nas edge functions, NPS, erros)? → `motor-automacao-execucao`
- Trabalhando na **interface de gerenciar regras** (editor visual, hooks CRUD, componentes)? → `motor-automacao-editor`

---

## Links Relacionados

- [[wiki/casos-de-uso/funis-detalhado]] — Funis onde as regras vivem
- [[wiki/casos-de-uso/enquetes-nps-detalhado]] — Enquetes e NPS (acao send_poll + NPS trigger)
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios que disparam form_completed
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA complementar ao motor
- [[wiki/modulos]] — Todos os 17 modulos

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Doc dedicado complementa funis-detalhado secao 10.6*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
