---
phase: M2-F3-score-bar
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/agentScoring.ts
  - src/hooks/useAgentScore.ts
  - src/components/admin/ai-agent/AgentScoreBar.tsx
  - src/pages/dashboard/AIAgentPlayground.tsx
autonomous: false
requirements:
  - M2-F3
must_haves:
  truths:
    - "Barra de score exibe um número 0-100 com cor condizente (verde/azul/amarelo/vermelho)"
    - "Hover na barra mostra tooltip com os 4 sub-scores: E2E 40%, Validator 30%, Tools 20%, Latência 10%"
    - "Seta de tendência (↑↓→) indica se o score melhorou ou piorou na última semana"
    - "Gráfico de linha Recharts mostra evolução do score ao longo dos últimos 7 dias"
    - "Score aparece no header do Playground logo abaixo do nome do agente"
    - "Quando não há dados suficientes, exibe 'Dados insuficientes' e barra cinza"
  artifacts:
    - path: "src/lib/agentScoring.ts"
      provides: "Funções puras de cálculo — computeCompositeScore, computeDailyScores, getScoreColor"
      exports: ["computeCompositeScore", "computeDailyScores", "getScoreColor", "getScoreTier"]
    - path: "src/hooks/useAgentScore.ts"
      provides: "TanStack Query hook — fetch E2E + validator + computação client-side"
      exports: ["useAgentScore", "AgentScoreResult"]
    - path: "src/components/admin/ai-agent/AgentScoreBar.tsx"
      provides: "Componente visual: barra + número + seta de tendência + chart Recharts"
      min_lines: 120
  key_links:
    - from: "AgentScoreBar.tsx"
      to: "useAgentScore.ts"
      via: "const { score, breakdown, trend, dailyScores } = useAgentScore(agentId)"
      pattern: "useAgentScore"
    - from: "useAgentScore.ts"
      to: "agentScoring.ts"
      via: "computeCompositeScore(e2eRuns, validations)"
      pattern: "computeCompositeScore"
    - from: "AIAgentPlayground.tsx"
      to: "AgentScoreBar.tsx"
      via: "renderizado no header abaixo da linha de sessão"
      pattern: "AgentScoreBar"
---

<objective>
Implementar a Barra de Evolução do Agente — um score composto 0-100 que agrega E2E pass rate,
Validator avg score, Tool accuracy e Latência em um único indicador de saúde do agente.

Purpose: Dar ao admin uma resposta imediata a "meu agente está melhorando ou piorando?"
sem precisar olhar 3 métricas separadas.

Output:
- src/lib/agentScoring.ts — funções puras de cálculo (fácil de testar)
- src/hooks/useAgentScore.ts — TanStack Query hook que busca dados e chama agentScoring
- src/components/admin/ai-agent/AgentScoreBar.tsx — componente visual completo
- Modificação em AIAgentPlayground.tsx para renderizar a barra no header

Fórmula implementada:
  Score = (0.4 × E2E_Pass_Rate) + (0.3 × Validator_Avg_Normalized) + (0.2 × Tool_Accuracy) + (0.1 × Latency_Score)
  Onde:
    E2E_Pass_Rate         = (runs passados / total runs) × 100  [últimos 7 dias]
    Validator_Avg_Normalized = avg(score) × 10                  [últimos 7 dias, 0-10 → 0-100]
    Tool_Accuracy         = (1 - total_tools_missing / total_expected_tools) × 100  [últimos 7 dias]
    Latency_Score         = max(0, 100 - max(0, avg_latency_ms - 3000) / 70)  [<3s=100, >10s=0]
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/research/RESEARCH-qa-framework.md
@.planning/codebase/validator-metrics.md

<interfaces>
<!-- Dados disponíveis para o score — extraídos diretamente das tabelas existentes. -->

Tabela e2e_test_runs (colunas necessárias):
```typescript
// Query: SELECT passed, tools_used, tools_missing, latency_ms, created_at
// WHERE agent_id = $1 AND created_at >= now() - interval '7 days'
{
  passed: boolean
  tools_used: string[] | null
  tools_missing: string[] | null
  latency_ms: number | null
  created_at: string
}
```

Tabela ai_agent_validations (colunas necessárias):
```typescript
// Query: SELECT score, created_at
// WHERE agent_id = $1 AND created_at >= now() - interval '7 days'
{
  score: number   // 0-10
  created_at: string
}
```

Recharts — já usado no projeto (MetricsConfig.tsx usa BarChart, ResponsiveContainer).
Pattern de uso existente em MetricsConfig.tsx:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
// Para score history usar LineChart ao invés de BarChart
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
```

shadcn/ui disponíveis:
- Progress (para a barra horizontal)
- Tooltip, TooltipContent, TooltipTrigger, TooltipProvider
- Card, CardContent, CardHeader, CardTitle

Lucide icons:
- TrendingUp, TrendingDown, Minus (para seta de tendência)
- Activity (ícone de score)

Padrão de cor do projeto (Tailwind):
- Emerald/green: score >= 90
- Blue: score >= 70
- Amber/yellow: score >= 50
- Red: score < 50

Do AIAgentPlayground.tsx, linha do header onde inserir o score (~linhas 300-318):
```tsx
<div className="flex items-center gap-3">
  <div className="h-10 w-10 rounded-xl ..."><Sparkles /></div>
  <div>
    <h1>Playground IA</h1>
    <p className="text-xs text-muted-foreground">8 tools · debug · cenarios · sessao {sessionId}</p>
  </div>
</div>
// ← INSERIR AgentScoreBar aqui, entre o título e os botões direitos
```
</interfaces>
</context>

## O QUE NÃO ALTERAR

- `src/components/admin/ai-agent/ValidatorMetrics.tsx` — não tocar (componente existente na tab Métricas)
- `src/components/admin/ai-agent/MetricsConfig.tsx` — não tocar
- `src/types/playground.ts` — não adicionar tipos aqui
- `supabase/functions/` — nenhuma edge function nova (score é client-side)
- `src/integrations/supabase/types.ts` — não editar manualmente
- A lógica de execução E2E em AIAgentPlayground.tsx — não alterar
- PlaygroundE2eTab, PlaygroundScenariosTab, PlaygroundManualTab, PlaygroundResultsTab — não tocar

## DECISÃO: Compute client-side, NÃO criar RPC PostgreSQL

Volumes são pequenos (máx ~2000 validações + ~50 runs em 7 dias). RPC adicionaria migration +
mais complexidade de deploy. Client-side é suficiente e mais fácil de iterar.

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: agentScoring.ts — funções puras de cálculo do score composto</name>
  <files>src/lib/agentScoring.ts</files>
  <action>
Criar módulo de funções puras (zero side effects, zero imports de React/Supabase).

**Tipos:**
```typescript
export interface E2eRunRaw {
  passed: boolean;
  tools_used: string[] | null;
  tools_missing: string[] | null;
  latency_ms: number | null;
  created_at: string;
}

export interface ValidationRaw {
  score: number;   // 0-10
  created_at: string;
}

export interface ScoreBreakdown {
  e2ePassRate: number;       // 0-100, peso 40%
  validatorAvg: number;      // 0-100, peso 30%
  toolAccuracy: number;      // 0-100, peso 20%
  latencyScore: number;      // 0-100, peso 10%
  composite: number;         // 0-100, arredondado para 1 casa decimal
  e2eRunCount: number;       // quantos runs usados no cálculo
  validationCount: number;   // quantas validações usadas
}

export interface DailyScore {
  date: string;              // "DD/MM" para label no gráfico
  score: number;             // 0-100 composite naquele dia
  e2ePassRate: number;
  validatorAvg: number;
}

export type ScoreTier = 'excellent' | 'good' | 'attention' | 'critical' | 'insufficient';
```

**Função principal:**
```typescript
export function computeCompositeScore(
  e2eRuns: E2eRunRaw[],
  validations: ValidationRaw[]
): ScoreBreakdown {
  // Guard: dados insuficientes → retorna score 0 com flags
  if (e2eRuns.length === 0 && validations.length === 0) {
    return { e2ePassRate: 0, validatorAvg: 0, toolAccuracy: 0, latencyScore: 0, composite: 0, e2eRunCount: 0, validationCount: 0 };
  }

  // E2E Pass Rate (40%)
  const e2ePassRate = e2eRuns.length > 0
    ? (e2eRuns.filter(r => r.passed).length / e2eRuns.length) * 100
    : 0;

  // Validator Avg Normalized (30%) — avg(score 0-10) × 10 → 0-100
  const validatorAvg = validations.length > 0
    ? (validations.reduce((sum, v) => sum + v.score, 0) / validations.length) * 10
    : 0;

  // Tool Accuracy (20%)
  // total_expected = runs com tools_missing não-null
  // total_missing = soma de tools_missing.length
  // total_used = soma de tools_used.length
  // accuracy = 1 - (total_missing / (total_missing + soma de tools usadas corretamente))
  // Simplificação: se tools_missing existe e tem itens, é uma "miss" proporcional
  const runsWithToolData = e2eRuns.filter(r => r.tools_missing !== null);
  let toolAccuracy = 100;
  if (runsWithToolData.length > 0) {
    const totalMissing = runsWithToolData.reduce((sum, r) => sum + (r.tools_missing?.length ?? 0), 0);
    const totalUsed = runsWithToolData.reduce((sum, r) => sum + (r.tools_used?.length ?? 0), 0);
    const totalExpected = totalMissing + totalUsed;
    toolAccuracy = totalExpected > 0
      ? Math.max(0, (1 - totalMissing / totalExpected) * 100)
      : 100;
  }

  // Latency Score (10%)
  // <3000ms = 100, >10000ms = 0, linear entre os dois
  const latencies = e2eRuns.filter(r => r.latency_ms && r.latency_ms > 0).map(r => r.latency_ms!);
  let latencyScore = 100;
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    // Fórmula: max(0, 100 - max(0, avgLatency - 3000) / 70)
    // 3000ms → 100, 10000ms → 100 - 7000/70 = 0
    latencyScore = Math.max(0, Math.min(100, 100 - Math.max(0, avgLatency - 3000) / 70));
  }

  // Composite
  const composite = Math.round(
    (e2ePassRate * 0.4 + validatorAvg * 0.3 + toolAccuracy * 0.2 + latencyScore * 0.1) * 10
  ) / 10;

  return {
    e2ePassRate: Math.round(e2ePassRate * 10) / 10,
    validatorAvg: Math.round(validatorAvg * 10) / 10,
    toolAccuracy: Math.round(toolAccuracy * 10) / 10,
    latencyScore: Math.round(latencyScore * 10) / 10,
    composite,
    e2eRunCount: e2eRuns.length,
    validationCount: validations.length,
  };
}
```

**Função de scores diários** (para o gráfico de linha):
```typescript
export function computeDailyScores(
  e2eRuns: E2eRunRaw[],
  validations: ValidationRaw[],
  days = 7
): DailyScore[] {
  // Gera array de 'days' dias (mais antigo → mais recente)
  // Para cada dia, filtra e2eRuns e validations por DATE(created_at)
  // Computa composite para aquele dia
  // Retorna DailyScore[] mesmo que um dia não tenha dados (score=0)
  const result: DailyScore[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - i);
    const dayStr = dayDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const dayRuns = e2eRuns.filter(r => r.created_at.startsWith(dayStr));
    const dayValidations = validations.filter(v => v.created_at.startsWith(dayStr));
    const { composite, e2ePassRate, validatorAvg } = computeCompositeScore(dayRuns, dayValidations);
    const label = dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    result.push({ date: label, score: composite, e2ePassRate, validatorAvg });
  }
  return result;
}
```

**Funções auxiliares:**
```typescript
export function getScoreTier(score: number, hasData: boolean): ScoreTier {
  if (!hasData) return 'insufficient';
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'attention';
  return 'critical';
}

export function getScoreColor(tier: ScoreTier): string {
  // Retorna classes Tailwind para texto
  const map: Record<ScoreTier, string> = {
    excellent: 'text-emerald-400',
    good: 'text-blue-400',
    attention: 'text-amber-400',
    critical: 'text-red-400',
    insufficient: 'text-muted-foreground',
  };
  return map[tier];
}

export function getScoreBarColor(tier: ScoreTier): string {
  // Retorna classes Tailwind para fundo da barra Progress (indicator)
  const map: Record<ScoreTier, string> = {
    excellent: '[&>div]:bg-emerald-500',
    good: '[&>div]:bg-blue-500',
    attention: '[&>div]:bg-amber-500',
    critical: '[&>div]:bg-red-500',
    insufficient: '[&>div]:bg-muted',
  };
  return map[tier];
}

export function getScoreTrend(dailyScores: DailyScore[]): 'up' | 'down' | 'stable' {
  // Compara média dos últimos 3 dias com média dos 3 dias anteriores
  if (dailyScores.length < 4) return 'stable';
  const recent = dailyScores.slice(-3).map(d => d.score);
  const previous = dailyScores.slice(-6, -3).map(d => d.score);
  if (previous.length === 0) return 'stable';
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
  const delta = recentAvg - previousAvg;
  if (delta > 3) return 'up';
  if (delta < -3) return 'down';
  return 'stable';
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep "agentScoring" | head -10</automated>
  </verify>
  <done>
    - src/lib/agentScoring.ts criado sem erros TypeScript
    - Exporta computeCompositeScore, computeDailyScores, getScoreTier, getScoreColor, getScoreBarColor, getScoreTrend
    - Nenhum import de React, Supabase ou browser APIs (funções 100% puras)
    - Boundary cases tratados: arrays vazios retornam score 0 sem exceptions
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: useAgentScore.ts — hook TanStack Query que busca e computa o score</name>
  <files>src/hooks/useAgentScore.ts</files>
  <action>
Criar hook TanStack Query que busca os dados brutos das duas tabelas e chama agentScoring.ts.

```typescript
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  computeCompositeScore, computeDailyScores, getScoreTier, getScoreTrend,
  type ScoreBreakdown, type DailyScore, type ScoreTier,
} from '@/lib/agentScoring';

export interface AgentScoreResult {
  breakdown: ScoreBreakdown;
  tier: ScoreTier;
  dailyScores: DailyScore[];
  trend: 'up' | 'down' | 'stable';
  hasData: boolean;
  isLoading: boolean;
}

export function useAgentScore(agentId: string | null, days = 7): AgentScoreResult {
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  // Query 1: E2E runs dos últimos N dias
  const { data: e2eRuns = [], isLoading: loadingE2e } = useQuery({
    queryKey: ['agent-score-e2e', agentId, days],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('e2e_test_runs')
        .select('passed, tools_used, tools_missing, latency_ms, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,  // 5 min — score não precisa de tempo real
    gcTime: 10 * 60 * 1000,
  });

  // Query 2: Validações dos últimos N dias
  const { data: validations = [], isLoading: loadingValidations } = useQuery({
    queryKey: ['agent-score-validations', agentId, days],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('ai_agent_validations')
        .select('score, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Computar score client-side (memoizado)
  const breakdown = useMemo(
    () => computeCompositeScore(e2eRuns, validations),
    [e2eRuns, validations]
  );

  const dailyScores = useMemo(
    () => computeDailyScores(e2eRuns, validations, days),
    [e2eRuns, validations, days]
  );

  const hasData = e2eRuns.length > 0 || validations.length > 0;
  const tier = getScoreTier(breakdown.composite, hasData);
  const trend = getScoreTrend(dailyScores);
  const isLoading = loadingE2e || loadingValidations;

  return { breakdown, tier, dailyScores, trend, hasData, isLoading };
}
```

CUIDADO: staleTime de 5 minutos é intencional — o score não muda em tempo real e
queries frequentes às duas tabelas causariam carga desnecessária.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep "useAgentScore" | head -10</automated>
  </verify>
  <done>
    - src/hooks/useAgentScore.ts criado sem erros TypeScript
    - Exporta useAgentScore e AgentScoreResult
    - Duas queries separadas (e2e_test_runs + ai_agent_validations) com staleTime 5min
    - useMemo evita recomputação a cada render
    - hasData=false quando ambas as queries retornam vazio
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: AgentScoreBar.tsx — componente visual com barra, tooltip, gráfico e tendência</name>
  <files>
    src/components/admin/ai-agent/AgentScoreBar.tsx,
    src/pages/dashboard/AIAgentPlayground.tsx
  </files>
  <action>
**AgentScoreBar.tsx** — componente compacto para o header do Playground:

Props:
```typescript
interface AgentScoreBarProps {
  agentId: string | null;
  compact?: boolean;  // true = modo header (compacto), false = modo metricas (expandido com chart)
}
```

Layout modo compacto (compact=true, padrão para header):
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="flex items-center gap-2 cursor-help">
        {/* Score number */}
        <span className={cn("text-sm font-bold tabular-nums", getScoreColor(tier))}>
          {hasData ? `${breakdown.composite}` : '—'}
        </span>
        {/* Progress bar — 80px wide */}
        <div className="w-20">
          <Progress
            value={hasData ? breakdown.composite : 0}
            className={cn("h-1.5", getScoreBarColor(tier))}
          />
        </div>
        {/* Trend arrow */}
        {hasData && (
          trend === 'up'     ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
          trend === 'down'   ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> :
                               <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="w-[260px] p-3">
      {!hasData ? (
        <p className="text-xs text-muted-foreground">Sem dados nos últimos 7 dias</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold mb-2">Score Composto — últimos 7 dias</p>
          {/* 4 sub-scores */}
          <div className="space-y-1.5">
            <ScoreRow label="E2E Pass Rate" value={breakdown.e2ePassRate} weight="40%" count={`${breakdown.e2eRunCount} runs`} />
            <ScoreRow label="Validator Avg" value={breakdown.validatorAvg} weight="30%" count={`${breakdown.validationCount} msgs`} />
            <ScoreRow label="Tool Accuracy" value={breakdown.toolAccuracy} weight="20%" />
            <ScoreRow label="Latência" value={breakdown.latencyScore} weight="10%" />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Score Final</span>
            <span className={cn("text-sm font-bold", getScoreColor(tier))}>
              {breakdown.composite}/100
            </span>
          </div>
        </div>
      )}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Componente interno ScoreRow (não exportado):
```tsx
function ScoreRow({ label, value, weight, count }: { label: string; value: number; weight: string; count?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label} ({weight})</span>
      <Progress value={value} className="h-1 flex-1" />
      <span className="text-[10px] font-mono w-8 text-right">{Math.round(value)}</span>
      {count && <span className="text-[10px] text-muted-foreground">{count}</span>}
    </div>
  );
}
```

Layout modo expandido (compact=false, para uso futuro na tab Métricas):
Igual ao compacto, mas adiciona o gráfico de linha Recharts abaixo:
```tsx
{!compact && hasData && dailyScores.length > 0 && (
  <div className="mt-4">
    <p className="text-xs text-muted-foreground mb-2">Evolução — 7 dias</p>
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={dailyScores} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
        <RechartsTooltip
          formatter={(value: number) => [`${value}`, 'Score']}
          contentStyle={{ fontSize: 11 }}
        />
        <ReferenceLine y={70} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.5} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: '#6366f1' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```

Imports do Recharts: `import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';`

---

**AIAgentPlayground.tsx — mudanças:**

1. Importar AgentScoreBar:
```typescript
import { AgentScoreBar } from '@/components/admin/ai-agent/AgentScoreBar';
```

2. No header, inserir AgentScoreBar ENTRE o bloco do título e o bloco dos botões direitos.
Linha atual ~299 (bloco flex items-center justify-between):
```tsx
<div className="flex items-center justify-between gap-3 flex-shrink-0">
  {/* Título existente — NÃO ALTERAR */}
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 ..."><Sparkles /></div>
    <div>
      <h1 className="text-xl font-bold">Playground IA</h1>
      <p className="text-xs text-muted-foreground">...</p>
    </div>
  </div>

  {/* INSERIR AQUI — score compacto */}
  {selectedAgentId && (
    <AgentScoreBar agentId={selectedAgentId} compact={true} />
  )}

  {/* Botões direitos — NÃO ALTERAR */}
  <div className="flex items-center gap-1.5">
    ...
  </div>
</div>
```

NÃO remover nenhum dos botões existentes (Settings, Download, Play, Reset).
NÃO alterar a lógica de E2E, batch, ou sessions.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep "error TS" | grep -v "node_modules" | head -30</automated>
  </verify>
  <done>
    - AgentScoreBar.tsx criado sem erros TypeScript
    - Modo compact=true renderiza: número + barra 80px + seta de tendência
    - Tooltip exibe 4 sub-scores com barras individuais e pesos
    - Modo compact=false inclui LineChart Recharts com 7 dias
    - AIAgentPlayground.tsx importa e renderiza AgentScoreBar no header
    - Zero erros TypeScript
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Score composto completo:
    - agentScoring.ts com fórmula (E2E 40% + Validator 30% + Tools 20% + Latência 10%)
    - useAgentScore.ts com dois fetches TanStack Query + memoização
    - AgentScoreBar.tsx com barra colorida, número, seta de tendência, tooltip de breakdown
    - Integrado no header do Playground
  </what-built>
  <how-to-verify>
    1. Acesse /dashboard/playground como super_admin
    2. CENÁRIO A — Agente com dados:
       a. Selecione um agente que já tenha runs E2E e/ou validações dos últimos 7 dias
       b. No header do Playground, deve aparecer: número (ex: "73.5") + barra colorida + seta
       c. Passe o mouse sobre a barra → tooltip deve mostrar os 4 sub-scores com percentuais
       d. Sub-score E2E deve refletir o pass rate real dos runs
       e. Sub-score Validator deve refletir o avg score × 10
    3. CENÁRIO B — Agente sem dados:
       a. Selecione agente sem runs nos últimos 7 dias
       b. Header deve mostrar "—" com barra cinza (sem erro)
       c. Tooltip deve mostrar "Sem dados nos últimos 7 dias"
    4. CENÁRIO C — Verificação de cor:
       a. Score >= 90 → número e barra em verde (emerald)
       b. Score 70-89 → azul
       c. Score 50-69 → amarelo (amber)
       d. Score < 50 → vermelho
    5. No DevTools Network: confirmar que as queries não chamam mais que 1x a cada 5 minutos
       (staleTime deve evitar refetch desnecessário)
    6. Build de produção não quebra:
       npm run build (deve completar sem erros)
  </how-to-verify>
  <resume-signal>Digite "aprovado" se tudo funcionar, ou descreva os problemas encontrados</resume-signal>
</task>

</tasks>

<verification>
Verificação final:

```bash
# TypeScript sem erros
npx tsc --noEmit --project c:/Projetos/Claude/WhatsPRO/tsconfig.json 2>&1 | grep "error TS" | grep -v "node_modules"

# Arquivos criados
ls c:/Projetos/Claude/WhatsPRO/src/lib/agentScoring.ts
ls c:/Projetos/Claude/WhatsPRO/src/hooks/useAgentScore.ts
ls c:/Projetos/Claude/WhatsPRO/src/components/admin/ai-agent/AgentScoreBar.tsx

# Build de produção
cd c:/Projetos/Claude/WhatsPRO && npm run build 2>&1 | tail -20
```

Verificações manuais de cálculo (console do browser com dados reais):
- Se 10 de 10 runs passaram → E2E = 100 → contribuição = 40pts
- Se avg validator = 8.5 → Validator = 85 → contribuição = 25.5pts
- Se tools_missing=0 em todos → Tools = 100 → contribuição = 20pts
- Se avg latência = 5000ms → Latency = max(0, 100 - 2000/70) ≈ 71 → contribuição = 7.1pts
- Score total esperado ≈ 92.6
</verification>

<success_criteria>
- [ ] agentScoring.ts exporta 6 funções puras sem side effects
- [ ] computeCompositeScore retorna breakdown correto para arrays vazios (score=0, sem exceptions)
- [ ] computeDailyScores retorna 7 entradas mesmo quando dias sem dados (score=0)
- [ ] getScoreTrend retorna 'stable' quando há < 4 dias de dados
- [ ] useAgentScore queries e2e_test_runs e ai_agent_validations com staleTime=5min
- [ ] Score é recomputado apenas quando dados mudam (useMemo)
- [ ] AgentScoreBar renderiza barra colorida com número no header do Playground
- [ ] Tooltip mostra 4 sub-scores quando hover
- [ ] Seta de tendência: TrendingUp verde / TrendingDown vermelho / Minus cinza
- [ ] Modo compact=false inclui LineChart de 7 dias
- [ ] Estado "sem dados" não causa crash — exibe "—" e barra cinza
- [ ] Zero erros TypeScript
- [ ] npm run build passa
- [ ] Checkpoint humano aprovado
</success_criteria>

<output>
Após conclusão, criar `.planning/phases/M2-F3-score-bar/M2-F3-01-SUMMARY.md` com:
- Arquivos criados/modificados
- Calibração da fórmula com dados reais (scores observados no teste)
- Decisões tomadas (ex: se precisou ajustar thresholds de latência)
- Qualquer divergência do plano e por quê
</output>
