import type { StorageAdapter } from './appStorage';
import { APP_STORAGE_KEY } from './appStorage';

export const STORAGE_SCHEMA_VERSION = 1;
export const DEFAULT_DAILY_STEP_GOAL = 7_000;
export const DEFAULT_HEAT_WEEKLY_GOAL = 1;
export const DEFAULT_WATER_SETTINGS = {
  enabled: false,
  startTime: '08:00',
  endTime: '22:00',
  intervalHours: 2,
} as const;

export interface MuscleGroup {
  id: string;
  name: string;
}

export interface StrengthSession {
  id: string;
  name: string;
  muscleGroupIds: string[];
  completed: boolean;
}

export interface WaterSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  intervalHours: number;
}

export interface DailyRecord {
  date: string;
  steps: number | null;
  stepGoal: number;
}

export interface WeeklyRecord {
  weekStart: string;
  strengthGoal: number;
  strengthSessions: StrengthSession[];
  heatGoal: number;
  heatCompleted: number;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  uri: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroupId: string;
  description: string;
  media: MediaItem[];
  createdAt: string;
  updatedAt: string;
}

export interface NewExerciseInput {
  name: string;
  muscleGroupId: string;
  description?: string;
}

export function normalizeEntityName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function namesMatch(left: string, right: string): boolean {
  return normalizeEntityName(left)
    .replace(/\s/g, '')
    .toLocaleLowerCase() ===
    normalizeEntityName(right).replace(/\s/g, '').toLocaleLowerCase();
}

export function sortExercises(
  exercises: readonly Exercise[],
  muscleGroups: readonly MuscleGroup[],
): Exercise[] {
  const groupOrder = new Map(
    muscleGroups.map((group, index) => [group.id, index]),
  );

  return [...exercises].sort((left, right) => {
    const groupDifference =
      (groupOrder.get(left.muscleGroupId) ?? Number.MAX_SAFE_INTEGER) -
      (groupOrder.get(right.muscleGroupId) ?? Number.MAX_SAFE_INTEGER);

    if (groupDifference !== 0) {
      return groupDifference;
    }

    const nameDifference = left.name.localeCompare(right.name, 'es', {
      sensitivity: 'base',
    });

    return nameDifference !== 0
      ? nameDifference
      : left.id.localeCompare(right.id);
  });
}

export interface ActiveFasting {
  startedAt: string;
}

export interface CompletedFasting {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
}

export interface AppState {
  settings: {
    dailyStepGoal: number;
    strengthSessions: StrengthSession[];
    heatWeeklyGoal: number;
    water: WaterSettings;
  };
  muscleGroups: MuscleGroup[];
  exercises: Exercise[];
  dailyRecords: Record<string, DailyRecord>;
  weeklyRecords: Record<string, WeeklyRecord>;
  fasting: {
    active: ActiveFasting | null;
    completed: CompletedFasting[];
  };
}

export interface PersistedAppState {
  schemaVersion: typeof STORAGE_SCHEMA_VERSION;
  state: AppState;
}

export const DEFAULT_MUSCLE_GROUPS: readonly MuscleGroup[] = [
  { id: 'pecho', name: 'Pecho' },
  { id: 'espalda', name: 'Espalda' },
  { id: 'hombro', name: 'Hombro' },
  { id: 'biceps', name: 'Bíceps' },
  { id: 'triceps', name: 'Tríceps' },
  { id: 'piernas', name: 'Piernas' },
  { id: 'gluteos', name: 'Glúteos' },
  { id: 'abdomen', name: 'Abdomen' },
];

export const DEFAULT_STRENGTH_SESSIONS: readonly StrengthSession[] = [
  {
    id: 'fuerza-pecho',
    name: 'Pecho/Hombro/Tríceps',
    muscleGroupIds: ['pecho', 'hombro', 'triceps'],
    completed: false,
  },
  {
    id: 'fuerza-espalda',
    name: 'Espalda/Bíceps',
    muscleGroupIds: ['espalda', 'biceps'],
    completed: false,
  },
  {
    id: 'fuerza-piernas',
    name: 'Piernas',
    muscleGroupIds: ['piernas'],
    completed: false,
  },
];

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getMondayDateKey(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return formatDateKey(monday);
}

function copyStrengthSessions(sessions: readonly StrengthSession[]): StrengthSession[] {
  return sessions.map((session) => ({
    ...session,
    muscleGroupIds: [...session.muscleGroupIds],
  }));
}

function createWeeklyRecord(
  weekStart: string,
  settings: AppState['settings'],
): WeeklyRecord {
  return {
    weekStart,
    strengthGoal: settings.strengthSessions.length,
    strengthSessions: copyStrengthSessions(settings.strengthSessions),
    heatGoal: settings.heatWeeklyGoal,
    heatCompleted: 0,
  };
}

export function ensureCurrentPeriods(state: AppState, now: Date): AppState {
  const dateKey = formatDateKey(now);
  const weekStart = getMondayDateKey(now);
  let nextState = state;

  if (!state.dailyRecords[dateKey]) {
    nextState = {
      ...nextState,
      dailyRecords: {
        ...nextState.dailyRecords,
        [dateKey]: {
          date: dateKey,
          steps: null,
          stepGoal: nextState.settings.dailyStepGoal,
        },
      },
    };
  }

  if (!nextState.weeklyRecords[weekStart]) {
    nextState = {
      ...nextState,
      weeklyRecords: {
        ...nextState.weeklyRecords,
        [weekStart]: createWeeklyRecord(weekStart, nextState.settings),
      },
    };
  }

  return nextState;
}

export function createDefaultState(now = new Date()): AppState {
  const state: AppState = {
    settings: {
      dailyStepGoal: DEFAULT_DAILY_STEP_GOAL,
      strengthSessions: copyStrengthSessions(DEFAULT_STRENGTH_SESSIONS),
      heatWeeklyGoal: DEFAULT_HEAT_WEEKLY_GOAL,
      water: { ...DEFAULT_WATER_SETTINGS },
    },
    muscleGroups: DEFAULT_MUSCLE_GROUPS.map((group) => ({ ...group })),
    exercises: [],
    dailyRecords: {},
    weeklyRecords: {},
    fasting: {
      active: null,
      completed: [],
    },
  };

  return ensureCurrentPeriods(state, now);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidDailyRecord(value: unknown): value is DailyRecord {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    (value.steps === null || isNonNegativeSafeInteger(value.steps)) &&
    isNonNegativeSafeInteger(value.stepGoal)
  );
}

function isValidState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  const settings = value.settings;
  const fasting = value.fasting;

  return (
    isRecord(settings) &&
    isNonNegativeSafeInteger(settings.dailyStepGoal) &&
    Array.isArray(settings.strengthSessions) &&
    typeof settings.heatWeeklyGoal === 'number' &&
    Number.isInteger(settings.heatWeeklyGoal) &&
    settings.heatWeeklyGoal >= 0 &&
    isRecord(settings.water) &&
    typeof settings.water.enabled === 'boolean' &&
    typeof settings.water.startTime === 'string' &&
    typeof settings.water.endTime === 'string' &&
    typeof settings.water.intervalHours === 'number' &&
    Number.isInteger(settings.water.intervalHours) &&
    settings.water.intervalHours > 0 &&
    Array.isArray(value.muscleGroups) &&
    Array.isArray(value.exercises) &&
    isRecord(value.dailyRecords) &&
    Object.values(value.dailyRecords).every(isValidDailyRecord) &&
    isRecord(value.weeklyRecords) &&
    isRecord(fasting) &&
    (fasting.active === null || isRecord(fasting.active)) &&
    Array.isArray(fasting.completed)
  );
}

export function parsePersistedState(rawValue: string): PersistedAppState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('El almacenamiento contiene datos que no se pueden leer.');
  }

  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== STORAGE_SCHEMA_VERSION ||
    !isValidState(parsed.state)
  ) {
    throw new Error('La versión de los datos guardados no es compatible.');
  }

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    state: parsed.state,
  };
}

export async function saveAppState(
  storage: StorageAdapter,
  state: AppState,
): Promise<void> {
  const payload: PersistedAppState = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    state,
  };
  await storage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
}

export async function loadAppState(
  storage: StorageAdapter,
  now = new Date(),
): Promise<AppState> {
  const rawValue = await storage.getItem(APP_STORAGE_KEY);

  if (rawValue === null) {
    const initialState = createDefaultState(now);
    await saveAppState(storage, initialState);
    return initialState;
  }

  const persisted = parsePersistedState(rawValue);
  const state = ensureCurrentPeriods(persisted.state, now);

  if (state !== persisted.state) {
    await saveAppState(storage, state);
  }

  return state;
}
