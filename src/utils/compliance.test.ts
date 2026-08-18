import { describe, it, expect } from 'vitest';
import { computeBand, getAllowedOutMinutes, AT_RISK_THRESHOLD_MINUTES } from './compliance';

describe('getAllowedOutMinutes', () => {
  it('converts a 22h wear goal into a 2h out budget', () => {
    expect(getAllowedOutMinutes(22)).toBe(120);
  });

  it('handles a 20h goal', () => {
    expect(getAllowedOutMinutes(20)).toBe(240);
  });

  it('gives no budget for an impossible 24h goal', () => {
    expect(getAllowedOutMinutes(24)).toBe(0);
  });

  it('never returns a negative budget for an over-24h goal', () => {
    expect(getAllowedOutMinutes(26)).toBe(0);
  });

  it('rounds fractional targets to whole minutes', () => {
    expect(getAllowedOutMinutes(21.5)).toBe(150);
  });
});

describe('computeBand', () => {
  const allowed = getAllowedOutMinutes(22); // 120

  it('is onTrack when well under budget', () => {
    expect(computeBand(30, allowed)).toBe('onTrack');
  });

  it('is onTrack with nothing used yet', () => {
    expect(computeBand(0, allowed)).toBe('onTrack');
  });

  it('stays onTrack just above the at-risk threshold', () => {
    // 89 used -> 31 remaining, one minute above the threshold
    expect(computeBand(allowed - AT_RISK_THRESHOLD_MINUTES - 1, allowed)).toBe('onTrack');
  });

  it('is atRisk exactly at the threshold', () => {
    // 90 used -> exactly 30 remaining
    expect(computeBand(allowed - AT_RISK_THRESHOLD_MINUTES, allowed)).toBe('atRisk');
  });

  it('is atRisk with a single minute left', () => {
    expect(computeBand(allowed - 1, allowed)).toBe('atRisk');
  });

  it('is missed once the budget is exactly spent', () => {
    expect(computeBand(allowed, allowed)).toBe('missed');
  });

  it('is missed when over budget', () => {
    expect(computeBand(allowed + 45, allowed)).toBe('missed');
  });

  it('is missed immediately when no budget exists at all', () => {
    expect(computeBand(0, 0)).toBe('missed');
  });
});
