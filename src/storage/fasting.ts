import type { CompletedFasting } from './schema';

const MILLISECONDS_IN_MINUTE = 60_000;

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
