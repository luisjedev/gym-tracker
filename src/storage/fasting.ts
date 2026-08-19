import {
  DEFAULT_FASTING_GOAL_HOURS,
  formatDateKey,
  getMondayDateKey,
  type ActiveFasting,
  type CompletedFasting,
} from './schema';

const MILLISECONDS_IN_MINUTE = 60_000;
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

export function getFirstValidEatingTime(
  startedAt: string,
  fastingGoalHours = DEFAULT_FASTING_GOAL_HOURS,
): Date {
  const startedTimestamp = Date.parse(startedAt);

  if (!Number.isFinite(startedTimestamp)) {
    throw new Error('La fecha de inicio del ayuno no es válida.');
  }

  if (!Number.isSafeInteger(fastingGoalHours) || fastingGoalHours < 0) {
    throw new Error('El objetivo de ayuno no es válido.');
  }

  return new Date(
    startedTimestamp + fastingGoalHours * 60 * MILLISECONDS_IN_MINUTE,
  );
}

function getWeekDateKeys(now: Date): string[] {
  const [year, month, day] = getMondayDateKey(now).split('-').map(Number);
  const monday = new Date(year, month - 1, day);

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatDateKey(date);
  });
}

function isValidCompletedFasting(fasting: CompletedFasting): boolean {
  try {
    return (
      calculateFastingDurationMinutes(fasting.startedAt, fasting.endedAt) ===
      fasting.durationMinutes
    );
  } catch {
    return false;
  }
}

export function getWeeklyFastingSummary(
  completed: readonly CompletedFasting[],
  active: ActiveFasting | null,
  now: Date,
  fastingGoalHours = DEFAULT_FASTING_GOAL_HOURS,
): WeeklyFastingDay[] {
  if (!Number.isSafeInteger(fastingGoalHours) || fastingGoalHours < 0) {
    throw new Error('El objetivo de ayuno no es válido.');
  }

  const fastingGoalMinutes = fastingGoalHours * 60;
  const dates = getWeekDateKeys(now);
  const dateSet = new Set(dates);
  const startedDates = new Set<string>();
  const longestByStartDate = new Map<string, number>();

  for (const fasting of completed) {
    const startedTimestamp = Date.parse(fasting.startedAt);
    if (!Number.isFinite(startedTimestamp)) {
      continue;
    }

    const date = formatDateKey(new Date(startedTimestamp));
    if (!dateSet.has(date)) {
      continue;
    }

    startedDates.add(date);
    if (!isValidCompletedFasting(fasting)) {
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
          durationMinutes >= fastingGoalMinutes ? 'success' : 'danger',
        durationMinutes,
      };
    }

    return {
      date,
      status:
        date < currentDate || startedDates.has(date) ? 'danger' : 'neutral',
      durationMinutes: null,
    };
  });
}
