import type { CompletedFasting, DailyRecord, WeeklyRecord } from './schema';

export interface StepStatistics {
  recordedDays: number;
  completedDays: number;
  averageSteps: number | null;
}

export interface WeeklyProgress {
  weekStart: string;
  completedSessions: number;
  goalSessions: number;
  goalMet: boolean;
}

export interface WeeklyGoalStatistics {
  evaluatedWeeks: number;
  completedWeeks: number;
  completedSessions: number;
  percentage: number | null;
  weeklyProgress: WeeklyProgress[];
}

export interface FastingStatistics {
  completedFastings: number;
  lastDurationMinutes: number | null;
  averageDurationMinutes: number | null;
}

export interface ComplianceStatistics {
  completedUnits: number;
  evaluableUnits: number;
  percentage: number | null;
}

export interface ProgressStatistics {
  steps: StepStatistics;
  strength: WeeklyGoalStatistics;
  heat: WeeklyGoalStatistics;
  fasting: FastingStatistics;
  compliance: ComplianceStatistics;
}

function getStepStatistics(days: readonly DailyRecord[]): StepStatistics {
  const recordedDays = days.filter((day) => day.steps !== null);
  const totalSteps = recordedDays.reduce(
    (total, day) => total + (day.steps ?? 0),
    0,
  );

  return {
    recordedDays: recordedDays.length,
    completedDays: recordedDays.filter((day) => (day.steps ?? 0) >= day.stepGoal)
      .length,
    averageSteps:
      recordedDays.length > 0
        ? Math.round(totalSteps / recordedDays.length)
        : null,
  };
}

function getPercentage(completedUnits: number, evaluableUnits: number): number | null {
  return evaluableUnits > 0
    ? Math.round((completedUnits / evaluableUnits) * 100)
    : null;
}

function getWeeklyGoalStatistics(
  weeks: readonly WeeklyRecord[],
  getCompletedSessions: (week: WeeklyRecord) => number,
  getGoalSessions: (week: WeeklyRecord) => number,
): WeeklyGoalStatistics {
  const weeklyProgress = weeks.map((week) => {
    const completedSessions = getCompletedSessions(week);
    const goalSessions = getGoalSessions(week);

    return {
      weekStart: week.weekStart,
      completedSessions,
      goalSessions,
      goalMet: completedSessions >= goalSessions,
    };
  });

  const completedWeeks = weeklyProgress.filter((week) => week.goalMet).length;

  return {
    evaluatedWeeks: weeklyProgress.length,
    completedWeeks,
    completedSessions: weeklyProgress.reduce(
      (total, week) => total + week.completedSessions,
      0,
    ),
    percentage: getPercentage(completedWeeks, weeklyProgress.length),
    weeklyProgress,
  };
}

function getFastingStatistics(
  completed: readonly CompletedFasting[],
): FastingStatistics {
  const latestFasting = completed.reduce<CompletedFasting | null>(
    (latest, fasting) => {
      if (!latest || Date.parse(fasting.endedAt) > Date.parse(latest.endedAt)) {
        return fasting;
      }

      return latest;
    },
    null,
  );
  const totalMinutes = completed.reduce(
    (total, fasting) => total + fasting.durationMinutes,
    0,
  );

  return {
    completedFastings: completed.length,
    lastDurationMinutes: latestFasting?.durationMinutes ?? null,
    averageDurationMinutes:
      completed.length > 0 ? Math.round(totalMinutes / completed.length) : null,
  };
}

function getComplianceStatistics(
  days: readonly DailyRecord[],
  weeks: readonly WeeklyRecord[],
  strength: WeeklyGoalStatistics,
  heat: WeeklyGoalStatistics,
): ComplianceStatistics {
  const completedStepUnits = days.filter(
    (day) => day.steps !== null && day.steps >= day.stepGoal,
  ).length;
  const completedWeeklyUnits = strength.completedWeeks + heat.completedWeeks;
  const evaluableUnits = days.length + weeks.length * 2;
  const completedUnits = completedStepUnits + completedWeeklyUnits;

  return {
    completedUnits,
    evaluableUnits,
    percentage: getPercentage(completedUnits, evaluableUnits),
  };
}

export function getProgressStatistics(
  days: readonly DailyRecord[],
  weeks: readonly WeeklyRecord[],
  completedFastings: readonly CompletedFasting[],
): ProgressStatistics {
  const steps = getStepStatistics(days);
  const strength = getWeeklyGoalStatistics(
    weeks,
    (week) => week.strengthSessions.filter((session) => session.completed).length,
    (week) => week.strengthGoal,
  );
  const heat = getWeeklyGoalStatistics(
    weeks,
    (week) => week.heatCompleted,
    (week) => week.heatGoal,
  );

  return {
    steps,
    strength,
    heat,
    fasting: getFastingStatistics(completedFastings),
    compliance: getComplianceStatistics(days, weeks, strength, heat),
  };
}
