---
title: Auditoria & Melhorias — Dashboard Gestor (sessão 2026-06-11)
tags: [auditoria, backlog, dashboard, funil, melhorias]
sources: [CHANGELOG.md, log.md, wiki/erros-e-licoes.md]
updated: 2026-06-11
audited_at: 2026-06-11
---

# Auditoria & Melhorias — 2026-06-11 (tarde/noite)

> Consolidação da sessão que shipou **v7.81.0 → v7.83.0** + auditoria do que falta
> + 10 melhorias propostas. Frase de retomada: **"retomar whatspro 2026-06-11"**
> (handoff completo na memória `project_session_2026_06_11_handoff`).

---

## ✅ O que foi feito hoje (tarde/noite) — 3 releases em PROD verificada

### v7.81.0 — "Motivos de conversa" religado + família EN×PT (`9a7806f`)
- Pipeline `ai_summary` NUNCA rodou (0 all-time): trigger `auto_summarize_on_resolve`
  morto em 4 camadas (GUC `app.settings` sempre NULL; URL de projeto morto
  `crzcpnczpuzwieyzbqev`; `extensions.net.http_post` inexistente; verify_jwt×anon).
- Fix: trigger dropado; cron `auto-summarize-backfill` (vault CRON_AUTH_KEY, hoje
  `*/30`, lote 30) + RPC `find_summarize_candidates` (≥3 msgs no SQL + piso 60d).
- Família EN×PT: `v_vendor_activity`/`v_handoff_details`/`v_lead_metrics` +
  `aggregate-metrics` + `assistantQueries` + `useVendorDetail` comparavam
  `'resolved'/'pending'/'open'` contra dados `resolvida/pendente/aberta` →
  Ranking "0 resolv." e `converteu` sempre false. Tudo corrigido + shadow_metrics 30d recomputado.

### v7.82.0 — Taxonomia de negócio nos motivos (`4cb2d8e`)
- Regra do dono: info/preço/disponibilidade de PRODUTO = **interesse_compra**
  (dúvida técnica = só uso/instalação). `_shared/summaryPrompt.ts` = fonte única
  (8 categorias + `normalizeSummaryCategory`); card agrupa determinístico com
  subinteresses no tooltip; aposentou `group-reasons` do card.
- Summarizers migrados de fetch Groq cru → `callLLM` (OpenAI gpt-4.1-mini +
  fallback Gemini) — cota DIÁRIA do Groq free esgotou no backfill (200 com 0 escritas).
- Reclassificação DRENADA: **796 resumos** (757 interesse_compra, 24 outro, 5 troca,
  3 vaga, 3 entrega, 2 fornecedor, 2 dúvida técnica). Cron auto-restaurado.

### v7.83.0 — Funil de Conversão REAL, opção C do dono (`ce16a64`)
- Causa do funil 2 meses zerado: `aggregate-metrics` esperava `extracted_data.tags[]`
  do shadow, mas `extract_shadow_data` emite JSON LIVRE sem `tags` → etapa null e
  score delta 0 SEMPRE.
- `_shared/funnelStages.ts` (puro, 10 testes): contact → qualification → intention →
  handoff → conversion das TAGS DURÁVEIS (+carrinho+assigned_to).
- **Funil ao vivo: 591 → 412 → 380 → 480 → 99 (16,8%).**
- Venda unificada: `venda:fechada` (IA, `saleClosedDetection`) OR `resultado:venda`
  (humano, drawer "Finalizar Atendimento" que JÁ EXISTIA) nos 5 RPCs
  (`dash_kpis_resumo`, `dash_vendas_por_vendedor`, `dash_cotacoes`,
  `dash_conversao_orcamento_venda`, `get_conversion_by_origin` — este virou
  SECURITY DEFINER: RLS de `conversion_funnel_events` exige inbox_users).
- Lead score religado de `lead_score:NN` (302 leads com score real; 42 quentes ≥70).
- `resolved_at` real nas views (tempo médio Lucas: 192h52min → **2h50min**).

**Operacional:** funil/score agregados pelo cron HORÁRIO do aggregate-metrics.
Re-derivar do zero = `TRUNCATE conversion_funnel_events` + `mode=daily` com `date` (31 calls).

---

## 🔍 Auditoria — o que falta (por prioridade)

### Ação humana (dono/equipe)
1. **Avisar a equipe**: usar "Finalizar Atendimento" ao fechar venda (alimenta
   `resultado:venda` + valor + Kanban) — conversão fica fiel.
2. **Herdada:** dono validar envio de foto (v7.75/7.77) com atendente iPhone/Android real.

### Bugs/fluxos conhecidos do agente (backlog técnico)
3. **Achado (a) da auditoria de áudio** (conv 980f4d83): qualificação presa em
   "portas" com lead pedindo TINTA; nome extraído como "Comprei"; enum de ambiente
   sem "externo" → re-pergunta em loop. 3 bugs de fluxo.
4. **Brand-filter na qualificação** (busca mostrou Coral p/ pedido Suvinil) — v7.55.
5. **Bug 12**: LLM crava interesse fora dos category IDs (mitigado; fix = validar no set_tags).
6. **4 correções atendimento V2** (preço-trigger, telhas, nome pré-LLM, msg fora-horário)
   — memória `project_v2_attendance_fixes_pending`.
7. **GlobalSearchDialog** não busca `lead_profiles.full_name` (v7.78).
8. **1-produto-multi-imagem vira carrossel** (achado v7.51).

### Plano orquestrador (CLAUDE.md)
9. **D6 — aposentar monolito** (~23/06: 30d de router estável no EletropisoV2).
10. **Sprint E.2 resto** (proatividade/follow-ups) + **E.3 RAG**.
11. **B4** — varredura R134 idempotência (hardening).

### Infra/manutenção
12. **Storage**: limpeza do helpdesk-media começa ~21/06 (cron 43); monitorar ~430MB;
    bandwidth 5GB/mês só no painel.
13. **Rotação do PAT Supabase** (trafegou em chat 2026-05-06 — `reference_supabase_token_novo`).
14. **Dívida tsc do frontend** (montanha pré-existente; build não gateia — zerar por área).
15. **Latência carrossel UAZAPI** (~4s serial) — próximo gargalo do agente (nota v7.48).

### Limitações conhecidas do dado (documentadas, não-bugs)
- ~~Venda pós-handoff subnotificada~~ → v7.84.0 fechou (vendor shadow + summarizer).
  **Nova limitação no lugar:** as ~99 `venda:fechada` ANTERIORES a 2026-06-11 são
  majoritariamente falso-positivo de "Tá certo" (dono optou por não mexer no
  histórico) — comparações período-vs-período cruzando essa data superestimam o passado.
- KPI strip usa janela `last_message_at`; funil usa `created_at` → diferenças de ±1-2.
- Lead multi-conversa pode contar 2× na mesma etapa em dias distintos (aproximação herdada).
- `ai_summary` expira em 60d (cron `cleanup-expired-summaries`) — card de motivos é janela móvel.

---

## 💡 10 melhorias propostas (priorizadas)

1. ~~**Detecção de venda na fase do VENDEDOR (shadow seller)**~~ — ✅ **SHIPPED v7.84.0
   (2026-06-11)**: 2 camadas (detectVendorSaleClosed + enum `venda_status:fechada` com
   promoção guardada; `sale_closed` no summarizer + re-resumo por atividade). **Achado
   no E2E: o funil estava INFLADO, não subnotificado** — 97/99 `venda:fechada` (30d)
   eram falso-positivo de "Tá certo" (regex frouxo, corrigido). **Decisão do dono:
   histórico intocado** — as 99 tags antigas ficam; a métrica é confiável DAQUI PRA
   FRENTE. Detalhe: CHANGELOG v7.84.0 + memória `project_sale_detection_v784`.
2. **Receita no dashboard (R$)** — o drawer já grava `valor:NNN`; somar receita por
   período/vendedor/origem (hoje só contagem de vendas). Card "Receita do período" +
   ticket médio real.
3. **Funil clicável (drill-down)** — clicar na etapa lista os leads/conversas dela,
   com deep-link `?conv=` (já existe desde v7.79) pro Helpdesk. Gestor age na hora.
4. **Score do lead visível no Helpdesk** — `lead_score:NN` agora é confiável; badge
   quente/morno/frio na lista de conversas pra priorização dos vendedores (e ordenar
   "Sem resposta" por score).
5. **Kanban → tag (bidirecional)** — mover card pra "Fechado Ganho" grava
   `resultado:venda` na conversa (hoje só drawer→Kanban). Vendedor que vive no Kanban
   também alimenta o funil.
6. **Alertas proativos pro gestor no WhatsApp** — reusar o canal de notificação:
   "X leads quentes sem resposta há 1h", "conversão da semana caiu N%". O dashboard
   vai até o gestor, não o contrário.
7. **Tempo-até-venda** — os eventos do funil têm timestamp; medir contato→venda por
   vendedor/origem (além da contagem). Detecta onde o ciclo emperra.
8. **Schema strict no `extract_shadow_data` OU aposentá-lo** — lição do dia: tool com
   objeto livre apodrece em silêncio. Como as tags duráveis viraram a fonte das
   métricas, avaliar se o shadow `lead` ainda paga o custo (e `group-reasons` ficou
   sem consumidor — candidata a remoção).
9. **Telemetria de RITMO nos pipelines batch** — alerta quando um cron roda "verde"
   mas escreve 0 por N execuções (foi assim que o Groq esgotado passou despercebido;
   mesma família do funil 2 meses zerado). Um contador `writes_per_run` em system_logs.
10. **Janela única nos cards** — padronizar `created_at` vs `last_message_at` entre
    KPI strip, funil e conversão por origem (diferenças de ±1-2 confundem o gestor).

---

## ▶️ Como prosseguir (próxima sessão)

1. Dizer **"retomar whatspro 2026-06-11"** → handoff carrega da memória.
2. Protocolo de início (index → roadmap → erros-e-licoes → log → decisoes-chave).
3. Escolher frente: melhoria #1 (venda no shadow seller) é a de maior impacto na
   métrica nova; ou backlog técnico #3/#4 (fluxos do agente); ou D6 (~23/06).
4. Nada está rodando solto: crons em regime permanente, prod estável, repo limpo.
