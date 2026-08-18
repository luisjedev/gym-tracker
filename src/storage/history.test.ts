import { getHistoryWeeks, getWeeklyStepSummary } from './history';
import type { WeeklyRecord } from './schema';

function createWeek(weekStart: string): WeeklyRecord {
  return {
    weekStart,
    strengthGoal: 3,
    strengthSessions: [],
    hiitGoal: 1,
    hiitCompleted: 0,
  };
}

describe('weekly history', () => {
  it('summarizes only recorded steps for the requested local week', () => {
    expect(
      getWeeklyStepSummary(
        {
          '2026-08-03': { date: '2026-08-03', steps: 8_000, stepGoal: 7_000 },
          '2026-08-04': { date: '2026-08-04', steps: null, stepGoal: 7_000 },
          '2026-08-09': { date: '2026-08-09', steps: 6_000, stepGoal: 7_000 },
          '2026-08-10': { date: '2026-08-10', steps: 9_000, stepGoal: 8_000 },
        },
        '2026-08-03',
      ),
    ).toEqual({
      recordedDays: 2,
      completedDays: 1,
      totalSteps: 14_000,
      averageSteps: 7_000,
    });
  });

  it('returns empty step values when a week has no recorded totals', () => {
    expect(
      getWeeklyStepSummary(
        {
          '2026-08-10': { date: '2026-08-10', steps: null, stepGoal: 7_000 },
        },
        '2026-08-10',
      ),
    ).toEqual({
      recordedDays: 0,
      completedDays: 0,
      totalSteps: 0,
      averageSteps: null,
    });
  });

  it('returns saved weeks from the newest local Monday to the oldest', () => {
    const weeks = getHistoryWeeks({
      '2026-08-17': createWeek('2026-08-17'),
      '2026-08-03': createWeek('2026-08-03'),
      '2026-08-10': createWeek('2026-08-10'),
    });

    expect(weeks.map((week) => week.weekStart)).toEqual([
      '2026-08-17',
      '2026-08-10',
      '2026-08-03',
    ]);
  });
});
