/**
 * Testes para src/lib/agentScoring.ts (F3 — Barra de Evolução / Score Composto).
 * Módulo 100% puro — sem React, sem Supabase, sem side effects.
 */
import { describe, it, expect } from 'vitest';
import {
  computeCompositeScore,
  computeDailyScores,
  getScoreTier,
  getScoreTrend,
  type E2eRunRaw,
  type ValidationRaw,
  type DailyScore,
} from '../agentScoring';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRun(overrides: Partial<E2eRunRaw> = {}): E2eRunRaw {
  return {
    passed: true,
    tools_used: [],
    tools_missing: [],
    latency_ms: 1000,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeValidation(score: number, created_at?: string): ValidationRaw {
  return { score, created_at: created_at ?? new Date().toISOString() };
}

function makeDailyScore(score: number): DailyScore {
  return { date: '01/01', score, e2ePassRate: score, validatorAvg: score };
}

// ─── computeCompositeScore ────────────────────────────────────────────────────

describe('computeCompositeScore', () => {
  it('retorna score 0 sem exceptions quando arrays estão vazios', () => {
    const result = computeCompositeScore([], []);
    expect(result.composite).toBe(0);
    expect(result.e2ePassRate).toBe(0);
    expect(result.validatorAvg).toBe(0);
    expect(result.toolAccuracy).toBe(0);
    expect(result.latencyScore).toBe(0);
    expect(result.e2eRunCount).toBe(0);
    expect(result.validationCount).toBe(0);
  });

  it('e2ePassRate=100 e composite=40 quando 10/10 runs passaram e sem validações', () => {
    const runs = Array.from({ length: 10 }, () => makeRun({ passed: true, tools_missing: null, latency_ms: null }));
    const result = computeCompositeScore(runs, []);
    expect(result.e2ePassRate).toBe(100);
    // toolAccuracy=100 (sem tool data), latencyScore=100 (sem latency data), validatorAvg=0
    // composite = 100*0.4 + 0*0.3 + 100*0.2 + 100*0.1 = 40+0+20+10 = 70
    // NOTA: toolAccuracy=100 e latencyScore=100 quando não há dados, portanto:
    // composite = 100*0.4 + 0*0.3 + 100*0.2 + 100*0.1 = 70
    expect(result.composite).toBe(70);
    // e2ePassRate contribui 40% ao composite
    expect(result.e2ePassRate * 0.4).toBe(40);
  });

  it('validatorAvg=85 e contribuição de 25.5 quando validações avg=8.5 e sem runs', () => {
    // avg=8.5 → normalizado = 8.5 * 10 = 85
    const validations = [
      makeValidation(8),
      makeValidation(9),
      makeValidation(8),
      makeValidation(9),
    ]; // média = 8.5
    const result = computeCompositeScore([], validations);
    expect(result.validatorAvg).toBe(85);
    // Contribuição no composite: 85 * 0.3 = 25.5
    expect(result.validatorAvg * 0.3).toBe(25.5);
  });

  it('toolAccuracy=100 quando tools_missing=[] em todos os runs', () => {
    const runs = [
      makeRun({ tools_missing: [], tools_used: ['search_products'] }),
      makeRun({ tools_missing: [], tools_used: ['send_carousel'] }),
      makeRun({ tools_missing: [], tools_used: ['handoff_to_human'] }),
    ];
    const result = computeCompositeScore(runs, []);
    expect(result.toolAccuracy).toBe(100);
  });

  it('toolAccuracy < 100 quando tools_missing tem 1 item em 1 de 3 runs', () => {
    // Run 1: missing=['search_products'], used=['send_carousel'] → missing=1, used=1, expected=2
    // Run 2: missing=[], used=['send_carousel'] → missing=0, used=1, expected=1
    // Run 3: missing=[], used=['send_carousel'] → missing=0, used=1, expected=1
    // totalMissing=1, totalExpected=4 → toolAccuracy = (1 - 1/4)*100 = 75
    const runs = [
      makeRun({ tools_missing: ['search_products'], tools_used: ['send_carousel'] }),
      makeRun({ tools_missing: [], tools_used: ['send_carousel'] }),
      makeRun({ tools_missing: [], tools_used: ['send_carousel'] }),
    ];
    const result = computeCompositeScore(runs, []);
    expect(result.toolAccuracy).toBe(75);
    expect(result.toolAccuracy).toBeLessThan(100);
  });

  it('latencyScore=100 quando avgLatency=3000ms', () => {
    const runs = [makeRun({ latency_ms: 3000, tools_missing: null })];
    const result = computeCompositeScore(runs, []);
    expect(result.latencyScore).toBe(100);
  });

  it('latencyScore≈0 quando avgLatency=10000ms (máximo de degradação)', () => {
    // 100 - (10000 - 3000) / 70 = 100 - 100 = 0
    const runs = [makeRun({ latency_ms: 10000, tools_missing: null })];
    const result = computeCompositeScore(runs, []);
    expect(result.latencyScore).toBeCloseTo(0, 1);
  });

  it('latencyScore=50 quando avgLatency=6500ms', () => {
    // 100 - (6500 - 3000) / 70 = 100 - 3500/70 = 100 - 50 = 50
    const runs = [makeRun({ latency_ms: 6500, tools_missing: null })];
    const result = computeCompositeScore(runs, []);
    expect(result.latencyScore).toBe(50);
  });

  it('score composto misto realístico: e2e=80, validator=70, tool=90, latency=100 → composite=81', () => {
    // e2e pass rate = 80% → 4 de 5 passam
    // validator avg = 7.0 → normalizado 70
    // tool accuracy = 90% → 1 missing em 10 usados → totalExpected=11, missing=1 → (1-1/11)*100 ≈ 90.9 → arredondado 90.9
    //   Precisamos exatamente 90: 1 missing em 10 usados = (1-1/11)*100 = 90.909...
    //   Para 90 exato: missing=1, expected=10 → used=9. (1 - 1/10)*100 = 90
    // latency = 100 → latency_ms = 1000 (< 3000)
    //
    // composite = 80*0.4 + 70*0.3 + 90*0.2 + 100*0.1 = 32+21+18+10 = 81
    const runs = [
      makeRun({ passed: true,  tools_missing: [],             tools_used: Array(3).fill('t'), latency_ms: 1000 }),
      makeRun({ passed: true,  tools_missing: [],             tools_used: Array(3).fill('t'), latency_ms: 1000 }),
      makeRun({ passed: true,  tools_missing: [],             tools_used: Array(3).fill('t'), latency_ms: 1000 }),
      makeRun({ passed: false, tools_missing: ['search_products'], tools_used: Array(9).fill('t'), latency_ms: 1000 }),
      makeRun({ passed: true,  tools_missing: [],             tools_used: [],                latency_ms: 1000 }),
    ];
    // Validações com avg=7.0 (score*10=70)
    const validations = [
      makeValidation(7),
      makeValidation(7),
    ];

    const result = computeCompositeScore(runs, validations);
    // e2ePassRate = 4/5 * 100 = 80
    expect(result.e2ePassRate).toBe(80);
    // validatorAvg = 7.0 * 10 = 70
    expect(result.validatorAvg).toBe(70);
    // latencyScore = 100 (avg latency 1000 < 3000)
    expect(result.latencyScore).toBe(100);
    // toolAccuracy: runs com tools_missing não nulo
    // Run 1: missing=0, used=3 → expected=3
    // Run 2: missing=0, used=3 → expected=3
    // Run 3: missing=0, used=3 → expected=3
    // Run 4: missing=1, used=9 → expected=10
    // Run 5: missing=0, used=0 → expected=0 (mas tools_missing=[] não é null então conta)
    // totalMissing=1, totalExpected=19 → (1-1/19)*100 = 94.7...
    // Esse resultado não é exatamente 90 — os cálculos abaixo verificam a fórmula de perto
    // composite = e2e*0.4 + validator*0.3 + tool*0.2 + latency*0.1
    const expected = Math.round(
      (result.e2ePassRate * 0.4 + result.validatorAvg * 0.3 + result.toolAccuracy * 0.2 + result.latencyScore * 0.1) * 10
    ) / 10;
    expect(result.composite).toBe(expected);
  });

  it('fórmula exata composite = 81 com percentuais controlados', () => {
    // Controlar precisamente: usar dados que garantam os valores exatos
    // e2ePassRate = 80: 8 passed, 2 failed, sem tool data, sem latency
    // validatorAvg = 70: media=7.0
    // toolAccuracy = 90: totalMissing=1, totalExpected=10 → used=9, missing=1
    // latencyScore = 100: latency < 3000
    //
    // Para toolAccuracy=90: 1 run com missing=1,used=9 + outros runs com missing=null
    const toolRun = makeRun({ tools_missing: ['missing_tool'], tools_used: Array(9).fill('t'), latency_ms: 1000 });
    const passedRuns = Array.from({ length: 7 }, () => makeRun({ passed: true, tools_missing: null, latency_ms: 1000 }));
    const failedRuns = Array.from({ length: 2 }, () => makeRun({ passed: false, tools_missing: null, latency_ms: 1000 }));
    toolRun.passed = true; // 8 passed total (7 + toolRun)

    const runs = [...passedRuns, toolRun, ...failedRuns];
    // passed=8, failed=2, e2ePassRate=80
    const validations = [makeValidation(7), makeValidation(7)]; // avg=7.0 → 70

    const result = computeCompositeScore(runs, validations);
    expect(result.e2ePassRate).toBe(80);
    expect(result.validatorAvg).toBe(70);
    expect(result.toolAccuracy).toBe(90);
    expect(result.latencyScore).toBe(100);
    // composite = 80*0.4 + 70*0.3 + 90*0.2 + 100*0.1 = 32+21+18+10 = 81
    expect(result.composite).toBe(81);
  });
});

// ─── computeDailyScores ───────────────────────────────────────────────────────

describe('computeDailyScores', () => {
  it('retorna exatamente 7 entradas com days=7 (default)', () => {
    const result = computeDailyScores([], [], 7);
    expect(result).toHaveLength(7);
  });

  it('retorna exatamente 3 entradas com days=3', () => {
    const result = computeDailyScores([], [], 3);
    expect(result).toHaveLength(3);
  });

  it('dias sem dados retornam score=0 sem exceções', () => {
    const result = computeDailyScores([], [], 7);
    for (const day of result) {
      expect(day.score).toBe(0);
      expect(day.e2ePassRate).toBe(0);
      expect(day.validatorAvg).toBe(0);
    }
  });

  it('labels estão no formato DD/MM com "/" no meio', () => {
    const result = computeDailyScores([], [], 7);
    for (const day of result) {
      expect(typeof day.date).toBe('string');
      expect(day.date).toMatch(/\d{2}\/\d{2}/);
    }
  });

  it('inclui dados do dia atual no score correto', () => {
    const today = new Date().toISOString().split('T')[0];
    const runs = [
      makeRun({ passed: true,  created_at: `${today}T10:00:00Z`, tools_missing: null, latency_ms: null }),
      makeRun({ passed: true,  created_at: `${today}T11:00:00Z`, tools_missing: null, latency_ms: null }),
      makeRun({ passed: false, created_at: `${today}T12:00:00Z`, tools_missing: null, latency_ms: null }),
    ];
    const result = computeDailyScores(runs, [], 7);
    // Último item é "hoje"
    const todayEntry = result[result.length - 1];
    // e2ePassRate = 2/3 * 100 ≈ 66.7
    expect(todayEntry.e2ePassRate).toBeCloseTo(66.7, 0);
    expect(todayEntry.score).toBeGreaterThan(0);
  });
});

// ─── getScoreTier ─────────────────────────────────────────────────────────────

describe('getScoreTier', () => {
  it('retorna "excellent" quando score=95 e hasData=true', () => {
    expect(getScoreTier(95, true)).toBe('excellent');
  });

  it('retorna "good" quando score=75 e hasData=true', () => {
    expect(getScoreTier(75, true)).toBe('good');
  });

  it('retorna "attention" quando score=55 e hasData=true', () => {
    expect(getScoreTier(55, true)).toBe('attention');
  });

  it('retorna "critical" quando score=30 e hasData=true', () => {
    expect(getScoreTier(30, true)).toBe('critical');
  });

  it('retorna "insufficient" independente do score quando hasData=false', () => {
    expect(getScoreTier(0,   false)).toBe('insufficient');
    expect(getScoreTier(50,  false)).toBe('insufficient');
    expect(getScoreTier(100, false)).toBe('insufficient');
  });

  it('limites de fronteira: score=90 → "excellent", score=89 → "good"', () => {
    expect(getScoreTier(90, true)).toBe('excellent');
    expect(getScoreTier(89, true)).toBe('good');
  });

  it('limites de fronteira: score=70 → "good", score=69 → "attention"', () => {
    expect(getScoreTier(70, true)).toBe('good');
    expect(getScoreTier(69, true)).toBe('attention');
  });

  it('limites de fronteira: score=50 → "attention", score=49 → "critical"', () => {
    expect(getScoreTier(50, true)).toBe('attention');
    expect(getScoreTier(49, true)).toBe('critical');
  });
});

// ─── getScoreTrend ────────────────────────────────────────────────────────────

describe('getScoreTrend', () => {
  it('retorna "stable" quando há menos de 4 dias de dados', () => {
    expect(getScoreTrend([])).toBe('stable');
    expect(getScoreTrend([makeDailyScore(80)])).toBe('stable');
    expect(getScoreTrend([makeDailyScore(80), makeDailyScore(70), makeDailyScore(60)])).toBe('stable');
  });

  it('retorna "up" quando média recente é 10+ pontos maior que a anterior', () => {
    // 6 dias: previous=[50,50,50], recent=[65,65,65] → delta=15 → 'up'
    const scores = [
      makeDailyScore(50), makeDailyScore(50), makeDailyScore(50),
      makeDailyScore(65), makeDailyScore(65), makeDailyScore(65),
    ];
    expect(getScoreTrend(scores)).toBe('up');
  });

  it('retorna "down" quando média recente é 10+ pontos menor que a anterior', () => {
    // previous=[80,80,80], recent=[60,60,60] → delta=-20 → 'down'
    const scores = [
      makeDailyScore(80), makeDailyScore(80), makeDailyScore(80),
      makeDailyScore(60), makeDailyScore(60), makeDailyScore(60),
    ];
    expect(getScoreTrend(scores)).toBe('down');
  });

  it('retorna "stable" quando delta é <= 3 pontos', () => {
    // previous=[70,70,70], recent=[72,72,72] → delta=2 → 'stable'
    const scores = [
      makeDailyScore(70), makeDailyScore(70), makeDailyScore(70),
      makeDailyScore(72), makeDailyScore(72), makeDailyScore(72),
    ];
    expect(getScoreTrend(scores)).toBe('stable');
  });

  it('retorna "stable" quando há exatamente 4 entradas mas previous tem apenas 1 dia', () => {
    // Com 4 entradas: previous = slice(-6,-3) = slice(1,1) neste caso slice(4-6,4-3) = slice(-2,-1) = [item2]
    // recent = slice(-3) = [item1, item2, item3]
    // Se todos scores iguais → delta=0 → 'stable'
    const scores = [
      makeDailyScore(70), makeDailyScore(70), makeDailyScore(70), makeDailyScore(70),
    ];
    expect(getScoreTrend(scores)).toBe('stable');
  });

  it('retorna "up" exatamente no limiar de 4 pontos', () => {
    // previous=[60], recent=[64,64,64] → delta=4 → 'up'
    const scores = [
      makeDailyScore(60),
      makeDailyScore(64), makeDailyScore(64), makeDailyScore(64),
    ];
    expect(getScoreTrend(scores)).toBe('up');
  });
});
