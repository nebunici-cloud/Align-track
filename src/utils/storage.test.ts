import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatLocalDate,
  getTodayDateString,
  getDayNumberSince,
  getAvailableMinutesForDate,
  calculateWearStreak,
  mergeLogs,
  mergePhotos,
} from './storage';
import { AlignerSettings, WearLog, PhotoEntry } from '../types';

const BASE_SETTINGS: AlignerSettings = {
  dailyTargetHours: 22,
  totalTrays: 24,
  currentTray: 1,
  trayDurationDays: 7,
  trayStartDate: '2026-07-01T00:00:00.000Z',
  orthodontistName: 'Dr. Test',
  clinicName: 'Test Clinic',
  doctorPhone: '',
  nextApptDate: '2026-08-01',
  nextApptTime: '10:00',
  chewiesDailyTargetMinutes: 10,
  outTimerAlertMinutes: 30,
  pushNotificationsEnabled: true,
  soundAlertsEnabled: true,
};

describe('formatLocalDate', () => {
  it('formats a date as YYYY-MM-DD using local time, not UTC', () => {
    // 11pm local time on the 30th must not roll over to the 31st just
    // because toISOString() would shift it into the next UTC day.
    const d = new Date(2026, 6, 30, 23, 0, 0); // months are 0-indexed: 6 = July
    expect(formatLocalDate(d)).toBe('2026-07-30');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatLocalDate(d)).toBe('2026-01-05');
  });
});

describe('getTodayDateString', () => {
  it('matches formatLocalDate(new Date()) at the moment it is called', () => {
    expect(getTodayDateString()).toBe(formatLocalDate(new Date()));
  });
});

describe('getDayNumberSince', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 1 on the same calendar day the span started', () => {
    vi.setSystemTime(new Date(2026, 6, 15, 10, 0, 0));
    expect(getDayNumberSince('2026-07-15T09:00:00')).toBe(1);
  });

  it('returns 2 the next calendar day, even if less than 24 hours have elapsed', () => {
    // Tray started at 9pm on the 15th; by 1am on the 16th only 4 hours have
    // passed, but it's a new calendar day, so this must already read Day 2 -
    // the bug this function was written to fix used floor(hours/24)+1, which
    // would still say Day 1 here.
    vi.setSystemTime(new Date(2026, 6, 16, 1, 0, 0));
    expect(getDayNumberSince('2026-07-15T21:00:00')).toBe(2);
  });

  it('counts multiple elapsed calendar days correctly', () => {
    vi.setSystemTime(new Date(2026, 6, 18, 12, 0, 0));
    expect(getDayNumberSince('2026-07-15T08:00:00')).toBe(4);
  });

  it('never returns less than 1, even for a future start date', () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    expect(getDayNumberSince('2026-07-20T08:00:00')).toBe(1);
  });
});

describe('getAvailableMinutesForDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports 0 available minutes for a date before the plan started', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
    const result = getAvailableMinutesForDate('2026-07-01', {
      ...BASE_SETTINGS,
      planStartDate: '2026-07-10',
    });
    expect(result.isBeforeStart).toBe(true);
    expect(result.availableMins).toBe(0);
  });

  it('pro-rates the plan-start day from the configured start time', () => {
    vi.setSystemTime(new Date(2026, 6, 10, 12, 0, 0)); // noon on plan-start day
    const result = getAvailableMinutesForDate('2026-07-10', {
      ...BASE_SETTINGS,
      planStartDate: '2026-07-10',
      planStartTime: '09:00',
    });
    expect(result.isPlanStartDay).toBe(true);
    // From 9am to 12pm "now" is 3 hours = 180 minutes available
    expect(result.availableMins).toBe(180);
  });

  it('gives a full day for a past date after the plan already started', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 12, 0, 0));
    const result = getAvailableMinutesForDate('2026-07-15', {
      ...BASE_SETTINGS,
      planStartDate: '2026-07-01',
    });
    expect(result.isBeforeStart).toBe(false);
    expect(result.availableMins).toBe(1440);
  });
});

describe('calculateWearStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is 0 on the plan-start day itself before the configured start time has arrived', () => {
    // Plan starts today at 9am; it's only 1am, so zero minutes are available
    // yet and there's no prior day to fall back on.
    vi.setSystemTime(new Date(2026, 6, 20, 1, 0, 0));
    const streak = calculateWearStreak([], {
      ...BASE_SETTINGS,
      planStartDate: '2026-07-20',
      planStartTime: '09:00',
    });
    expect(streak).toBe(0);
  });

  it('counts consecutive fully-met past days and does not break on an in-progress today', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 23, 0, 0)); // late in the day, goal easily met today
    const settings = { ...BASE_SETTINGS, planStartDate: '2026-07-17', dailyTargetHours: 22 };
    // No out-time logged at all -> every day from plan start (17th) through
    // today (20th) meets target, for a streak of 4.
    const streak = calculateWearStreak([], settings);
    expect(streak).toBe(4);
  });

  it('breaks the streak on a past day that missed the target', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 23, 0, 0));
    const settings = { ...BASE_SETTINGS, planStartDate: '2026-07-17', dailyTargetHours: 22 };
    const logs: WearLog[] = [
      {
        id: 'l1',
        date: '2026-07-19',
        type: 'out',
        startTime: '2026-07-19T08:00:00.000Z',
        durationMinutes: 600, // 10 hours out on the 19th blows well past the 2-hour allowance
      },
    ];
    const streak = calculateWearStreak(logs, settings);
    // Today (20th) still counts on its own since it hasn't broken yet, but
    // the 19th missed target by a wide margin (600 min out vs. a ~120 min
    // allowance), which stops the streak from extending past today.
    expect(streak).toBe(1);
  });
});

describe('mergeLogs', () => {
  const logA: WearLog = { id: 'a', date: '2026-07-20', type: 'out', startTime: '2026-07-20T10:00:00.000Z', durationMinutes: 10 };
  const logB: WearLog = { id: 'b', date: '2026-07-20', type: 'out', startTime: '2026-07-20T12:00:00.000Z', durationMinutes: 10 };

  it('unions local and cloud entries by id', () => {
    const merged = mergeLogs([logA], [logB]);
    expect(merged.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('local entries win over a cloud entry with the same id', () => {
    const cloudVersion = { ...logA, durationMinutes: 999 };
    const merged = mergeLogs([logA], [cloudVersion]);
    expect(merged.find((l) => l.id === 'a')?.durationMinutes).toBe(10);
  });

  it('sorts newest first by startTime', () => {
    const merged = mergeLogs([logA], [logB]);
    expect(merged[0].id).toBe('b');
    expect(merged[1].id).toBe('a');
  });
});

describe('mergePhotos', () => {
  const photoA: PhotoEntry = { id: 'p1', trayNumber: 1, date: '2026-07-20', imageUrl: 'https://x/a.png' };
  const photoB: PhotoEntry = { id: 'p2', trayNumber: 1, date: '2026-07-21', imageUrl: 'https://x/b.png' };

  it('unions local and cloud photos by id and sorts newest first', () => {
    const merged = mergePhotos([photoA], [photoB]);
    expect(merged.map((p) => p.id)).toEqual(['p2', 'p1']);
  });
});
