# Feature F4: Ciclo Automatizado Teste → Ajuste → Re-teste
## Milestone 2 — Agent QA Framework

**Autor:** GSD Planner
**Data:** 2026-04-04
**Status:** Aprovado para execução

---

## Decisão Arquitetural: Abordagem do Runner Agendado

**Pergunta:** Criar nova edge function `e2e-scheduled-v2` ou adicionar flag `scheduled=true` ao `ai-agent-playground`?

**Resposta: Manter e evoluir `e2e-scheduled` existente.**

Razões:
- `e2e-scheduled` já existe com toda a lógica de orquestração (preconditions, evaluation, WhatsApp alert)
- `ai-agent-playground` usa mock UAZAPI — não é adequado para testes reais que precisam validar o pipeline completo
- O padrão já estabelecido no projeto é: `process-jobs` → `verifyCronOrService` → lida com job_type. Seguir o mesmo padrão.
- Adicionar `scheduled=true` ao playground misturaria responsabilidades (testes simulados + pipeline real)

**Padrão de cron:** O projeto usa **pg_cron + net.http_post** (ver `20260228202913`, `20260218203224`, `20260323000001`). A migration `20260329010000` já tem o cron do E2E **comentado** — basta descomentar via nova migration.

**Configuração dinâmica do intervalo:** Não é possível alterar o cron do pg_cron pelo frontend sem uma RPC privilegiada. A abordagem correta é:
1. Armazenar a frequência desejada em `system_settings` (`e2e_schedule_interval_hours`)
2. O `e2e-scheduled` lê esse valor e usa-o como **guard** — se o intervalo desde o último run for menor que o configurado, retorna 200 sem executar
3. O pg_cron continua chamando a cada 6h (fixo), mas o guard interno controla a frequência real

Isso evita precisar de `cron.unschedule` + `cron.schedule` dinâmicos (que exigiriam permissões de banco que o frontend não tem).

---

## Decisão: Mecanismo de Alerta UI

**Pergunta:** Criar tabela `notifications` ou usar padrão existente?

**Resposta: Adicionar coluna `is_regression` e `regression_context` na tabela `e2e_test_batches` existente + badge na UI.**

Razões:
- O projeto não tem tabela `notifications` — criar uma seria scope expansion não pedido
- `e2e_test_batches` já é o lugar certo para metadados de batch
- O `E2eStatusCard` no dashboard já lê `e2e_test_runs` — pode ser estendido para mostrar regressão
- Alerta via WhatsApp já existe em `e2e-scheduled` — apenas enriquecer a mensagem com contexto de regressão

---

## Decisão: Threshold de Regressão

**Armazenamento:** `system_settings` (não `ai_agents`) — o threshold é uma configuração global do sistema QA, não por agente. Chaves:
- `e2e_regression_threshold` — queda de score que dispara alerta (padrão: 10 pontos)
- `e2e_healthy_pass_rate` — taxa de aprovação considerada saudável (padrão: 80)
- `e2e_schedule_interval_hours` — frequência de execução automática (padrão: 6)
- `e2e_alert_whatsapp_enabled` — habilitar/desabilitar alerta WhatsApp (padrão: true)

---

## Arquitetura de Detecção de Regressão

```
e2e-scheduled (pg_cron, 0 */6 * * *)
  → verifica guard de intervalo (e2e_schedule_interval_hours)
  → executa 6 cenários
  → salva resultados em e2e_test_runs com batch_id = 'batch_cron_{timestamp}'
  → computa composite_score do batch atual
  → busca batch anterior (mais recente antes deste)
  → calcula delta: current_score - previous_score
  → se delta < -threshold E foi 2º batch consecutivo abaixo do threshold:
      → flag is_regression=true em e2e_test_batches
      → inclui regression_context JSONB (delta, failed_scenarios, previous_score)
      → enriquece mensagem WhatsApp com contexto de regressão
  → salva batch em e2e_test_batches com composite_score e is_regression
```

**Regra dos 2 batches consecutivos:** Evita falso positivo por não-determinismo do LLM. Apenas após 2 batches consecutivos abaixo do threshold é que a regressão é declarada. O `e2e-scheduled` salva `consecutive_failures_count` em `system_settings` (chave `e2e_consecutive_below_threshold`).

---

## O Que NÃO Mudar

- `ai-agent/index.ts` — NUNCA tocar código de produção do agente neste feature
- `ai-agent-playground/index.ts` — não adicionar lógica de schedule aqui
- `e2e-test/index.ts` — não modificar o runner de testes individuais
- `PlaygroundManualTab.tsx`, `PlaygroundScenariosTab.tsx` — sem alterações
- `e2e_test_runs` schema — não modificar colunas existentes (apenas adicionar se necessário)
- Lógica de aprovação humana (F2) — F4 não toca em ApprovalQueue nem ReviewDrawer
- Fórmula do AgentScoreBar (F3) — F4 usa a mesma lógica de score, mas não modifica F3

---

## Tarefas Detalhadas

---

### TASK 1 — Migration: Colunas de Regressão + Settings + Ativar Cron
**Arquivo:** `supabase/migrations/20260404000002_f4_regression_and_cron.sql`
**Risco:** BAIXO (additive, sem DROP, sem ALTER de colunas existentes)
**Dependências:** nenhuma

**O que fazer:**

```sql
-- 1. Adicionar colunas de regressão em e2e_test_batches
ALTER TABLE public.e2e_test_batches
  ADD COLUMN IF NOT EXISTS is_regression BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regression_context JSONB,
  -- composite_score JA EXISTE: NUMERIC(5,2)
  -- run_type JA EXISTE: text CHECK ('manual','scheduled','regression')
  ADD COLUMN IF NOT EXISTS batch_id_text TEXT; -- alias legível ex: 'batch_cron_1712345678'

-- 2. Índice para busca de regressões
CREATE INDEX IF NOT EXISTS idx_e2e_batches_regression 
  ON public.e2e_test_batches(is_regression, created_at DESC) 
  WHERE is_regression = true;

-- 3. Seeds em system_settings para configuração do ciclo automatizado
INSERT INTO system_settings (key, value, description, is_secret) VALUES
  ('e2e_schedule_interval_hours', '6', 'Intervalo entre execuções automáticas de E2E (horas). Valores: 2, 6, 12, 24', false),
  ('e2e_healthy_pass_rate', '80', 'Taxa de aprovação considerada saudável (%). Abaixo disso é alerta.', false),
  ('e2e_regression_threshold', '10', 'Queda de score (pontos) que dispara flag de regressão entre batches.', false),
  ('e2e_alert_whatsapp_enabled', 'true', 'Habilitar alertas de falha via WhatsApp (true/false)', false),
  ('e2e_consecutive_below_threshold', '0', 'Contador interno: batches consecutivos abaixo do threshold. NÃO editar manualmente.', false)
ON CONFLICT (key) DO NOTHING;

-- 4. Ativar pg_cron para e2e-scheduled (estava comentado em 20260329010000)
-- NOTA: Substituir <SUPABASE_URL> e <ANON_KEY> pelos valores reais de produção
-- URL: https://crzcpnczpuzwieyzbqev.supabase.co
-- ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyemNwbmN6cHV6d2lleXpicWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI1NDUsImV4cCI6MjA4NzM1ODU0NX0.49SQU4odU9nNL9rdIXRsE92HFZFcrRmjQIuur5LRHh4

SELECT cron.schedule(
  'e2e-automated-tests',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/e2e-scheduled',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyemNwbmN6cHV6d2lleXpicWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI1NDUsImV4cCI6MjA4NzM1ODU0NX0.49SQU4odU9nNL9rdIXRsE92HFZFcrRmjQIuur5LRHh4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 5. Ativar cleanup diário (também estava comentado)
SELECT cron.schedule(
  'e2e-cleanup-old-runs',
  '0 3 * * *',
  $$SELECT cleanup_old_e2e_runs();$$
);

-- 6. RPC para buscar o batch anterior (usado pelo e2e-scheduled para comparação)
CREATE OR REPLACE FUNCTION get_previous_e2e_batch(
  p_agent_id UUID,
  p_exclude_batch_uuid UUID
)
RETURNS TABLE(
  batch_uuid UUID,
  composite_score NUMERIC,
  passed INTEGER,
  total INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, composite_score, passed, total, created_at
  FROM public.e2e_test_batches
  WHERE agent_id = p_agent_id
    AND id != p_exclude_batch_uuid
    AND status = 'complete'
    AND composite_score IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
$$;
```

**Verificação:**
```bash
# Confirmar migration aplicada
npx supabase db diff --schema public 2>/dev/null | grep -E "is_regression|e2e_schedule|get_previous"

# Confirmar system_settings inseridas
npx supabase db reset --dry-run 2>/dev/null || echo "check manually in studio"
```

---

### TASK 2 — Backend: Evoluir `e2e-scheduled` com Regressão + Guard de Intervalo + batch_uuid
**Arquivo:** `supabase/functions/e2e-scheduled/index.ts`
**Risco:** MÉDIO (modifica função existente que já está em produção via cron comentado)
**Dependências:** TASK 1

**Mudanças exatas (não reescrever — alterar seções específicas):**

**2a. No início da função `Deno.serve`, após carregar o agent, adicionar guard de intervalo:**

```typescript
// ─── Guard: intervalo dinâmico ────────────────────────────────────────
const { data: intervalSetting } = await supabase
  .from('system_settings')
  .select('value')
  .eq('key', 'e2e_schedule_interval_hours')
  .maybeSingle()
const intervalHours = parseInt(intervalSetting?.value || '6', 10)

// Buscar o último batch completo para checar o intervalo
const { data: lastBatch } = await supabase
  .from('e2e_test_batches')
  .select('created_at')
  .eq('agent_id', agent.id)
  .eq('status', 'complete')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const isManualTrigger = (body.force === true)
if (lastBatch && !isManualTrigger) {
  const hoursSinceLast = (Date.now() - new Date(lastBatch.created_at).getTime()) / 3600000
  if (hoursSinceLast < intervalHours) {
    log.info('Skipping: too soon since last run', { hoursSinceLast, intervalHours })
    return successResponse(corsHeaders, { skipped: true, reason: `Last run ${hoursSinceLast.toFixed(1)}h ago, interval=${intervalHours}h` })
  }
}
```

**2b. Após carregar `alertNumber` e `testNumber`, criar o batch row no início da execução:**

```typescript
// ─── Criar batch row (estado inicial: running) ────────────────────────
const batchTimestamp = Date.now()
const batchIdText = `batch_cron_${batchTimestamp}`
const { data: batchRow } = await supabase
  .from('e2e_test_batches')
  .insert({
    agent_id: agent.id,
    run_type: 'scheduled',
    status: 'running',
    total: SCENARIOS.length,
    passed: 0,
    failed: 0,
    batch_id_text: batchIdText,
  })
  .select('id')
  .single()
const batchUuid: string | null = batchRow?.id || null
```

**2c. Em cada `supabase.from('e2e_test_runs').insert(...)`, adicionar o campo `batch_uuid`:**

```typescript
// Adicionar em TODOS os inserts de e2e_test_runs:
batch_uuid: batchUuid,
// E também batch_id (campo text legado):
batch_id: batchIdText,
// E também run_type:
run_type: 'scheduled',
```

**2d. Após o loop de cenários (antes de `sendWhatsAppAlert`), calcular composite_score e detectar regressão:**

```typescript
// ─── Calcular composite_score do batch atual ────────────────────────
// Fórmula simples baseada em E2E pass rate (principal sinal disponível aqui)
// A fórmula completa (com validator + latency) é calculada no frontend (F3)
// Aqui usamos apenas: pass_rate * 100 como score base
const passCount_final = passed.length
const totalRan = passed.length + failed.length // exclui skipped
const compositeScore = totalRan > 0
  ? Math.round((passCount_final / totalRan) * 100)
  : null

// ─── Regressão: comparar com batch anterior ──────────────────────────
let isRegression = false
let regressionContext: Record<string, unknown> | null = null

if (batchUuid && compositeScore !== null) {
  const { data: previousBatch } = await supabase
    .rpc('get_previous_e2e_batch', {
      p_agent_id: agent.id,
      p_exclude_batch_uuid: batchUuid,
    })
    .maybeSingle()

  // Ler threshold e contador de consecutivos
  const [{ data: thresholdSetting }, { data: consecutiveSetting }, { data: healthySetting }] = await Promise.all([
    supabase.from('system_settings').select('value').eq('key', 'e2e_regression_threshold').maybeSingle(),
    supabase.from('system_settings').select('value').eq('key', 'e2e_consecutive_below_threshold').maybeSingle(),
    supabase.from('system_settings').select('value').eq('key', 'e2e_healthy_pass_rate').maybeSingle(),
  ])

  const threshold = parseFloat(thresholdSetting?.value || '10')
  const healthyRate = parseFloat(healthySetting?.value || '80')
  let consecutiveCount = parseInt(consecutiveSetting?.value || '0', 10)

  if (previousBatch?.composite_score !== undefined && previousBatch.composite_score !== null) {
    const delta = compositeScore - Number(previousBatch.composite_score)
    const isBelowHealthy = compositeScore < healthyRate

    if (isBelowHealthy) {
      consecutiveCount++
    } else {
      consecutiveCount = 0 // reset quando saudável
    }

    // Regressão = queda > threshold OU 2+ batches consecutivos abaixo do healthy rate
    if (delta < -threshold || consecutiveCount >= 2) {
      isRegression = true
      regressionContext = {
        delta,
        current_score: compositeScore,
        previous_score: Number(previousBatch.composite_score),
        previous_batch_uuid: previousBatch.batch_uuid,
        consecutive_below_threshold: consecutiveCount,
        failed_scenarios: failed.map((r) => ({ id: r.scenario_id, name: r.scenario_name, reason: r.reason || r.error })),
      }
    }

    // Atualizar contador consecutivo
    await supabase
      .from('system_settings')
      .update({ value: String(consecutiveCount) })
      .eq('key', 'e2e_consecutive_below_threshold')
  }
}

// ─── Atualizar batch row com resultados finais ────────────────────────
if (batchUuid) {
  await supabase
    .from('e2e_test_batches')
    .update({
      status: 'complete',
      passed: passed.length,
      failed: failed.length,
      total: SCENARIOS.length,
      composite_score: compositeScore,
      is_regression: isRegression,
      regression_context: regressionContext,
    })
    .eq('id', batchUuid)
}
```

**2e. Enriquecer a mensagem de alerta WhatsApp com contexto de regressão:**

```typescript
// Substituir o bloco existente `if (failed.length > 0)` por:
if (failed.length > 0 || isRegression) {
  const { data: alertEnabledSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'e2e_alert_whatsapp_enabled')
    .maybeSingle()
  const alertEnabled = alertEnabledSetting?.value !== 'false'

  if (alertEnabled) {
    const lines: string[] = []

    if (isRegression) {
      const ctx = regressionContext as Record<string, unknown>
      lines.push(`🚨 *REGRESSÃO DETECTADA* — Score: ${compositeScore} (era ${ctx.previous_score}, delta: ${(ctx.delta as number).toFixed(0)}pts)`)
    } else {
      lines.push(`⚠️ *E2E Alerta* — ${failed.length}/${SCENARIOS.length} falharam`)
    }
    lines.push('')

    for (const r of failed) {
      lines.push(`❌ ${r.scenario_name}: ${r.error || r.reason || 'erro desconhecido'}`)
    }
    for (const r of passed) {
      lines.push(`✅ ${r.scenario_name}: OK (${((r.latency_ms as number) / 1000).toFixed(1)}s)`)
    }
    for (const r of skipped) {
      lines.push(`⏭️ ${r.scenario_name}: SKIP (${r.skip_reason})`)
    }

    // ... manter contagem de tokens existente ...
    lines.push('')
    lines.push(`📊 Score: ${compositeScore ?? '?'}/100 | 🕐 ${(totalLatency / 1000).toFixed(1)}s`)
    if (isRegression) {
      lines.push(`⚙️ Revise o Prompt Studio → aba E2E Real → Histórico`)
    }

    await sendWhatsAppAlert(instance.token, alertNumber, lines.join('\n'))
  }
}
```

**Verificação:**
```bash
npx supabase functions deploy e2e-scheduled
# Testar manualmente com force=true (ignora guard de intervalo):
curl -X POST "https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/e2e-scheduled" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
# Esperado: 200 com total/passed/failed/skipped + is_regression no batch
```

---

### TASK 3 — Frontend: Hook `useE2eScheduleSettings`
**Arquivo:** `src/hooks/useE2eScheduleSettings.ts` (NOVO)
**Risco:** BAIXO (novo hook, sem alterar existente)
**Dependências:** TASK 1

**O que criar:**

```typescript
// Hook para ler/salvar configurações do ciclo automatizado de e2e
// Usa system_settings table (super_admin only)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface E2eScheduleSettings {
  intervalHours: number;      // 2 | 6 | 12 | 24
  healthyPassRate: number;    // 0-100
  regressionThreshold: number; // pontos de queda (ex: 10)
  whatsappEnabled: boolean;   // alerta WhatsApp habilitado
}

const SETTING_KEYS = [
  'e2e_schedule_interval_hours',
  'e2e_healthy_pass_rate',
  'e2e_regression_threshold',
  'e2e_alert_whatsapp_enabled',
] as const;

export function useE2eScheduleSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['e2e-schedule-settings'],
    queryFn: async (): Promise<E2eScheduleSettings> => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', SETTING_KEYS);
      if (error) throw error;
      const map = Object.fromEntries((data || []).map(s => [s.key, s.value]));
      return {
        intervalHours: parseInt(map.e2e_schedule_interval_hours || '6', 10),
        healthyPassRate: parseInt(map.e2e_healthy_pass_rate || '80', 10),
        regressionThreshold: parseInt(map.e2e_regression_threshold || '10', 10),
        whatsappEnabled: map.e2e_alert_whatsapp_enabled !== 'false',
      };
    },
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<E2eScheduleSettings>) => {
      const updates: Array<{ key: string; value: string }> = [];
      if (patch.intervalHours !== undefined)
        updates.push({ key: 'e2e_schedule_interval_hours', value: String(patch.intervalHours) });
      if (patch.healthyPassRate !== undefined)
        updates.push({ key: 'e2e_healthy_pass_rate', value: String(patch.healthyPassRate) });
      if (patch.regressionThreshold !== undefined)
        updates.push({ key: 'e2e_regression_threshold', value: String(patch.regressionThreshold) });
      if (patch.whatsappEnabled !== undefined)
        updates.push({ key: 'e2e_alert_whatsapp_enabled', value: String(patch.whatsappEnabled) });
      for (const u of updates) {
        await supabase.from('system_settings').update({ value: u.value }).eq('key', u.key);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['e2e-schedule-settings'] });
      toast.success('Configurações salvas');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  return { settings: query.data, isLoading: query.isLoading, save: mutation.mutateAsync, isSaving: mutation.isPending };
}
```

**Verificação:** `npx tsc --noEmit` passa sem erros neste arquivo.

---

### TASK 4 — Frontend: Hook `useE2eBatchHistory` (evolução)
**Arquivo:** `src/hooks/useE2eBatchHistory.ts` (NOVO — não existe ainda, confirmado no research)
**Risco:** BAIXO
**Dependências:** TASK 1

**O que criar:**

```typescript
// Busca histórico de batches da e2e_test_batches table
// Inclui flag is_regression para badges no histórico

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface E2eBatchSummary {
  id: string;
  batch_id_text: string | null;
  run_type: 'manual' | 'scheduled' | 'regression';
  created_at: string;
  total: number;
  passed: number;
  failed: number;
  composite_score: number | null;
  is_regression: boolean;
  regression_context: {
    delta: number;
    current_score: number;
    previous_score: number;
    consecutive_below_threshold: number;
    failed_scenarios: Array<{ id: string; name: string; reason: string }>;
  } | null;
  status: 'running' | 'complete' | 'approved' | 'rejected';
}

export function useE2eBatchHistory(agentId: string | null, limitDays = 30) {
  return useQuery({
    queryKey: ['e2e-batch-history', agentId, limitDays],
    queryFn: async (): Promise<E2eBatchSummary[]> => {
      if (!agentId) return [];
      const since = new Date(Date.now() - limitDays * 86400_000).toISOString();
      const { data, error } = await supabase
        .from('e2e_test_batches')
        .select('id, batch_id_text, run_type, created_at, total, passed, failed, composite_score, is_regression, regression_context, status')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as E2eBatchSummary[];
    },
    enabled: !!agentId,
    staleTime: 60_000,
  });
}

// Hook auxiliar: trend de pass rate (últimos N batches completos)
export function useE2eTrend(agentId: string | null, count = 10) {
  return useQuery({
    queryKey: ['e2e-trend', agentId, count],
    queryFn: async () => {
      if (!agentId) return [];
      const { data } = await supabase
        .from('e2e_test_batches')
        .select('created_at, composite_score, passed, total, is_regression')
        .eq('agent_id', agentId)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(count);
      return (data || []).reverse(); // ascending para o gráfico
    },
    enabled: !!agentId,
    staleTime: 60_000,
  });
}
```

**Verificação:** `npx tsc --noEmit` passa sem erros.

---

### TASK 5 — Frontend: Componente `E2eSchedulePanel` (Config UI)
**Arquivo:** `src/components/admin/ai-agent/playground/E2eSchedulePanel.tsx` (NOVO)
**Risco:** BAIXO
**Dependências:** TASK 3

**O que criar — painel de configuração do ciclo automatizado:**

O componente deve renderizar dentro da aba E2E Real, após o config bar existente, **atrás de um toggle "Configurar agendamento"** para não poluir o layout padrão.

```tsx
// Estrutura visual do painel:
//
// [toggle] "Agendamento Automático" [switch ON/OFF implícito via intervalo=0]
//
// Quando expandido:
// ┌─────────────────────────────────────────────────────────┐
// │  Frequência: [2h] [6h] [12h] [24h]  (radio buttons)    │
// │  Taxa saudável: [80]% — abaixo disso é alerta           │
// │  Limiar de regressão: [10] pts — queda entre batches    │
// │  Alerta WhatsApp: [switch]                              │
// │                                          [Salvar]        │
// └─────────────────────────────────────────────────────────┘

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Clock, Bell } from 'lucide-react';
import { useE2eScheduleSettings } from '@/hooks/useE2eScheduleSettings';

const INTERVAL_OPTIONS = [
  { value: 2, label: '2h' },
  { value: 6, label: '6h' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
];

export const E2eSchedulePanel = () => {
  const [expanded, setExpanded] = useState(false);
  const { settings, isLoading, save, isSaving } = useE2eScheduleSettings();
  const [draft, setDraft] = useState<typeof settings | null>(null);

  const current = draft ?? settings;

  const handleSave = async () => {
    if (!draft) return;
    await save(draft);
    setDraft(null);
  };

  if (isLoading || !current) return null;

  return (
    <div className="border border-border/50 rounded-lg bg-muted/20 mb-2">
      {/* Header toggle */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-xs">Agendamento Automático</span>
          <Badge variant="outline" className="text-[10px] px-1">
            a cada {current.intervalHours}h
          </Badge>
          {/* Mostrar badge de alerta ativo/inativo */}
          {current.whatsappEnabled && (
            <Badge variant="secondary" className="text-[10px] px-1 gap-0.5">
              <Bell className="w-2.5 h-2.5" />WhatsApp
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded config */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50">
          {/* Frequência */}
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs">Frequência de execução automática</Label>
            <div className="flex gap-1.5">
              {INTERVAL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDraft(d => ({ ...(d ?? current!), intervalHours: opt.value }))}
                  className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                    current.intervalHours === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              O pg_cron executa a cada 6h. O guard interno respeita o intervalo configurado aqui.
            </p>
          </div>

          {/* Taxa saudável + Threshold */}
          <div className="flex gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Taxa saudável (%)</Label>
              <Input
                type="number" min={50} max={100}
                value={current.healthyPassRate}
                onChange={e => setDraft(d => ({ ...(d ?? current!), healthyPassRate: parseInt(e.target.value) }))}
                className="w-20 h-7 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Limiar de regressão (pts)</Label>
              <Input
                type="number" min={5} max={30}
                value={current.regressionThreshold}
                onChange={e => setDraft(d => ({ ...(d ?? current!), regressionThreshold: parseInt(e.target.value) }))}
                className="w-20 h-7 text-xs"
              />
            </div>
          </div>

          {/* WhatsApp alert toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="whatsapp-alert"
              checked={current.whatsappEnabled}
              onCheckedChange={v => setDraft(d => ({ ...(d ?? current!), whatsappEnabled: v }))}
            />
            <Label htmlFor="whatsapp-alert" className="text-xs">Alerta WhatsApp em falhas/regressão</Label>
          </div>

          {/* Save button */}
          {draft && (
            <Button size="sm" className="h-7 text-xs w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
```

**Verificação:** Componente renderiza sem erros em `PlaygroundE2eTab`. O toggle funciona.

---

### TASK 6 — Frontend: `RegressionBadge` + evolução do `BatchHistoryPanel`
**Arquivos:**
- `src/components/admin/ai-agent/playground/RegressionBadge.tsx` (NOVO — componente pequeno)
- `src/components/admin/ai-agent/playground/BatchHistoryPanel.tsx` (NOVO)
**Risco:** BAIXO
**Dependências:** TASK 4

**6a. `RegressionBadge.tsx` — Badge visual para batches com regressão:**

```tsx
// Exibido ao lado do score no histórico quando is_regression=true
// Tooltip mostra o contexto (delta, failing scenarios)

import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { E2eBatchSummary } from '@/hooks/useE2eBatchHistory';

interface Props {
  batch: E2eBatchSummary;
}

export const RegressionBadge = ({ batch }: Props) => {
  if (!batch.is_regression) return null;
  const ctx = batch.regression_context;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="destructive" className="text-[10px] px-1.5 gap-0.5 cursor-help">
          <AlertTriangle className="w-2.5 h-2.5" />
          REGRESSÃO {ctx ? `${ctx.delta > 0 ? '+' : ''}${ctx.delta.toFixed(0)}pts` : ''}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] text-xs space-y-1">
        {ctx && (
          <>
            <p className="font-medium">Score: {ctx.current_score} (era {ctx.previous_score})</p>
            {ctx.failed_scenarios?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {ctx.failed_scenarios.map((s) => (
                  <li key={s.id} className="text-red-400">❌ {s.name}: {s.reason}</li>
                ))}
              </ul>
            )}
            {ctx.consecutive_below_threshold >= 2 && (
              <p className="text-amber-400">{ctx.consecutive_below_threshold} batches consecutivos abaixo do threshold</p>
            )}
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
};
```

**6b. `BatchHistoryPanel.tsx` — Lista de batches com delta de score e badge de regressão:**

```tsx
// Renderizado dentro da aba E2E Real (ou como nova aba "Histórico")
// Mostra últimos N batches com:
//   - data/hora do run
//   - tipo: manual | scheduled
//   - score: 85/100 com delta vs anterior (▲+5, ▼-8)
//   - RegressionBadge se is_regression
//   - pass/fail count
//   - botão "Re-testar falhas" (ver TASK 7)

import { memo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Play, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RegressionBadge } from './RegressionBadge';
import { useE2eBatchHistory } from '@/hooks/useE2eBatchHistory';
import type { E2eBatchSummary } from '@/hooks/useE2eBatchHistory';

interface Props {
  agentId: string | null;
  onRetestBatch?: (batchUuid: string, batchIdText: string) => void;
}

function ScoreDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 1) return <Minus className="w-3 h-3 text-muted-foreground" />;
  const isUp = delta > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isUp ? '+' : ''}{delta.toFixed(0)}pts
    </span>
  );
}

export const BatchHistoryPanel = memo(({ agentId, onRetestBatch }: Props) => {
  const { data: batches, isLoading } = useE2eBatchHistory(agentId);

  if (isLoading) return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      Carregando histórico...
    </div>
  );

  if (!batches?.length) return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      Nenhum batch registrado ainda.
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1.5 p-1">
        {batches.map((batch: E2eBatchSummary, idx: number) => {
          const prev = batches[idx + 1] ?? null;
          const passRate = batch.total > 0 ? Math.round((batch.passed / batch.total) * 100) : null;
          const hasFailed = batch.failed > 0;

          return (
            <div
              key={batch.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                batch.is_regression
                  ? 'border-red-500/30 bg-red-500/5'
                  : hasFailed
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-border/50 bg-muted/20'
              }`}
            >
              {/* Data/tipo */}
              <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(new Date(batch.created_at), { locale: ptBR, addSuffix: true })}</span>
              </div>

              {/* Tipo de run */}
              <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                {batch.run_type === 'scheduled' ? 'auto' : 'manual'}
              </Badge>

              {/* Score + delta */}
              <div className="flex items-center gap-1.5">
                <span className={`font-mono font-bold ${
                  passRate !== null && passRate >= 80 ? 'text-emerald-400' :
                  passRate !== null && passRate >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {passRate !== null ? `${passRate}%` : '—'}
                </span>
                <ScoreDelta
                  current={batch.composite_score}
                  previous={prev?.composite_score ?? null}
                />
              </div>

              {/* Pass/fail count */}
              <span className="text-muted-foreground">
                {batch.passed}/{batch.total} pass
              </span>

              {/* Regression badge */}
              <RegressionBadge batch={batch} />

              <div className="flex-1" />

              {/* Re-testar falhas */}
              {hasFailed && onRetestBatch && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => onRetestBatch(batch.id, batch.batch_id_text || batch.id)}
                >
                  <Play className="w-2.5 h-2.5" />Re-testar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
});
BatchHistoryPanel.displayName = 'BatchHistoryPanel';
```

**Verificação:** `npx tsc --noEmit` passa. Componentes importam corretamente.

---

### TASK 7 — Frontend: Lógica "Re-testar Falhas" + Integrar Tudo no `PlaygroundE2eTab`
**Arquivos:**
- `src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx` (MODIFICAR)
- `src/pages/dashboard/AIAgentPlayground.tsx` (MODIFICAR — adicionar retest handler)
**Risco:** MÉDIO (modifica componentes existentes, mas apenas additive — novas props/tabs)
**Dependências:** TASK 5, TASK 6

**7a. Adicionar retest handler em `AIAgentPlayground.tsx`:**

Após a função `runAllE2e` existente, adicionar:

```typescript
// Re-testar apenas os cenários que falharam em um batch específico
const retestBatchFailures = async (batchUuid: string, batchIdText: string) => {
  if (e2eRunning || batchRunning || !selectedAgentId) return;

  // Buscar os scenario_ids que falharam neste batch
  const { data: failures } = await supabase
    .from('e2e_test_runs')
    .select('scenario_id')
    .eq('batch_uuid', batchUuid)
    .eq('passed', false)
    .eq('skipped', false);

  if (!failures?.length) {
    toast.info('Nenhuma falha encontrada neste batch');
    return;
  }

  const failedIds = new Set(failures.map(f => f.scenario_id));
  const scenariosToRetest = TEST_SCENARIOS.filter(s => failedIds.has(s.id));

  if (!scenariosToRetest.length) {
    toast.info('Cenários não encontrados nos fixtures locais');
    return;
  }

  // Novo batchId para o re-teste
  const retestBatchId = `retest_${batchUuid.substring(0, 8)}_${Date.now()}`;

  setBatchRunning(true);
  batchAbortRef.current = false;
  setBatchProgress({ current: 0, total: scenariosToRetest.length });
  setE2eResults([]);
  setActiveTab('e2e'); // Navegar para aba E2E

  toast.info(`Re-testando ${scenariosToRetest.length} cenário(s) que falharam`);

  for (let i = 0; i < scenariosToRetest.length; i++) {
    if (batchAbortRef.current) break;
    setBatchProgress({ current: i + 1, total: scenariosToRetest.length });
    await runE2eScenario(scenariosToRetest[i], 'batch', retestBatchId);
    if (i < scenariosToRetest.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  setBatchRunning(false);
  // Invalidar cache do histórico após o re-teste
  queryClient.invalidateQueries({ queryKey: ['e2e-batch-history'] });
  toast.success(`Re-teste concluído: ${scenariosToRetest.length} cenário(s)`);
};
```

Adicionar `import { useQueryClient } from '@tanstack/react-query';` e `const queryClient = useQueryClient();` no topo do componente.

Passar `retestBatchFailures` como nova prop `onRetestBatch` para `PlaygroundE2eTab`.

**7b. Evoluir `PlaygroundE2eTab.tsx` — adicionar novas props e sub-tabs "E2E / Histórico":**

Adicionar props ao interface `PlaygroundE2eTabProps`:
```typescript
onRetestBatch: (batchUuid: string, batchIdText: string) => void;
selectedAgentId: string | null; // para passar ao BatchHistoryPanel
```

Adicionar sub-tabs dentro do TabsContent `value="e2e"`:

```tsx
// Dentro do TabsContent value="e2e", após o config bar atual:
// Adicionar sub-navegação simples:

const [e2eSubTab, setE2eSubTab] = useState<'run' | 'history'>('run');

// Renderizar E2eSchedulePanel ACIMA dos sub-tabs (sempre visível)
<E2eSchedulePanel />

// Sub-tabs
<div className="flex gap-1 mb-2">
  <button
    className={`px-3 py-1 text-xs rounded transition-colors ${e2eSubTab === 'run' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
    onClick={() => setE2eSubTab('run')}
  >
    Executar
  </button>
  <button
    className={`px-3 py-1 text-xs rounded transition-colors ${e2eSubTab === 'history' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
    onClick={() => setE2eSubTab('history')}
  >
    Histórico
  </button>
</div>

// Mostrar conteúdo baseado no sub-tab:
{e2eSubTab === 'run' && (
  /* todo o conteúdo existente de run/batch */
)}
{e2eSubTab === 'history' && (
  <BatchHistoryPanel
    agentId={selectedAgentId}
    onRetestBatch={onRetestBatch}
  />
)}
```

**7c. Evoluir `E2eStatusCard.tsx` para mostrar badge de regressão:**

No componente existente, adicionar após carregar os runs:

```typescript
// Verificar se o último batch é uma regressão
const { data: lastBatchData } = await supabase
  .from('e2e_test_batches')
  .select('is_regression, composite_score, regression_context')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
// ...
const isLastBatchRegression = lastBatchData?.is_regression ?? false;
```

Na UI do card, adicionar abaixo dos contadores atuais:
```tsx
{isLastBatchRegression && (
  <span className="flex items-center gap-0.5 text-red-500 text-[10px]">
    <AlertTriangle className="w-3 h-3" /> Regressão
  </span>
)}
```

**Verificação:**
```bash
npx tsc --noEmit   # sem erros de tipo
npm run build      # build de produção sem erros
```

Teste manual:
1. Abrir Playground > aba E2E Real
2. Verificar que E2eSchedulePanel aparece com toggle colapsado
3. Expandir → alterar frequência para 2h → Salvar → confirmar toast
4. Clicar em "Histórico" → BatchHistoryPanel aparece (pode estar vazio se não há batches)
5. Executar batch manual → Após conclusão, navegar para Histórico → batch aparece
6. Se batch tem falhas, botão "Re-testar" aparece → clicar → novo batch inicia

---

## Resumo de Arquivos Modificados/Criados

| Arquivo | Tipo | Risco |
|---------|------|-------|
| `supabase/migrations/20260404000002_f4_regression_and_cron.sql` | NOVO | BAIXO |
| `supabase/functions/e2e-scheduled/index.ts` | MODIFICAR | MÉDIO |
| `src/hooks/useE2eScheduleSettings.ts` | NOVO | BAIXO |
| `src/hooks/useE2eBatchHistory.ts` | NOVO | BAIXO |
| `src/components/admin/ai-agent/playground/E2eSchedulePanel.tsx` | NOVO | BAIXO |
| `src/components/admin/ai-agent/playground/RegressionBadge.tsx` | NOVO | BAIXO |
| `src/components/admin/ai-agent/playground/BatchHistoryPanel.tsx` | NOVO | BAIXO |
| `src/components/admin/ai-agent/playground/PlaygroundE2eTab.tsx` | MODIFICAR | MÉDIO |
| `src/pages/dashboard/AIAgentPlayground.tsx` | MODIFICAR | MÉDIO |
| `src/components/dashboard/E2eStatusCard.tsx` | MODIFICAR | BAIXO |

**Arquivos que NÃO devem ser tocados:**
- `supabase/functions/ai-agent/index.ts` — produção, HIGH RISK
- `supabase/functions/ai-agent-playground/index.ts` — sem relação com F4
- `supabase/functions/e2e-test/index.ts` — runner individual, estável
- `src/components/admin/ai-agent/playground/PlaygroundManualTab.tsx` — sem relação
- `src/components/admin/ai-agent/playground/PlaygroundScenariosTab.tsx` — sem relação
- `src/components/admin/ai-agent/playground/ApprovalQueue.tsx` — pertence ao F2
- `src/components/admin/ai-agent/AgentScoreBar.tsx` — pertence ao F3

---

## Ordem de Execução e Dependências

```
TASK 1 (Migration) ──┬──> TASK 2 (e2e-scheduled backend)
                     └──> TASK 3 (hook settings)
                     └──> TASK 4 (hook batch history)

TASK 3 ──> TASK 5 (E2eSchedulePanel)
TASK 4 ──> TASK 6 (RegressionBadge + BatchHistoryPanel)

TASK 5 + TASK 6 ──> TASK 7 (integração final + PlaygroundE2eTab)
```

**Wave 1 (pode rodar em paralelo):** TASK 1
**Wave 2 (pode rodar em paralelo):** TASK 2, TASK 3, TASK 4
**Wave 3 (pode rodar em paralelo):** TASK 5, TASK 6
**Wave 4 (final):** TASK 7

---

## Mitigação de Não-Determinismo do LLM

### O problema
Testes E2E são inerentemente flaky. Um cenário pode falhar hoje e passar amanhã com o mesmo prompt. Se alertar em cada falha individual, o admin perde confiança no sistema.

### As mitigações implementadas neste plano

| Risco | Mitigação | Onde |
|-------|-----------|------|
| Falso positivo por flakiness | Regressão só declarada após 2 batches consecutivos abaixo do threshold OU queda > threshold no score | `e2e-scheduled` TASK 2 |
| Score volátil | Score calculado como pass_rate do batch (6 cenários) — mais estável que 1 run individual | `e2e-scheduled` TASK 2 |
| Threshold muito baixo gerando ruído | Padrão de 80% healthy + 10pts de threshold — configurável pelo admin | `system_settings` TASK 1 |
| Admin ignora alertas | Alerta WhatsApp pode ser desligado; UI mostra contexto claro com "o que falhou" | `E2eSchedulePanel` TASK 5 |
| Custo surpresa | Painel mostra frequência atual; default 6h (padrão do projeto) | `E2eSchedulePanel` TASK 5 |
| Confusão entre regressão real e flakiness | `regression_context.consecutive_below_threshold` mostra quantos batches estão ruins | `RegressionBadge` TASK 6 |

### O que este plano NÃO faz (e está correto não fazer)
- Não auto-edita prompts (PITFALL: impredizível)
- Não cria cenários a partir de conversas reais (scope expansion)
- Não bloqueia deploy por score baixo (score é advisory)
- Não usa temperatura 0 nos testes E2E (modelos como gpt-4.1-mini se comportam estranhamente em temp=0 — manter temp=0.1 conforme recomendação do research)

---

## Critérios de Sucesso

- [ ] pg_cron executa `e2e-scheduled` a cada 6h e persiste resultados em `e2e_test_batches`
- [ ] Guard de intervalo funciona: se chamado manualmente 1h após último run, retorna `skipped: true` (a menos que `force=true`)
- [ ] Admin consegue alterar frequência para 12h no `E2eSchedulePanel` e o guard respeita
- [ ] Após 2 batches com score < 80%, `is_regression=true` aparece no terceiro batch
- [ ] `BatchHistoryPanel` lista batches com delta ▲/▼ vs batch anterior
- [ ] Batch com regressão exibe `RegressionBadge` vermelho com tooltip de contexto
- [ ] Botão "Re-testar" em batch com falhas executa apenas os cenários que falharam
- [ ] `E2eStatusCard` no dashboard exibe "Regressão" quando o último batch é regressão
- [ ] Alerta WhatsApp inclui "REGRESSÃO DETECTADA" com delta quando aplicável
- [ ] `npx tsc --noEmit` e `npm run build` passam sem erros

---

## Estimativa de Esforço (Claude execution time)

| Task | Estimativa |
|------|-----------|
| TASK 1 — Migration | 15 min |
| TASK 2 — e2e-scheduled | 35 min |
| TASK 3 — hook settings | 15 min |
| TASK 4 — hook batch history | 20 min |
| TASK 5 — E2eSchedulePanel | 30 min |
| TASK 6 — RegressionBadge + BatchHistoryPanel | 35 min |
| TASK 7 — Integração final | 40 min |
| **Total** | **~3.5h** |
