import { describe, it, expect } from 'vitest';
import { computeSessionStart, __TEST_GAP_MS } from '../useCurrentSessionStart';

const HOUR = 60 * 60 * 1000;
const ts = (offsetH: number) => new Date(Date.UTC(2026, 4, 1, 12, 0, 0) + offsetH * HOUR).toISOString();

describe('computeSessionStart', () => {
  it('returns null for empty input', () => {
    expect(computeSessionStart([])).toBe(null);
  });

  it('returns the only message timestamp when single', () => {
    const single = ts(0);
    expect(computeSessionStart([single])).toBe(single);
  });

  it('without gaps, returns the oldest message (start of conv)', () => {
    // 4 msgs com 5min de gap entre cada — sem nenhum gap ≥ 12h
    const msgs = [ts(0), ts(-0.1), ts(-0.2), ts(-0.3)];
    expect(computeSessionStart(msgs)).toBe(ts(-0.3));
  });

  it('detects gap ≥ 12h and returns msg AFTER the gap', () => {
    // mais recente → mais antigo: now, now-1h, GAP, now-15h, now-15.1h
    const msgs = [ts(0), ts(-1), ts(-15), ts(-15.1)];
    // gap entre ts(-1) e ts(-15) = 14h ≥ 12h → corte
    expect(computeSessionStart(msgs)).toBe(ts(-1));
  });

  it('cuts on resolved_at boundary', () => {
    // msgs sem gap longo, mas resolved_at no meio
    const msgs = [ts(0), ts(-0.1), ts(-0.5), ts(-1)];
    // resolved_at entre ts(-0.5) e ts(-0.1) → sessão atual começa em ts(-0.1)
    const resolved = ts(-0.3);
    expect(computeSessionStart(msgs, resolved)).toBe(ts(-0.1));
  });

  it('falls back to oldest when resolved_at is older than all messages', () => {
    const msgs = [ts(0), ts(-0.1), ts(-0.2)];
    const resolved = ts(-100); // muito antigo
    expect(computeSessionStart(msgs, resolved)).toBe(ts(-0.2));
  });

  it('takes the FIRST cut (most recent gap, walking from newest)', () => {
    // dois gaps de 13h: ts(0)..ts(-13), e ts(-26)..ts(-39)
    const msgs = [ts(0), ts(-13), ts(-26), ts(-39)];
    // walking from newest: gap entre ts(0) e ts(-13) = 13h ≥ 12h → para no primeiro
    expect(computeSessionStart(msgs)).toBe(ts(0));
  });

  it('respects custom gapMs', () => {
    const msgs = [ts(0), ts(-2), ts(-5)];
    // sem gap ≥ default 12h, mas 2h é gap se gapMs=1h
    expect(computeSessionStart(msgs, null, HOUR)).toBe(ts(0));
  });

  it('default gap is 12h', () => {
    expect(__TEST_GAP_MS).toBe(12 * HOUR);
  });
});
