import { describe, it, expect } from 'vitest';
import { stripUndefined } from './firebaseService';

describe('stripUndefined', () => {
  it('removes top-level keys whose value is undefined', () => {
    const input = { a: 1, b: undefined, c: 'x' };
    expect(stripUndefined(input)).toEqual({ a: 1, c: 'x' });
  });

  it('keeps null, empty string, and 0 (only undefined is stripped)', () => {
    const input = { a: null, b: '', c: 0, d: undefined };
    expect(stripUndefined(input)).toEqual({ a: null, b: '', c: 0 });
  });

  it('recurses into nested objects', () => {
    const input = { outer: { keep: 1, drop: undefined } };
    expect(stripUndefined(input)).toEqual({ outer: { keep: 1 } });
  });

  it('recurses into arrays of objects', () => {
    const input = [{ a: 1, b: undefined }, { a: 2 }];
    expect(stripUndefined(input)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('reproduces the exact bug this was added to fix: a manual log entry with a blank note', () => {
    // DailyLogsList builds notes as `manualNotes.trim() || undefined`, which
    // is `undefined` whenever the note is left blank - Firestore's setDoc
    // throws on that unless it's stripped first.
    const manualLogPayload = {
      id: 'log_1',
      date: '2026-07-31',
      type: 'out',
      startTime: '2026-07-31T12:30:00.000Z',
      endTime: '2026-07-31T13:00:00.000Z',
      durationMinutes: 30,
      reason: 'lunch',
      notes: undefined,
    };
    const sanitized = stripUndefined(manualLogPayload);
    expect('notes' in sanitized).toBe(false);
    expect(sanitized).toEqual({
      id: 'log_1',
      date: '2026-07-31',
      type: 'out',
      startTime: '2026-07-31T12:30:00.000Z',
      endTime: '2026-07-31T13:00:00.000Z',
      durationMinutes: 30,
      reason: 'lunch',
    });
  });
});
