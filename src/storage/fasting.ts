import {
  formatDateKey,
  type ActiveFasting,
  type CompletedFasting,
} from './schema';

const MILLISECONDS_IN_MINUTE = 60_000;
const FIRST_VALID_EATING_OFFSET_MINUTES = 15 * 60 + 1;
const FASTING_SUCCESS_THRESHOLD_MINUTES = 15 * 60;
const DAYS_IN_WEEK = 7;

export type FastingDayStatus = 'neutral' | 'success' | 'danger' | 'active';

export interface WeeklyFastingDay {
  date: string;
  status: FastingDayStatus;
  durationMinutes: number | null;
}

export function calculateFastingDurationMinutes(
  startedAt: string,
  endedAt: string,
): number {
  const startedTimestamp = Date.parse(startedAt);
  const endedTimestamp = Date.parse(endedAt);

  if (
    !Number.isFinite(startedTimestamp) ||
    !Number.isFinite(endedTimestamp) ||
    endedTimestamp < startedTimestamp
  ) {
    throw new Error('Las fechas del ayuno no son válidas.');
  }

  return Math.floor((endedTimestamp - startedTimestamp) / MILLISECONDS_IN_MINUTE);
}

export function getAverageFastingDurationMinutes(
  completed: readonly CompletedFasting[],
): number | null {
  if (completed.length === 0) {
    return null;
  }

  const totalMinutes = completed.reduce(
    (total, fasting) => total + fasting.durationMinutes,
    0,
  );

  return Math.round(totalMinutes / completed.length);
}

export function getFirstValidEatingTime(startedAt: string): Date {
  const startedTimestamp = Date.parse(startedAt);

  if (!Number.isFinite(startedTimestamp)) {
    throw new Error('La fecha de inicio del ayuno no es válida.');
  }

  return new Date(
    startedTimestamp + FIRST_VALID_EATING_OFFSET_MINUTES * MILLISECONDS_IN_MINUTE,
  );
}

function getWeekDateKeys(now: Date): string[] {
  const monday = new Date(now);
  const day = monday.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  monday.setDate(monday.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatDateKey(date);
  });
}

function isValidCompletedFasting(fasting: CompletedFasting): boolean {
  const startedTimestamp = Date.parse(fasting.startedAt);
  const endedTimestamp = Date.parse(fasting.endedAt);

  if (
    !Number.isFinite(startedTimestamp) ||
    !Number.isFinite(endedTimestamp) ||
    endedTimestamp < startedTimestamp ||
    !Number.isFinite(fasting.durationMinutes) ||
    fasting.durationMinutes < 0
  ) {
    return false;
  }

  const calculatedDurationMinutes = Math.floor(
    (endedTimestamp - startedTimestamp) / MILLISECONDS_IN_MINUTE,
  );

  return fasting.durationMinutes === calculatedDurationMinutes;
}

export function getWeeklyFastingSummary(
  completed: readonly CompletedFasting[],
  active: ActiveFasting | null,
  now: Date,
): WeeklyFastingDay[] {
  const dates = getWeekDateKeys(now);
  const dateSet = new Set(dates);
  const longestByStartDate = new Map<string, number>();

  for (const fasting of completed) {
    if (!isValidCompletedFasting(fasting)) {
      continue;
    }

    const startDate = new Date(Date.parse(fasting.startedAt));
    const date = formatDateKey(startDate);

    if (!dateSet.has(date)) {
      continue;
    }

    const previousDuration = longestByStartDate.get(date);
    if (previousDuration === undefined || fasting.durationMinutes > previousDuration) {
      longestByStartDate.set(date, fasting.durationMinutes);
    }
  }

  const nowTimestamp = now.getTime();
  const activeTimestamp = active ? Date.parse(active.startedAt) : Number.NaN;
  const activeStartDate =
    Number.isFinite(activeTimestamp) && activeTimestamp <= nowTimestamp
      ? formatDateKey(new Date(activeTimestamp))
      : null;
  const activeDurationMinutes =
    active && activeStartDate !== null
      ? calculateFastingDurationMinutes(active.startedAt, now.toISOString())
      : null;
  const currentDate = formatDateKey(now);

  return dates.map((date) => {
    if (date > currentDate) {
      return { date, status: 'neutral', durationMinutes: null };
    }

    if (date === activeStartDate && activeDurationMinutes !== null) {
      return { date, status: 'active', durationMinutes: activeDurationMinutes };
    }

    const durationMinutes = longestByStartDate.get(date);
    if (durationMinutes !== undefined) {
      return {
        date,
        status:
          durationMinutes > FASTING_SUCCESS_THRESHOLD_MINUTES
            ? 'success'
            : 'danger',
        durationMinutes,
      };
    }

    return {
      date,
      status: date < currentDate ? 'danger' : 'neutral',
      durationMinutes: null,
    };
  });
}
