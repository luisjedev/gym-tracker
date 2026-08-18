import { getHistoryWeeks } from './history';
import type { WeeklyRecord } from './schema';

function createWeek(weekStart: string): WeeklyRecord {
  return {
    weekStart,
    strengthGoal: 3,
    strengthSessions: [],
    heatGoal: 1,
    heatCompleted: 0,
  };
}

describe('weekly history', () => {
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
