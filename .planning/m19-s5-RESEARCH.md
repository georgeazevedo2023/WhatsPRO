# M19-S5 Research — IA Conversacional

## Estado Atual

### Views SQL disponíveis (S2)
1. `v_lead_metrics` — leads por instância, período, origem
2. `v_vendor_activity` — atividade diária por vendedor
3. `v_handoff_details` — eventos de transbordo com motivos
4. `v_agent_performance` — performance IA (custo, tokens, latência)
5. `v_conversion_funnel` — etapas do funil de conversão
6. `v_ia_vs_vendor` — comparativo IA vs vendedor

### Tabelas relevantes existentes
- `shadow_metrics` — métricas diárias/weekly/monthly
- `lead_profiles` — dados dos leads com `current_score`
- `lead_score_history` — histórico de score
- `conversion_funnel_events` — eventos de funil
- `conversations` — conversas (status, inbox_id, assigned_to)
- `poll_messages` / `poll_responses` — enquetes NPS
- `instance_goals` — metas configuráveis por instância
- `notifications` — notificações (M17)
- `ai_agent_logs` — logs do agente IA

### Tabelas que NÃO existem (precisam ser criadas)
- `assistant_conversations` — histórico de conversas do assistente
- `assistant_cache` — cache de queries (hash+TTL)

### Padrões existentes no projeto
- **LLM:** OpenAI (gpt-4.1-mini) via `callLLM()` em `_shared/llmProvider.ts`
- **CORS:** `getDynamicCorsHeaders(req)` para edge functions chamadas pelo browser
- **Auth:** `verifyAuth(req)` retorna userId do JWT
- **Client:** `edgeFunctionFetch()` no frontend
- **Views:** usam `as any` no PostgREST (não tipadas em types.ts)
- **Hooks:** padrão React Query com `useQuery`/`useMutation`
- **Rate limit:** `checkRateLimit(userId, fnName, limit, windowSeconds)` em `_shared/rateLimit.ts`

### Componentes gestão existentes
- `src/components/gestao/` — 13 componentes (KPIs, charts, goals)
- `src/components/manager/` — 6 componentes (filters, ranking, funnel)
- `src/pages/dashboard/gestao/` — 4 páginas (vendor, agent, handoff, origin)
- `src/pages/dashboard/ManagerDashboard.tsx` — dashboard principal

### Edge functions existentes: 35
- Nenhuma `assistant-chat` existe ainda
- `_shared/` tem: cors, auth, llmProvider, fetchWithTimeout, logger, response, constants, supabaseClient

### Última migration: `20260418000001_s4_fix_handoff_view_and_goals.sql`

## Decisões já tomadas (wiki)
- NLU + ~20 queries parametrizadas + fallback text-to-SQL restrito contra VIEWs
- GPT-4.1-mini como LLM
- Widget flutuante + página dedicada
- Rate limit 20/min
- Cache por hash+TTL
- SQL Validator: whitelist VIEWs, anti-injection, SELECT only, timeout 5s
