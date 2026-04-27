---
title: Melhorias — Leads, CRM Kanban, Catálogo
tags: [melhorias, leads, kanban, catalogo, backlog]
sources: [auditoria 2026-04-27]
updated: 2026-04-27
---

# Melhorias — Leads & CRM

> 30 melhorias acionáveis em 3 módulos: Leads/Database, CRM Kanban, Catálogo de Produtos. Auditoria 2026-04-27.

---

## Leads / Leads DB (M11) — `src/components/leads/`, `src/pages/dashboard/Leads.tsx`

1. **Filtros salvos como views** — "Leads quentes desta semana", "Leads sem resposta há 7d". Hoje atendente refaz toda vez.
2. **Bulk edit de tags/etiquetas** em `Leads.tsx` (selecionar múltiplos → aplicar). Hoje só por lead.
3. **Deduplicação de contatos** com mesmo telefone (E.164 normalizado) — hoje variações criam duplos.
4. **Score de lead** consolidado — `lead_score_history` existe (S2) mas não aparece no LeadDetail. Exibir como gauge.
5. **Histórico de campos** (full_name, city) com auditoria — `update_lead_profile` sobrescreve sem trace.
6. **Merge de contatos duplicados** (botão "fundir lead A em B") — hoje precisa SQL manual.
7. **Lazy-load de timeline** — `LeadJourneyTimeline` puxa tudo. Para leads com 6 meses de história, lentidão.
8. **Detecção de churn risk** — sem mensagens há 30+ dias + label "negociação" = alerta no dashboard.
9. **Exportação LGPD** — botão "exportar dados deste lead" (JSON com todas as tabelas que referenciam contact_id).
10. **Anonimização** (`full_name='[REDACTED]'`, blur de mensagens) para LGPD direito ao esquecimento. Hoje sem fluxo.

---

## CRM Kanban (M5) — `src/components/kanban/`, `src/pages/dashboard/Kanban*.tsx`

1. **WIP limits por coluna** — definir max cards por coluna ("Negociação max 20"); UI alerta no drag.
2. **Auto-WIP via tag** — card sem mensagem há N dias muda visual ("frio").
3. **Time-tracking por coluna** (`kanban_card_history` table) — quanto tempo cada card ficou em cada estágio. Métrica de funil.
4. **Custom field formula** — total estimado = soma de cards × ticket médio do board. Hoje campos planos.
5. **Templates de board** alavancando `funnelTemplates.ts` mas para usuários finais (sem precisar criar funil).
6. **Filtros persistidos** por usuário em `user_board_preferences` — hoje resetam a cada visita.
7. **Drag-and-drop com optimistic update + rollback** robusto — em redes lentas, card pisca.
8. **Webhook on card_moved** já existe via automation, mas falta logging em `kanban_card_history` quando IA move.
9. **Permissões granulares por coluna** — "atendente pode mover apenas para 'Aprovação'". Hoje tudo-ou-nada por board.
10. **Cards arquivados** com restore — hoje delete é hard. Adicionar `deleted_at` + view de "lixeira".

---

## Catálogo (M6) — `src/components/admin/ai-agent/Catalog*.tsx`, `supabase/functions/scrape-product*`

1. **Re-scrape periódico** (cron weekly) — preço/estoque mudam, catálogo desatualiza. `ai_products.last_scraped_at` + cron `scrape-products-batch`.
2. **Indicador de produto sem foto** — IA tenta `send_carousel` e quebra. Filtro/badge no admin.
3. **Detecção de duplicatas por título fuzzy** — admin importa CSV grande, vira duplicata. Pre-import dedup com `pg_trgm` similarity > 0.85.
4. **Variantes de produto** (cor, tamanho) — hoje cada variante é 1 produto separado. Modelar `ai_product_variants`.
5. **Categoria hierárquica** (Tinta > Coral > Premium) em vez de tag plana. Melhora qualificação SDR.
6. **Estoque integrado** com ERP (webhook in `ai_products.stock_qty`). IA não vende sem estoque mas consulta external.
7. **Preço dinâmico por instância** — multi-tenant pode ter mesma loja matriz com preços diferentes por filial. Hoje preço único.
8. **Auditoria de scrape** (taxa de sucesso por domínio, duração) — quando shopify muda HTML, scrape quebra silencioso.
9. **Embeddings semânticos** (pgvector) para busca semântica complementando fuzzy — "tinta lavável para banheiro" matcha sem ILIKE.
10. **Bulk delete + recuperação** — hoje admin deleta 1 a 1 ou usa SQL.

---

## Links

- [[wiki/melhorias-auditoria-2026-04-27]] — Índice geral
- [[wiki/casos-de-uso/leads-detalhado]]
- [[wiki/casos-de-uso/crm-kanban-detalhado]]
- [[wiki/casos-de-uso/catalogo-detalhado]]
