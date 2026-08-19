import { getProgressStatistics } from './statistics';
import type { CompletedFasting, DailyRecord, WeeklyRecord } from './schema';

function createDay(
  date: string,
  steps: number | null,
  stepGoal: number,
): DailyRecord {
  return { date, steps, stepGoal };
}

function createWeek(
  weekStart: string,
  strengthGoal: number,
  strengthCompleted: number,
  hiitGoal: number,
  hiitCompleted: number,
): WeeklyRecord {
  return {
    weekStart,
    strengthGoal,
    strengthSessions: Array.from({ length: strengthCompleted }, (_, index) => ({
      id: `${weekStart}-strength-${index}`,
      name: `Sesión ${index + 1}`,
      muscleGroupIds: [],
      completed: true,
    })),
    hiitGoal,
    hiitCompleted,
  };
}

function createFasting(
  id: string,
  endedAt: string,
  durationMinutes: number,
): CompletedFasting {
  return {
    id,
    startedAt: '2026-08-01T08:00:00.000Z',
    endedAt,
    durationMinutes,
  };
}

describe('progress statistics', () => {
  it('returns empty values without inventing averages or a compliance percentage', () => {
    const statistics = getProgressStatistics([], [], []);

    expect(statistics.steps).toEqual({
      recordedDays: 0,
      completedDays: 0,
      averageSteps: null,
    });
    expect(statistics.strength).toEqual({
      evaluatedWeeks: 0,
      completedWeeks: 0,
      completedSessions: 0,
      percentage: null,
      weeklyProgress: [],
    });
    expect(statistics.hiit).toEqual({
      evaluatedWeeks: 0,
      completedWeeks: 0,
      completedSessions: 0,
      percentage: null,
      weeklyProgress: [],
    });
    expect(statistics.fasting).toEqual({
      completedFastings: 0,
      lastDurationMinutes: null,
      averageDurationMinutes: null,
    });
    expect(statistics.compliance).toEqual({
      completedUnits: 0,
      evaluableUnits: 0,
      percentage: null,
    });
  });

  it('uses registered step values, historical weekly goals, and completed fasts only', () => {
    const statistics = getProgressStatistics(
      [
        createDay('2026-08-16', null, 7_000),
        createDay('2026-08-17', 7_000, 7_000),
        createDay('2026-08-18', 10_000, 8_000),
        createDay('2026-08-19', 3_000, 7_000),
      ],
      [
        createWeek('2026-08-03', 3, 2, 1, 1),
        createWeek('2026-08-10', 1, 1, 2, 1),
      ],
      [
        createFasting('fasting-old', '2026-08-10T18:00:00.000Z', 600),
        createFasting('fasting-short', '2026-08-18T15:00:00.000Z', 420),
        createFasting('fasting-last', '2026-08-19T20:05:00.000Z', 725),
      ],
    );

    expect(statistics.steps).toEqual({
      recordedDays: 3,
      completedDays: 2,
      averageSteps: 6_667,
    });
    expect(statistics.strength).toEqual({
      evaluatedWeeks: 2,
      completedWeeks: 1,
      completedSessions: 3,
      percentage: 50,
      weeklyProgress: [
        {
          weekStart: '2026-08-03',
          completedSessions: 2,
          goalSessions: 3,
          goalMet: false,
        },
        {
          weekStart: '2026-08-10',
          completedSessions: 1,
          goalSessions: 1,
          goalMet: true,
        },
      ],
    });
    expect(statistics.hiit).toEqual({
      evaluatedWeeks: 2,
      completedWeeks: 1,
      completedSessions: 2,
      percentage: 50,
      weeklyProgress: [
        {
          weekStart: '2026-08-03',
          completedSessions: 1,
          goalSessions: 1,
          goalMet: true,
        },
        {
          weekStart: '2026-08-10',
          completedSessions: 1,
          goalSessions: 2,
          goalMet: false,
        },
      ],
    });
    expect(statistics.fasting).toEqual({
      completedFastings: 2,
      lastDurationMinutes: 725,
      averageDurationMinutes: 663,
    });
    expect(statistics.compliance).toEqual({
      completedUnits: 4,
      evaluableUnits: 8,
      percentage: 50,
    });
  });

  it('counts values at or above their saved objective as fulfilled', () => {
    const statistics = getProgressStatistics(
      [createDay('2026-08-20', 8_500, 7_000)],
      [createWeek('2026-08-17', 1, 2, 1, 1)],
      [],
    );

    expect(statistics.steps.completedDays).toBe(1);
    expect(statistics.strength.completedWeeks).toBe(1);
    expect(statistics.strength.completedSessions).toBe(2);
    expect(statistics.hiit.completedWeeks).toBe(1);
    expect(statistics.compliance).toEqual({
      completedUnits: 3,
      evaluableUnits: 3,
      percentage: 100,
    });
  });
});
