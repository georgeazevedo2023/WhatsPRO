# M19-S5 PLAN — IA Conversacional (v2 — pós-auditoria)

> **Meta:** Gestor pergunta em linguagem natural sobre seus dados. Widget flutuante no dashboard + página dedicada.
> **Dependências:** S2 (views), S3 (dashboard), S4 (fichas individuais)
> **LLM:** gpt-4.1-mini via callLLM() existente (com `tools: []`)
> **Auditoria:** 3 agentes paralelos (segurança, viabilidade, consistência) — 2026-04-13

---

## Correções pós-auditoria

| # | Issue | Severidade | Correção aplicada |
|---|-------|-----------|-------------------|
| A1 | Text-to-SQL fallback é HIGH RISK (SQL injection) | CRÍTICA | **REMOVIDO.** Apenas queries parametrizadas (20 intents). Se intent não mapeado → resposta "não consigo responder essa pergunta" |
| A2 | Views S2 não filtram instance_id internamente | CRÍTICA | Todas as queries em `assistantQueries.ts` incluem `WHERE instance_id = $1` obrigatório. sqlValidator rejeita queries sem `instance_id` |
| A3 | Página na raiz de `/dashboard/` fora do padrão | MENOR | Movida para `src/pages/dashboard/assistant/AssistantPage.tsx` (padrão subfolder) |
| A4 | callLLM requer `tools` como array | CONFIRMADO | Usar `tools: []` (array vazio) — já funciona no codebase |
| A5 | Ctrl+J livre (sem conflito) | CONFIRMADO | Ctrl+J para toggle do widget |
| A6 | Widget monta após `<Outlet>` no DashboardLayout | CONFIRMADO | `fixed bottom-6 right-6 z-50` — persiste entre rotas |

---

## Arquitetura

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│ Widget/Página    │────▶│ assistant-chat   │────▶│ OpenAI       │
│ (React)          │◀────│ (Edge Function)  │◀────│ gpt-4.1-mini │
│ useAssistantChat │     │ NLU → Query → Fmt│     └──────────────┘
└─────────────────┘     │                  │
                        │ assistantQueries │────▶ Views SQL (6)
                        │ cache (hash+TTL) │     + Tabelas diretas
                        └──────────────────┘
```

### Fluxo (SOMENTE queries parametrizadas — sem text-to-SQL)
1. Gestor digita pergunta → `edgeFunctionFetch('assistant-chat', { message, instance_id, context })`
2. Edge fn valida auth (JWT) + verifica role (super_admin/gerente)
3. NLU via LLM classifica intent → mapeia para 1 dos 20 intents parametrizados
4. Se intent não reconhecido → responde "Não consigo responder essa pergunta. Tente reformular."
5. `assistantQueries.get(intent)` retorna SQL parametrizado + `WHERE instance_id = $1`
6. Executa query via `serviceClient.rpc()` com `statement_timeout = 5s`
7. Formata resposta em linguagem natural via LLM (2ª chamada)
8. Cache por hash(intent + params) com TTL 5min
9. Append em `assistant_conversations`
10. Return `{ answer, data?, format_type?, suggestions }`

---

## Plano — 7 Fases

### P1: Migration — Tabelas assistente (T1+T5)

**Migration:** `20260419000001_s5_assistant_tables.sql`

**Tabelas novas:**

```sql
-- Histórico de conversas do assistente
CREATE TABLE assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  messages JSONB NOT NULL DEFAULT '[]',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_convs_instance ON assistant_conversations(instance_id);
CREATE INDEX idx_assistant_convs_user ON assistant_conversations(user_id);
ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;

-- RLS: user vê só suas conversas
CREATE POLICY "Users see own assistant conversations" ON assistant_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Cache de queries (evita re-execução)
CREATE TABLE assistant_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

CREATE UNIQUE INDEX idx_assistant_cache_lookup
  ON assistant_cache(instance_id, query_hash);
ALTER TABLE assistant_cache ENABLE ROW LEVEL SECURITY;

-- RLS: gerente+super_admin leem cache da instância
CREATE POLICY "Managers read assistant cache" ON assistant_cache
  FOR SELECT USING (
    is_super_admin(auth.uid()) OR is_gerente(auth.uid())
  );

-- Trigger updated_at
CREATE TRIGGER set_updated_at_assistant_conversations
  BEFORE UPDATE ON assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RPC segura para executar queries do assistente com timeout
CREATE OR REPLACE FUNCTION assistant_query(
  p_sql TEXT,
  p_params JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Validação: só SELECT permitido
  IF NOT (LOWER(TRIM(p_sql)) LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries allowed';
  END IF;

  EXECUTE p_sql INTO result USING p_params;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
```

**Arquivos:** 1 migration SQL
**Estimativa:** S (30min)

---

### P2: Backend — assistantQueries.ts (T2+T3)

**`supabase/functions/_shared/assistantQueries.ts`**

Biblioteca de 20 intents parametrizados. Cada intent:
- Tem SQL fixo com `$1` = instance_id (OBRIGATÓRIO)
- Params tipados
- `format_type` para renderização no frontend

| # | Intent | Fonte | Format |
|---|--------|-------|--------|
| 1 | `leads_count` | `v_lead_metrics` | number |
| 2 | `leads_by_origin` | `v_lead_metrics` | table |
| 3 | `conversion_rate` | `v_conversion_funnel` | number |
| 4 | `top_sellers` | `v_vendor_activity` | table |
| 5 | `worst_sellers` | `v_vendor_activity` | table |
| 6 | `handoff_rate` | `v_handoff_details` | number |
| 7 | `handoff_reasons` | `v_handoff_details` | table |
| 8 | `agent_cost` | `v_agent_performance` | number |
| 9 | `agent_efficiency` | `v_agent_performance` | table |
| 10 | `ia_vs_vendor` | `v_ia_vs_vendor` | comparison |
| 11 | `nps_average` | `poll_responses` | number |
| 12 | `nps_by_seller` | `poll_responses` | table |
| 13 | `lead_score_distribution` | `lead_profiles` | chart |
| 14 | `hot_leads` | `lead_profiles` | table |
| 15 | `funnel_stages` | `conversion_funnel_events` | chart |
| 16 | `resolution_time` | `v_vendor_activity` | number |
| 17 | `pending_conversations` | `conversations` + `inboxes` | number |
| 18 | `daily_trend` | `shadow_metrics` | chart |
| 19 | `goals_progress` | `instance_goals` | table |
| 20 | `seller_detail` | `v_vendor_activity` | table |

**Implementação:** Cada intent é uma função que recebe `(instanceId, params)` e retorna `{ data, format_type }` usando `serviceClient.from(...).select(...).eq('instance_id', instanceId)`. **Nenhum SQL raw** — usa PostgREST API do Supabase.

> **Decisão auditoria A1:** SEM text-to-SQL. SEM sqlValidator.ts (não necessário sem SQL dinâmico). Intent não reconhecido = resposta amigável de fallback.

**Arquivos:** 1 arquivo em `_shared/`
**Estimativa:** M (2h)

---

### P3: Edge Function — assistant-chat (T4)

**`supabase/functions/assistant-chat/index.ts`**

```
verify_jwt: false (auth manual via verifyAuth)
CORS: getDynamicCorsHeaders(req)
Rate limit: 20 req/min por userId
```

**Fluxo interno:**

```
1. OPTIONS → return CORS
2. Extrair token do Authorization header
3. createUserClient(req) → validar auth.getUser(token)
4. Verificar role: query user_roles (super_admin ou gerente)
   → 403 se não autorizado
5. Parse body: { message, instance_id, conversation_id?, context? }
6. Verificar acesso à instância: user_instance_access
   → 403 se instância não autorizada
7. Rate limit check (20/min) — in-memory fallback se RPC falhar
8. Check cache: hash(message + instance_id)
   → hit (< 5min)? return cached result
9. NLU: callLLM({
     systemPrompt: CLASSIFY_PROMPT,
     messages: [{ role: 'user', content: message }],
     tools: [],
     temperature: 0,
     maxTokens: 200,
     model: 'gpt-4.1-mini'
   })
   → retorna JSON { intent, params }
10. Se intent válido → assistantQueries[intent](instanceId, params)
    Se intent desconhecido → { answer: "Não consigo responder..." }
11. Format: callLLM({
      systemPrompt: FORMAT_PROMPT,
      messages: [{ role: 'user', content: pergunta + resultado }],
      tools: [],
      temperature: 0.3,
      maxTokens: 500
    })
    → resposta em português natural + sugestões
12. Cache result (TTL 5min) — fire-and-forget
13. Append to assistant_conversations — fire-and-forget
14. Return { answer, data?, format_type?, suggestions }
```

**System prompt NLU (classificação):**
```
Você classifica perguntas de gestores sobre métricas de negócio.
Retorne APENAS um JSON válido: { "intent": "nome_do_intent", "params": { ... } }

Intents disponíveis:
- leads_count: quantos leads, volume de leads
- leads_by_origin: leads por canal/origem
- conversion_rate: taxa de conversão
- top_sellers: melhores vendedores
- worst_sellers: piores vendedores
- handoff_rate: taxa de transbordo
- handoff_reasons: motivos de transbordo
- agent_cost: custo da IA
- agent_efficiency: eficiência da IA
- ia_vs_vendor: comparativo IA vs vendedor
- nps_average: NPS médio
- nps_by_seller: NPS por vendedor
- lead_score_distribution: distribuição de scores
- hot_leads: leads quentes (score alto)
- funnel_stages: etapas do funil
- resolution_time: tempo de resolução
- pending_conversations: conversas pendentes
- daily_trend: tendência diária
- goals_progress: progresso das metas
- seller_detail: detalhes de um vendedor específico
- unknown: não consigo classificar

Params possíveis: period (today/7d/30d/90d), seller_id, limit
Se não souber o período, use "30d".
```

**System prompt formatação:**
```
Formate dados de métricas em resposta natural em português brasileiro.
Seja conciso (máx 3 parágrafos). Números: 1.234 e 85,3%.
Ao final, sugira 2-3 perguntas de follow-up como array JSON "suggestions".
```

**Arquivos:** 1 edge function + 1 config (verify_jwt)
**Estimativa:** L (3h)

---

### P4: Frontend — useAssistantChat hook (T6)

**`src/hooks/useAssistantChat.ts`**

```typescript
interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: Record<string, unknown>
  format_type?: 'number' | 'table' | 'chart' | 'comparison'
  suggestions?: string[]
  timestamp: Date
}

interface UseAssistantChat {
  messages: AssistantMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (message: string) => Promise<void>
  clearChat: () => void
  conversations: { id: string; title: string; updated_at: string }[]
  loadConversation: (id: string) => void
  currentConversationId: string | null
}
```

**Detalhes:**
- `edgeFunctionFetch('assistant-chat', { message, instance_id, context })` para enviar
- `instance_id` vem de `useManagerInstances()` (hook já existente)
- Estado local com `useState` para mensagens da sessão
- React Query para listar conversas salvas (`assistant_conversations`)
- `context` automático baseado em `window.location.pathname`
- Sugestões iniciais por página

**Imports:** `@/lib/edgeFunctionClient`, `@/hooks/useManagerInstances`

**Arquivos:** 1 hook
**Estimativa:** M (1.5h)

---

### P5: Widget Flutuante — AssistantChatWidget (T7)

**Ponto de montagem:** `DashboardLayout.tsx` após `<Outlet>`

**`src/components/assistant/AssistantChatWidget.tsx`** — container
- Toggle via botão flutuante (`Sparkles` icon) ou `Ctrl+J`
- `fixed bottom-6 right-6 z-50`
- Estado open/closed em `localStorage`
- Compact: 400x500px
- Só renderiza para `isSuperAdmin || isGerente` (usa `useAuth()`)

**`src/components/assistant/AssistantMessageBubble.tsx`** — bolha
- Estilos distintos: user (direita, azul) / assistant (esquerda, cinza)
- Renderiza `format_type === 'table'` como tabela simples
- Renderiza `format_type === 'number'` com font-size maior

**`src/components/assistant/AssistantInput.tsx`** — input
- Enter para enviar, Shift+Enter para nova linha
- Disabled quando `isLoading`
- Placeholder contextual

**`src/components/assistant/AssistantSuggestions.tsx`** — chips
- Chips clicáveis de sugestões
- Exibidos no empty state e após cada resposta

**Atalho `Ctrl+J`:** Adicionado no `useEffect` do `DashboardLayout.tsx` (mesmo padrão do `Ctrl+K`)

**Arquivos:** 4 componentes + 1 edit DashboardLayout
**Estimativa:** L (3h)

---

### P6: Página Dedicada — /dashboard/assistant (T8+T9)

**`src/pages/dashboard/assistant/AssistantPage.tsx`**

Layout full-screen:
- Sidebar esquerda (240px): lista de conversas anteriores com busca
- Área principal: chat completo + resultados expandidos
- Follow-up automático: 2-3 sugestões após cada resposta
- Botão "Nova conversa"

**Rota:** `/dashboard/assistant` — `CrmRoute` (super_admin + gerente)

**Sidebar nav:** Sub-item "Assistente IA" com ícone `Sparkles` dentro do collapsible "Gestão"
- Posição: após "Metricas Origem" (último item atual)

**Edits:** `App.tsx` (rota), `Sidebar.tsx` (sub-item)

**Arquivos:** 1 página + 2 edits
**Estimativa:** M (2h)

---

### P7: Build + Testes manuais (T10)

**Validação:**
- `npx tsc --noEmit` = 0 erros
- `npm run build` = sucesso
- Deploy `assistant-chat` em produção

**Testes manuais no browser:**
- Widget abre com Ctrl+J
- Widget persiste entre rotas
- Pergunta "quantos leads esse mês?" → resposta com número
- Pergunta "melhores vendedores" → resposta com tabela
- Cache funciona (2ª pergunta idêntica = instantâneo)
- Atendente não vê widget (role check)
- Gestor de instância A não vê dados de B

**Vault:**
- log.md atualizado
- wiki/roadmap.md: S5 ✅
- wiki/decisoes-chave.md: decisões S5

**Arquivos:** testes + vault
**Estimativa:** M (2h)

---

## Resumo de Entregas

| Fase | Arquivos novos | Edits | Tipo |
|------|---------------|-------|------|
| P1 | 1 migration SQL | — | Backend |
| P2 | assistantQueries.ts | — | Backend (_shared) |
| P3 | assistant-chat/index.ts + config | — | Edge Function |
| P4 | useAssistantChat.ts | — | Frontend (hook) |
| P5 | 4 componentes assistant/ | DashboardLayout.tsx | Frontend (UI) |
| P6 | AssistantPage.tsx | App.tsx, Sidebar.tsx | Frontend (página) |
| P7 | — | vault (3 arquivos) | Validação |

**Total:** ~8 arquivos novos, 3 edits em arquivos existentes, 0 HIGH RISK

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| ~~SQL injection via text-to-SQL~~ | **ELIMINADO** — só queries parametrizadas via PostgREST |
| Custo LLM (2 chamadas por pergunta) | Cache 5min + NLU leve (~200 tokens) + formatação curta (~300 tokens). ~$0.001/pergunta |
| Latência (2 chamadas LLM + query) | Cache hit < 100ms; miss ~2-3s (aceitável para analytics) |
| Multi-tenant leak | `instance_id` obrigatório em TODA query + verificação `user_instance_access` na edge fn |
| Rate abuse | 20 req/min por user + circuit breaker no LLM (existente) |
| Intent mal classificado | Fallback amigável "Não consigo responder" + sugestões de reformulação |
| Views não tipadas | PostgREST com `as any` (padrão do projeto — validado em S3/S4) |

---

## Ordem de Execução

```
P1 (migration) → P2 (queries) → P3 (edge fn) → P4 (hook)
                                                  ↓
                                     P5 (widget) + P6 (página)
                                                  ↓
                                              P7 (build+testes)
```

P5 e P6 podem rodar em paralelo após P4.

---

## Checklist pré-deploy

- [ ] Migration aplicada em produção
- [ ] `assistant-chat` deployed com `verify_jwt: false`
- [ ] CORS com `getDynamicCorsHeaders(req)`
- [ ] Rate limit configurado (20/min)
- [ ] Instance access verificado (`user_instance_access`)
- [ ] tsc: 0 erros
- [ ] npm run build: sucesso
- [ ] Widget abre com Ctrl+J
- [ ] Widget só visível para super_admin/gerente
- [ ] Cache funcionando (2ª query = instantâneo)
- [ ] Multi-tenant isolado
- [ ] Vault atualizado (log + roadmap + decisoes)
