# AI Agent Database Schema

**Analysis Date:** 2026-04-04

## Table Relationships

```
ai_agents (1) ──< ai_agent_logs (many)
ai_agents (1) ──< ai_agent_products (many)
ai_agents (1) ──< ai_agent_knowledge (many)
ai_agents (1) ──< ai_agent_media (many)
ai_agents (1) ──< ai_agent_validations (many)
ai_agents (1) ──< e2e_test_runs (many)
ai_agents (1) ── instances (1) via instance_id
conversations (1) ──< ai_agent_validations (many)
conversations (1) ──< ai_agent_logs (many)
contacts (1) ── lead_profiles (1) via contact_id
```

## Core Tables

### ai_agents
**Migration:** `supabase/migrations/20260322021531_create_ai_agent_tables_v3.sql` + subsequent ALTER TABLE migrations
**Purpose:** Configuration for each AI agent instance (one per WhatsApp instance)

```sql
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  name TEXT NOT NULL DEFAULT 'Assistente IA',
  
  -- Personality & Prompt
  greeting_message TEXT NOT NULL DEFAULT 'Olá! Como posso ajudá-lo?',
  personality TEXT DEFAULT 'Profissional, simpático e objetivo',
  system_prompt TEXT DEFAULT '',
  prompt_sections JSONB DEFAULT '{}',          -- Prompt Studio: 9 editable sections
  sub_agents JSONB DEFAULT '[]',
  
  -- LLM Config
  model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  temperature FLOAT NOT NULL DEFAULT 0.7,
  max_tokens INT NOT NULL DEFAULT 1024,
  
  -- Behavior
  debounce_seconds INT NOT NULL DEFAULT 10,
  max_pre_search_questions INT NOT NULL DEFAULT 3,
  max_lead_messages INT DEFAULT 8,            -- auto-handoff after N lead msgs
  context_short_messages INT NOT NULL DEFAULT 10,
  context_long_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Handoff
  handoff_triggers TEXT[] DEFAULT ARRAY['atendente','humano','gerente','falar com pessoa'],
  handoff_cooldown_minutes INT NOT NULL DEFAULT 30,
  handoff_max_conversation_minutes INT NOT NULL DEFAULT 15,
  handoff_negative_sentiment BOOLEAN NOT NULL DEFAULT true,
  handoff_message TEXT,
  handoff_message_outside_hours TEXT DEFAULT 'Sua mensagem foi recebida...',
  
  -- Guardrails
  blocked_topics TEXT[] DEFAULT '{}',
  blocked_phrases TEXT[] DEFAULT '{}',
  max_discount_percent FLOAT DEFAULT NULL,
  
  -- Validator
  validator_enabled BOOLEAN DEFAULT true,
  validator_model TEXT DEFAULT 'gpt-4.1-nano',
  validator_rigor TEXT DEFAULT 'moderado' CHECK (validator_rigor IN ('moderado','rigoroso','maximo')),
  
  -- Voice/TTS
  voice_enabled BOOLEAN NOT NULL DEFAULT false,
  voice_max_text_length INT NOT NULL DEFAULT 150,
  tts_fallback_providers JSONB DEFAULT '["cartesia","murf","speechify"]',
  
  -- Carousel
  carousel_text TEXT DEFAULT 'Confira nossas opções:',
  carousel_button_1 TEXT DEFAULT 'Eu quero!',
  carousel_button_2 TEXT DEFAULT 'Mais informações',
  
  -- Business Config
  business_hours JSONB DEFAULT NULL,          -- Weekly format: {"mon":{"open":true,"start":"08:00","end":"18:00"}, ...}
  business_info JSONB DEFAULT NULL,           -- Company info (hours, address, payment, delivery, etc.)
  out_of_hours_message TEXT DEFAULT 'Estamos fora do horário...',
  extraction_fields TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT ai_agents_instance_unique UNIQUE (instance_id)
);
```

**Key indexes:** instance_id
**RLS:** super_admin full access, users can SELECT if they have instance access
**Constraint:** One agent per instance (UNIQUE on instance_id)

### ai_agent_logs
**Migration:** `supabase/migrations/20260322021531_create_ai_agent_tables_v3.sql`
**Purpose:** Event log for all AI agent activity — source for MetricsConfig

```sql
CREATE TABLE public.ai_agent_logs (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
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

**Event types:** message_received, response_sent, handoff, shadow_extraction, label_assigned
**Key indexes:** agent_id, created_at DESC
**RLS:** super_admin full access

### ai_agent_validations
**Migration:** `supabase/migrations/20260401000000_phase1_validator_prompt_studio_foundation.sql`
**Purpose:** Validator Agent scoring results — source for ValidatorMetrics

```sql
CREATE TABLE public.ai_agent_validations (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','REWRITE','BLOCK')),
  violations JSONB DEFAULT '[]',       -- [{rule, severity, detail, deduction}]
  bonuses JSONB DEFAULT '[]',          -- [{reason, points}]
  rewritten_text TEXT,
  suggestion TEXT,
  block_action TEXT,                   -- 'handoff' or null
  model TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Key indexes:** agent_id+created_at DESC, score, conversation_id+created_at DESC
**RLS:** Full access for all (fire-and-forget inserts from edge functions)

### e2e_test_runs
**Migration:** `supabase/migrations/20260329010000_e2e_automated_tests.sql` + `20260330180000_e2e_approval_and_batch.sql`
**Purpose:** Persisted E2E test results with approval workflow

```sql
CREATE TABLE e2e_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  test_number TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  total_steps INT NOT NULL,
  passed BOOLEAN NOT NULL,
  skipped BOOLEAN NOT NULL DEFAULT false,
  skip_reason TEXT,
  results JSONB NOT NULL DEFAULT '[]',    -- per-step results [{step, input, agent_response, tools_used, tags, latency_ms, tokens}]
  latency_ms INT,
  error TEXT,
  
  -- Approval workflow (added in second migration)
  run_type TEXT NOT NULL DEFAULT 'single' CHECK (run_type IN ('single','batch','manual')),
  approval TEXT DEFAULT NULL CHECK (approval IN ('auto_approved','human_approved','human_rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  batch_id TEXT,
  category TEXT,
  tools_used TEXT[] DEFAULT '{}',
  tools_missing TEXT[] DEFAULT '{}',
  prompt_hash TEXT,                       -- for tracking which prompt version was tested
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key indexes:** agent_id+created_at DESC, passed+created_at DESC, scenario_id+created_at DESC, batch_id+created_at DESC, approval+created_at DESC
**RLS:** super_admin SELECT, service role INSERT, super_admin UPDATE (approve/reject)
**Retention:** `cleanup_old_e2e_runs()` deletes rows older than 30 days

### Approval States
| State | Meaning | Set By |
|-------|---------|--------|
| `auto_approved` | Passed E2E, auto-approved | Frontend (saveE2eResult) |
| `human_approved` | Reviewed and approved by admin | Future approval UI |
| `human_rejected` | Reviewed and rejected by admin | Future approval UI |
| `NULL` | Not yet reviewed (failed tests) | Default |

## Catalog Tables

### ai_agent_products
**Migration:** `supabase/migrations/20260322022139_create_ai_agent_catalog_tables.sql`

```sql
CREATE TABLE public.ai_agent_products (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  sku TEXT,
  title TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  description TEXT,
  price DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  in_stock BOOLEAN NOT NULL DEFAULT true,
  images TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
```

**Indexes:** agent_id, category+subcategory, GIN full-text search (portuguese)
**Used by:** search_products tool (ai-agent + ai-agent-playground), send_carousel

### ai_agent_knowledge
**Migration:** `supabase/migrations/20260322022139_create_ai_agent_catalog_tables.sql`

```sql
CREATE TABLE public.ai_agent_knowledge (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'faq',   -- 'faq' or 'document'
  title TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  metadata JSONB DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ
);
```

**Used by:** FAQ items injected into system prompt via `buildKnowledgeInstruction()`

### ai_agent_media
**Migration:** `supabase/migrations/20260322022139_create_ai_agent_catalog_tables.sql`

```sql
CREATE TABLE public.ai_agent_media (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'support',
  title TEXT NOT NULL,
  description TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  tags TEXT[] DEFAULT '{}',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ
);
```

## Supporting Tables

### ai_debounce_queue
**Purpose:** Atomic message grouping for debounce (prevents race conditions)

```sql
CREATE TABLE public.ai_debounce_queue (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  process_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_debounce_queue_conv_unique UNIQUE (conversation_id)
);
```

### lead_profiles
**Purpose:** Lead data extracted by AI Agent (linked to contacts via contact_id)

```sql
CREATE TABLE public.lead_profiles (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  full_name TEXT, city TEXT, state TEXT, cpf TEXT,
  birth_date DATE, email TEXT, company TEXT, role TEXT,
  interests TEXT[] DEFAULT '{}',
  tags JSONB DEFAULT '{}',
  last_purchase TEXT,
  average_ticket DECIMAL(10,2),
  total_interactions INT NOT NULL DEFAULT 0,
  first_contact_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  sentiment_history JSONB DEFAULT '[]',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  reason TEXT,
  objections TEXT[] DEFAULT '{}',
  conversation_summaries TEXT[],
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  CONSTRAINT lead_profiles_contact_unique UNIQUE (contact_id)
);
```

**Used by:** update_lead_profile tool, shadow mode extraction, context_long_enabled prompt injection

## Schema Gaps for Agent QA Framework

1. **No prompt version tracking** — `prompt_hash` column exists in e2e_test_runs but nothing populates it; no way to correlate test results with specific prompt versions
2. **No agent score history table** — need a time-series table for composite agent scores (validator avg + E2E pass rate + latency trends)
3. **No batch metadata table** — batch_id is just a string; no table to store batch-level aggregates (total passed, total failed, triggered by whom, etc.)
4. **No adjustment log** — when admin changes prompt/config between test cycles, there's no record linking the change to subsequent test improvement
5. **Retention is aggressive** — 30-day cleanup on e2e_test_runs may lose historical trend data needed for evolution tracking

---

*Database schema analysis: 2026-04-04*
