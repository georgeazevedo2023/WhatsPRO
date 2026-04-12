# Validator System & Metrics Analysis

**Analysis Date:** 2026-04-04

## Validator Agent Architecture

### Core Module: `supabase/functions/_shared/validatorAgent.ts`

The Validator Agent is an inline quality auditor that scores AI responses before they reach the lead. It runs INSIDE the ai-agent edge function (not a separate function), called after LLM generates a response and before sending via UAZAPI.

**Flow:**
```
ai-agent LLM response → validateResponse() → score 0-10 → PASS/REWRITE/BLOCK
  PASS    → send original text
  REWRITE → send rewritten text (validator provides corrected version)
  BLOCK   → discard response, trigger handoff
```

### Configuration Interface

```typescript
// supabase/functions/_shared/validatorAgent.ts
export interface ValidatorConfig {
  enabled: boolean              // ai_agents.validator_enabled
  model: string                 // ai_agents.validator_model (default: gpt-4.1-nano)
  rigor: 'moderado' | 'rigoroso' | 'maximo'  // ai_agents.validator_rigor
  personality: string           // ai_agents.personality
  systemPrompt: string          // ai_agents.system_prompt
  blockedTopics: string[]       // ai_agents.blocked_topics
  blockedPhrases: string[]      // ai_agents.blocked_phrases
  maxDiscountPercent: number | null  // ai_agents.max_discount_percent
  businessInfo: Record<string, string> | null  // ai_agents.business_info
  leadName: string | null       // from lead_profiles.full_name
  msgsSinceLastNameUse: number  // computed by countMsgsSinceNameUse()
  leadQuestions?: string[]      // questions from current turn
  catalogPrices?: string[]      // known prices from search results
}
```

### Scoring System

**Rigor Thresholds:**
- `moderado`: score >= 8 = PASS
- `rigoroso`: score >= 9 = PASS
- `maximo`: only 10 = PASS

**Violation Severities and Deductions:**
| Severity | Deduction | Examples |
|----------|-----------|---------|
| critico  | -10 (score=0) | Invent price/info, offensive content, reveal AI identity |
| grave    | -3 each | "nao temos", mention competitor, exceed discount, multiple questions, blocked topic/phrase |
| moderado | -2 each | Response too long (>4 sentences), inconsistent tone |
| leve     | -1 each | Name used too frequently, excessive emoji, repetition |

**Bonuses:** +1 each (max 10 total)
- Precise qualification question, natural name use, persuasive copy, genuine empathy

### LLM Call
```typescript
const llmResult = await callLLM({
  systemPrompt: buildValidatorPrompt(config),
  messages: [{ role: 'user', content: `Resposta do agente:\n\n"${responseText}"` }],
  tools: [],
  temperature: 0.1,  // deterministic for consistent scoring
  maxTokens: 512,
  model: config.model || 'gpt-4.1-nano',
})
```

### Response Parsing: `parseValidatorResponse()`
- Extracts JSON from LLM output (handles markdown ```json wrapper)
- Returns: score (clamped 0-10), verdict, violations[], bonuses[], rewritten text, suggestion, block_action
- On parse failure: returns defaults (score=10, PASS) — fail-open strategy

### Persistence (fire-and-forget)
```typescript
supabase.from('ai_agent_validations').insert({
  agent_id, conversation_id, original_text, score, verdict,
  violations, bonuses, rewritten_text, suggestion, block_action,
  model, latency_ms,
})
```

### Helper: `countMsgsSinceNameUse()`
Counts outgoing messages since lead name was last used. Returns 99 if name unknown or never used. Used to enforce "name max 1x every 3-4 msgs" rule.

### Safety Behavior
- Responses shorter than 15 chars bypass validation (auto PASS)
- On LLM call failure: auto PASS (don't block on validator errors)
- Persistence is fire-and-forget (errors logged but don't affect flow)

## Metrics Components

### MetricsConfig: `src/components/admin/ai-agent/MetricsConfig.tsx`

**Data Source:** `ai_agent_logs` table
**Period selector:** 24h, 7d, 30d, 90d
**Pagination:** loads in 1000-row batches to avoid memory spikes

**KPIs displayed:**
- Total responses (with daily average)
- Handoff rate (%) with alert if >30%
- Average latency (with fast/normal/slow indicator, alert if >5s)
- Total tokens (with estimated cost: input*0.15 + output*0.6 per 1M)

**Secondary KPIs:** Handoffs count, Shadow extractions, Labels assigned, Tags updated

**Charts:**
- Tool Usage: horizontal bar chart showing each tool's call count, sorted by frequency
- Hourly Activity: 24-bar histogram of responses per hour

**Token Breakdown:** Input tokens, Output tokens, Estimated cost (3-column grid)

### ValidatorMetrics: `src/components/admin/ai-agent/ValidatorMetrics.tsx`

**Data Source:** `ai_agent_validations` table
**Period selector:** 24h, 7d, 30d
**Limit:** 2000 rows max per fetch

**KPIs displayed:**
- Average score (0-10) with color coding (>=9 green, >=7 yellow, <7 red)
- PASS rate (%)
- REWRITE rate (%)
- BLOCK rate (%)

**Charts:**
- Score Distribution: 5 buckets (10, 8-9, 5-7, 1-4, 0) horizontal bars
- Top Violations: ranked list with severity badges (critico/grave/moderado/leve)

**AI Suggestions:** unique suggestions from validator, last 5

**Latency:** average validator latency in ms

### Where Metrics Live in Admin UI

From CLAUDE.md, the AI Agent admin tabs:
```
Metricas tab → MetricsConfig (ai_agent_logs) + ValidatorMetrics (ai_agent_validations)
```

Both components are in `src/components/admin/ai-agent/` and receive `agentId` as prop.

## Database Tables

### ai_agent_validations
```sql
-- supabase/migrations/20260401000000_phase1_validator_prompt_studio_foundation.sql
CREATE TABLE public.ai_agent_validations (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  original_text TEXT NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','REWRITE','BLOCK')),
  violations JSONB DEFAULT '[]',
  bonuses JSONB DEFAULT '[]',
  rewritten_text TEXT,
  suggestion TEXT,
  block_action TEXT,
  model TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Indexes:** agent_id+created_at DESC, score, conversation_id+created_at DESC
**RLS:** Full access for all (service role writes, super_admin reads)

### ai_agent_logs
```sql
-- supabase/migrations/20260322021531_create_ai_agent_tables_v3.sql
CREATE TABLE public.ai_agent_logs (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id),
  conversation_id UUID REFERENCES conversations(id),
  event TEXT NOT NULL DEFAULT 'message_received',
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  model TEXT,
  latency_ms INT DEFAULT 0,
  sub_agent TEXT,
  tool_calls JSONB DEFAULT NULL,
  error TEXT,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
**Events:** message_received, response_sent, handoff, shadow_extraction, label_assigned

## Gaps for Agent QA Framework

1. **No composite agent score** — MetricsConfig and ValidatorMetrics are separate views; no combined "agent health" score exists
2. **No time-series tracking** — both components show aggregate stats for a period, not day-by-day trends
3. **No E2E metrics integration** — e2e_test_runs data is not displayed in any metrics view
4. **No correlation** — validator scores are not correlated with E2E pass rates
5. **No alerting from metrics** — high handoff rate or low validator score don't trigger notifications
6. **ValidatorMetrics limited to 2000 rows** — may miss data on high-volume agents
7. **MetricsConfig cost estimate is hardcoded** — uses fixed OpenAI pricing, doesn't account for model differences

---

*Validator & metrics analysis: 2026-04-04*
