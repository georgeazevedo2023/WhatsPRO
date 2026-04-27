---
title: Melhorias — Dashboard, Gestor, Assistente, Instâncias, Admin, Documentação
tags: [melhorias, dashboard, gestor, assistente, instancias, admin, documentacao, backlog]
sources: [auditoria 2026-04-27]
updated: 2026-04-27
---

# Melhorias — Plataforma & Operação

> 70 melhorias acionáveis em 7 módulos: Dashboard/Intelligence, Agendamentos, Dashboard Gestor M19, Assistente IA M19, Instâncias/Inboxes, Admin, Documentação. Auditoria 2026-04-27.

---

## Dashboard / Intelligence (M8) — `src/pages/dashboard/DashboardHome.tsx`, `Intelligence.tsx`

1. **Customização de KPI cards** por usuário — hoje todo super_admin vê o mesmo.
2. **Comparação período-anterior** automática (este mês vs passado) com seta ▲▼.
3. **Drill-down universal** — clicar em qualquer KPI navega para listagem filtrada.
4. **Cache de queries pesadas** — Intelligence faz scan em conversation_messages. Materialized views diárias.
5. **Export PDF** do dashboard para reuniões — hoje screenshot manual.
6. **Anomaly detection** — "queda de 40% em mensagens hoje" como alerta.
7. **Picker de granularidade** (hora/dia/semana/mês) para gráficos. Hoje fixo em dia.
8. **Filtro multi-instância** — gerente que cuida de 3 instâncias quer ver agregado.
9. **Tooltip explicativo** em cada KPI ("o que é taxa de resolução?") — hoje só nome.
10. **Snapshot histórico** — "ver dashboard como estava em 01/03" — hoje sempre é "agora".

---

## Agendamentos & Templates (M9) — `src/pages/dashboard/ScheduledMessages.tsx`, `MessageTemplatesPage.tsx`

1. **Recorrência avançada** (cron expression UI) — hoje diário/semanal/mensal apenas.
2. **Categorias de templates** com filtros — hoje lista plana.
3. **Templates compartilhados entre instâncias** (super_admin define globais).
4. **Variáveis avançadas** (`{{lead.score}}`, `{{kanban.column.name}}`) — hoje só nome básico.
5. **Preview com lead real** antes de enviar — selecionar lead e ver template renderizado.
6. **Histórico de uso** — "este template foi enviado 47 vezes" + taxa de resposta.
7. **Versão de template** — editar gera v2; v1 fica disponível por 30 dias.
8. **Aprovação de templates** (workflow gerente aprova antes de produção).
9. **Template multimídia** (texto + imagem + botões) suportando carrossel.
10. **Search full-text** nos templates — quando lista cresce, achar fica difícil.

---

## Dashboard Gestor (M19 S3-S4) — `src/components/gestao/`, `src/pages/dashboard/gestao/`

1. **Comparativo entre vendedores** lado-a-lado — hoje só ranking + drill-down.
2. **Goals automáticos** baseados em histórico (sugerir meta = mediana × 1.1).
3. **Alerta de meta** quando faltam X dias e progresso baixo — hoje passivo.
4. **Custom KPI builder** — gerente define própria métrica via fórmula.
5. **Compartilhar dashboard** com link público temporário (já existe `flow_report_shares`, generalizar).
6. **Annotations no gráfico** ("queda no dia 12 = feriado").
7. **Drill-down até a conversa raiz** — clicar em "47 handoffs" → lista conversation_id → abrir helpdesk.
8. **Schedule de relatórios** (toda segunda 9h, gerente recebe PDF no email/WhatsApp).
9. **Indicador de qualidade dos dados** — "métrica baseada em 23 conversas (baixa amostra)".
10. **Heatmap de horários** — quando lead manda mais? Quando tempo de resposta aumenta?

---

## Assistente IA (M19 S5) — `src/components/assistant/`, `supabase/functions/assistant-chat/`

1. **Histórico de conversas** persistido por usuário (hoje memória só na sessão).
2. **Context window mais amplo** — hoje 20 intents fixos. Adicionar embedding de wiki para busca semântica.
3. **Comandos rápidos** (/leads, /funil, /vendas) — hoje conversacional puro.
4. **Tools que executam ações** (criar lead, mover kanban) com confirmação — hoje read-only.
5. **Multi-turn refinement** — "mostre vendas" → "filtre por mês" sem repetir contexto.
6. **Voice input** (Whisper) — falar em vez de digitar.
7. **Citações de fontes** — quando responde "vendas: 47", mostrar query SQL/tabela usada.
8. **Bookmarks de respostas** úteis — gerente salva relatório.
9. **Export markdown** do thread inteiro.
10. **Permission-aware** — atendente vê só seus dados; gerente, da equipe; super_admin, tudo.

---

## Instâncias / Inboxes / Departamentos — `src/pages/dashboard/Instances.tsx`, `Inbox*.tsx`, `AdminDepartments.tsx`

1. **Health check por instância** com badge (verde/amarelo/vermelho) baseado em `health-check`.
2. **Reconexão automática** quando UAZAPI cai — hoje admin reconecta manual.
3. **Atribuição auto** de inboxes a departamentos por regra (regex em phone, tag).
4. **Audit log de mudanças** em `inbox_users` (quem deu acesso a quem, quando).
5. **Limites por instância** (mensagens/dia, broadcast/h) configuráveis — hoje sem cap.
6. **Multi-region UAZAPI** failover — hoje 1 host hardcoded.
7. **Backup/restore de configuração** de instância (prompt, agentes, kanban) como JSON exportável.
8. **Métrica de uso por instância** (msgs in/out, custo LLM) para cobrança multi-tenant.
9. **Onboarding wizard** para nova instância (QR + agente default + funil default + inbox default).
10. **Soft delete de instância** com retention 30d antes de hard delete.

---

## Admin (Users/Secrets/Backup/Retention) — `src/pages/dashboard/Admin*.tsx`

1. **2FA obrigatório** para super_admin — hoje só password.
2. **Session list** — usuário vê onde está logado, faz logout remoto.
3. **Audit log UI** — `admin_audit_log` existe mas sem UI.
4. **Roles customizáveis** — hoje 3 fixos. Permitir granular.
5. **Backup automático ao deletar entidade** (export JSONL antes de cleanup).
6. **Restore UI** — hoje admin não restaura backup sem CLI.
7. **Secrets rotation** (botão "rotate UAZAPI token") com side-effect propagado.
8. **Health dashboard** consolidando edge functions, DB size, cron status, último backup.
9. **CSP headers e rate limit por user** (não só por instância) em edge functions admin-*.
10. **API tokens** para integração (gerar token Bearer com scope) — hoje só JWT user.

---

## Documentação / Vault Obsidian — `wiki/`, raiz `*.md`

1. **Reescrever README.md** completamente (hoje template Lovable). Adicionar: o que é WhatsPRO, stack, como rodar, como contribuir, link para PRD.
2. **Atualizar PRD.md header** linha 3 (versão 7.13.0, 2026-04-25, 38 edge functions, 60+ tabelas).
3. **Atualizar `AGENTS.md`** completamente — incluir OpenAI primário, M14-M19, 9 tools, 38 edge functions.
4. **Atualizar contagens** em ARCHITECTURE.md, wiki/visao-produto.md, wiki/visao-geral-completa.md, wiki/arquitetura.md (38 edge fns, 19 módulos, 21 wikis).
5. **Atualizar `wiki/banco-de-dados.md`** com schema completo M16-M19. Hoje 66 linhas para 60+ tabelas.
6. **Adicionar M19 em `wiki/modulos.md`** — Plataforma de Métricas com S1-S8.1.
7. **Sincronizar frontmatter `updated:`** em ai-agent.md, arquitetura.md, banco-de-dados.md, decisoes-chave.md, erros-e-licoes.md, modulos.md, roadmap.md, visao-produto.md.
8. **Particionar `wiki/casos-de-uso/helpdesk-detalhado.md`** (522 linhas → grupos funcionais ≤200 linhas).
9. **Decidir sobre arquivos órfãos**: mover/deletar `10 MODELOS DE LINK NA BIO.html`; arquivar `.planning/m19-s4-*`, `m19-s5-*`, `m19-s8-PLAN.md`.
10. **Criar wikis para edge functions sem doc**: `aggregate-metrics`, `assistant-chat`, `orchestrator`, `guided-flow-builder`, `process-flow-followups`. Hoje só PRD changelog menciona.

---

## Links

- [[wiki/melhorias-auditoria-2026-04-27]] — Índice geral
- [[wiki/casos-de-uso/dashboard-detalhado]]
- [[wiki/metricas-plano-implementacao]]
- [[wiki/casos-de-uso/instancias-detalhado]]
- [[wiki/arquitetura-docs]]
