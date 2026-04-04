// Funções puras de cálculo de score do agente.
// Zero side effects, zero imports de React/Supabase/browser.

export interface E2eRunRaw {
  passed: boolean;
  tools_used: string[] | null;
  tools_missing: string[] | null;
  latency_ms: number | null;
  created_at: string;
}

export interface ValidationRaw {
  score: number; // 0-10
  created_at: string;
}

export interface ScoreBreakdown {
  e2ePassRate: number;     // 0-100, peso 40%
  validatorAvg: number;    // 0-100, peso 30%
  toolAccuracy: number;    // 0-100, peso 20%
  latencyScore: number;    // 0-100, peso 10%
  composite: number;       // 0-100, 1 casa decimal
  e2eRunCount: number;
  validationCount: number;
}

export interface DailyScore {
  date: string;            // "DD/MM" para label no gráfico
  score: number;           // 0-100 composite naquele dia
  e2ePassRate: number;
  validatorAvg: number;
}

export type ScoreTier = 'excellent' | 'good' | 'attention' | 'critical' | 'insufficient';

export function computeCompositeScore(
  e2eRuns: E2eRunRaw[],
  validations: ValidationRaw[]
): ScoreBreakdown {
  if (e2eRuns.length === 0 && validations.length === 0) {
    return {
      e2ePassRate: 0, validatorAvg: 0, toolAccuracy: 0, latencyScore: 0,
      composite: 0, e2eRunCount: 0, validationCount: 0,
    };
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

  // Latency Score (10%) — <3000ms=100, >10000ms=0
  const latencies = e2eRuns.filter(r => r.latency_ms && r.latency_ms > 0).map(r => r.latency_ms!);
  let latencyScore = 100;
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    latencyScore = Math.max(0, Math.min(100, 100 - Math.max(0, avgLatency - 3000) / 70));
  }

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

export function computeDailyScores(
  e2eRuns: E2eRunRaw[],
  validations: ValidationRaw[],
  days = 7
): DailyScore[] {
  const result: DailyScore[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - i);
    const dayStr = dayDate.toISOString().split('T')[0];
    const dayRuns = e2eRuns.filter(r => r.created_at.startsWith(dayStr));
    const dayValidations = validations.filter(v => v.created_at.startsWith(dayStr));
    const { composite, e2ePassRate, validatorAvg } = computeCompositeScore(dayRuns, dayValidations);
    const label = dayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    result.push({ date: label, score: composite, e2ePassRate, validatorAvg });
  }
  return result;
}

export function getScoreTier(score: number, hasData: boolean): ScoreTier {
  if (!hasData) return 'insufficient';
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'attention';
  return 'critical';
}

export function getScoreColor(tier: ScoreTier): string {
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
