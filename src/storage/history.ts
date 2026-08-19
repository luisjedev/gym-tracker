import { isFastingLongEnough } from './fasting';
import {
  getMondayDateKey,
  type CompletedFasting,
  type DailyRecord,
  type WeeklyRecord,
} from './schema';

export function getHistoryDays(
  dailyRecords: Record<string, DailyRecord>,
): DailyRecord[] {
  return Object.values(dailyRecords).sort((left, right) =>
    right.date.localeCompare(left.date),
  );
}

export function getHistoryWeeks(
  weeklyRecords: Record<string, WeeklyRecord>,
): WeeklyRecord[] {
  return Object.values(weeklyRecords).sort((left, right) =>
    right.weekStart.localeCompare(left.weekStart),
  );
}

export interface WeeklyStepSummary {
  recordedDays: number;
  completedDays: number;
  totalSteps: number;
  averageSteps: number | null;
}

export function getWeeklyStepSummary(
  dailyRecords: Record<string, DailyRecord>,
  weekStart: string,
): WeeklyStepSummary {
  const daysInWeek = getHistoryDays(dailyRecords).filter(
    (day) => getMondayDateKey(new Date(`${day.date}T12:00:00`)) === weekStart,
  );
  const recordedDays = daysInWeek.filter((day) => day.steps !== null);
  const totalSteps = recordedDays.reduce(
    (total, day) => total + (day.steps ?? 0),
    0,
  );

  return {
    recordedDays: recordedDays.length,
    completedDays: recordedDays.filter(
      (day) => (day.steps ?? 0) >= day.stepGoal,
    ).length,
    totalSteps,
    averageSteps:
      recordedDays.length > 0
        ? Math.round(totalSteps / recordedDays.length)
        : null,
  };
}

export function getHistoryFastings(
  completed: readonly CompletedFasting[],
): CompletedFasting[] {
  return completed
    .filter((fasting) => isFastingLongEnough(fasting.durationMinutes))
    .sort((left, right) => {
      const endDifference = Date.parse(right.endedAt) - Date.parse(left.endedAt);

      return endDifference !== 0
        ? endDifference
        : right.id.localeCompare(left.id);
    });
}
