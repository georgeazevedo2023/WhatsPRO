---
title: Decisões Arquivo — M19 S3+S5 (2026-04-13)
type: decisoes-archive
period: 2026-04-13
---

## M19 — S3 Dashboard do Gestor (2026-04-13)

- `ManagerConversionFunnel` (distinto de `FunnelConversionChart` do M16 — esse usa dados de campanhas/bio; o de S3 usa `conversion_funnel_events` via shadow)
- KPI "Leads Novos" conta leads com ≥1 conversa na instância — leads sem conversa têm `instance_id=NULL` na view (LEFT JOIN). Limitação conhecida, documentada.
- Views SQL do S2 usam `as any` no PostgREST — não aparecem no `types.ts` gerado. Padrão igual ao `usePollMetrics`.
- Rota `/dashboard/gestao` usa `CrmRoute` existente (super_admin + gerente). Não criar wrapper novo.
- Sidebar: collapsible "Gestao" posicionado entre Leads e Funis — acessível a ambos os roles.

## M19 — Métricas & Shadow (S1+S2, 2026-04-13)

### NUNCA mock data — sempre dados reais do DB

UI, dashboards e gráficos DEVEM consumir dados reais do banco. NUNCA usar mock data, placeholder arrays ou dados fictícios — nem em dev, nem em produção.
- **Empty state** com mensagem clara ("Nenhum dado ainda") é aceitável
- Se dados ainda não existem: implementar PRIMEIRO a lógica que os popula, DEPOIS criar a UI que os consome
- **Por quê:** Mock mascara bugs de integração, dá falsa sensação de funcionamento e impede validação real

### Lead Score por Tags Shadow

Score inicial: 50 (0–100). Calculado a cada `aggregateDaily` por instância com base em tags extraídas do shadow:
- `intencao:alta` = +15 | `intencao:media` = +8 | `intencao:baixa` = +2
- `conversao:comprou` = +30 | `conversao:converteu` = +25 | `conversao:*` = +10
- `objecao:*` = −5 | `motivo_perda:*` = −20 | `concorrente:*` = −5
- Persiste em `lead_profiles.current_score` + histórico em `lead_score_history`

### Etapas do Funil de Conversão (conversion_funnel_events)

Detectadas por tags shadow, inseridas sem duplicatas (chave: `conversation_id + stage`):
- `qualification` — qualquer `intencao:*` ou `dado_pessoal:*`
- `intention` — `intencao:alta` ou `intencao:media`
- `conversion` — qualquer `conversao:*`
- `contact` (trivial) — não registrado

## M19 — S5 IA Conversacional (2026-04-13)

### NUNCA text-to-SQL — apenas queries parametrizadas

Auditoria de segurança (3 agentes paralelos) concluiu que text-to-SQL como fallback é **HIGH RISK**:
- LLM prompt injection pode gerar SQL malicioso
- Bypass de `instance_id` em queries geradas dinamicamente
- Superficie de ataque ampla mesmo com validator

**Decisão:** Apenas 20 intents parametrizados via PostgREST. Intent não reconhecido = resposta amigável de fallback.

### Verificação de instância obrigatória

Edge function `assistant-chat` DEVE verificar `user_instance_access` antes de executar qualquer query:
- Extrair `instance_id` do body
- Verificar se userId tem acesso via `user_instance_access`
- 403 se não autorizado

Views S2 não filtram `instance_id` internamente — o caller é responsável.

### Arquitetura do assistente

- 2 chamadas LLM por pergunta: NLU (classificação, ~200 tokens) + formatação (~300 tokens)
- Cache por hash(intent+params) com TTL 5min → 2ª pergunta idêntica = instantâneo
- Rate limit: 20 req/min por userId
- Widget flutuante: `Ctrl+J` toggle, `fixed bottom-6 right-6 z-50`, persiste entre rotas
- Página dedicada: `/dashboard/assistant` com histórico lateral
- Tabelas: `assistant_conversations` (histórico) + `assistant_cache` (dedup)

### Sincronização de instância entre páginas e widget

Páginas de gestão disparam `CustomEvent('wp-instance-change')` via `useEffect`. Widget escuta o evento e atualiza `instanceId` reativamente. localStorage usado como fallback para persistência entre refreshes.
- NUNCA usar `localStorage.setItem` no render body (anti-pattern React — R61)
- NUNCA depender de `storage` event para mesma janela (só funciona entre abas — R62)

### Cache do assistente: DELETE+INSERT (não upsert)

PostgREST `onConflict` por nomes de colunas falha (R36). Cache usa DELETE+INSERT sequencial (fire-and-forget). Unique index `idx_assistant_cache_lookup` garante dedup.

**Plano completo:** [[.planning/m19-s5-PLAN]]
