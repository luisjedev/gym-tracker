import type { CompletedFasting, DailyRecord, WeeklyRecord } from './schema';

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

export function getHistoryFastings(
  completed: readonly CompletedFasting[],
): CompletedFasting[] {
  return [...completed].sort((left, right) => {
    const endDifference = Date.parse(right.endedAt) - Date.parse(left.endedAt);

    return endDifference !== 0
      ? endDifference
      : right.id.localeCompare(left.id);
  });
}
