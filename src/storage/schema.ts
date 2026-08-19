import type { StorageAdapter } from './appStorage';
import { APP_STORAGE_KEY } from './appStorage';

export const STORAGE_SCHEMA_VERSION = 5;
const LEGACY_STORAGE_SCHEMA_VERSION = 1;
const FASTING_GOAL_STORAGE_SCHEMA_VERSION = 2;
const PREVIOUS_STORAGE_SCHEMA_VERSION = 3;
const DAILY_STEP_REMINDER_STORAGE_SCHEMA_VERSION = 4;
export const DEFAULT_DAILY_STEP_GOAL = 7_000;
export const DEFAULT_HIIT_WEEKLY_GOAL = 1;
export const DEFAULT_FASTING_GOAL_HOURS = 14;
export const MIN_COMPLETED_FASTING_HOURS = 8;
export const MIN_COMPLETED_FASTING_DURATION_MINUTES =
  MIN_COMPLETED_FASTING_HOURS * 60;
export const MIN_FASTING_GOAL_HOURS = 12;
export const MAX_FASTING_GOAL_HOURS = 20;
export const DEFAULT_WATER_SETTINGS = {
  enabled: false,
  startTime: '08:00',
  endTime: '22:00',
  intervalHours: 2,
} as const;
export const DEFAULT_DAILY_STEP_REMINDER_SETTINGS = {
  enabled: false,
  time: '23:00',
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

export interface StrengthSessionInput {
  name?: string;
  muscleGroupIds: string[];
}

export interface WaterSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  intervalHours: number;
}

export interface DailyStepReminderSettings {
  enabled: boolean;
  time: string;
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
  hiitGoal: number;
  hiitCompleted: number;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  uri: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ExerciseCover {
  id: string;
  uri: string;
  width?: number;
  height?: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroupId: string;
  description: string;
  cover?: ExerciseCover | null;
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
    hiitWeeklyGoal: number;
    fastingGoalHours: number;
    water: WaterSettings;
    dailyStepReminder: DailyStepReminderSettings;
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

function discardShortCompletedFastings(state: AppState): AppState {
  const completed = state.fasting.completed.filter(
    (fasting) =>
      fasting.durationMinutes >= MIN_COMPLETED_FASTING_DURATION_MINUTES,
  );

  return completed.length === state.fasting.completed.length
    ? state
    : {
        ...state,
        fasting: {
          ...state.fasting,
          completed,
        },
      };
}

export const DEFAULT_MUSCLE_GROUPS: readonly MuscleGroup[] = [
  { id: 'pecho', name: 'Pecho' },
  { id: 'espalda', name: 'Espalda' },
  { id: 'hombro', name: 'Hombros' },
  { id: 'biceps', name: 'Bíceps' },
  { id: 'triceps', name: 'Tríceps' },
  { id: 'antebrazos', name: 'Antebrazos' },
  { id: 'abdomen', name: 'Abdomen' },
  { id: 'gluteos', name: 'Glúteos' },
  { id: 'piernas', name: 'Piernas' },
];

export const DEFAULT_EXERCISE_ASSET_GROUP_IDS: readonly string[] = [
  'pecho',
  'espalda',
  'hombro',
  'biceps',
  'triceps',
  'abdomen',
  'gluteos',
  'piernas',
];
export const DEFAULT_EXERCISE_ASSET_URI_PREFIX = 'asset://exercise/';
export const DEFAULT_EXERCISE_IMAGE_WIDTH = 1_055;
export const DEFAULT_EXERCISE_IMAGE_HEIGHT = 1_491;

export function getDefaultExerciseAssetUri(groupId: string): string | null {
  return DEFAULT_EXERCISE_ASSET_GROUP_IDS.includes(groupId)
    ? `${DEFAULT_EXERCISE_ASSET_URI_PREFIX}${groupId}`
    : null;
}

export function isBundledExerciseAssetUri(uri: string): boolean {
  return DEFAULT_EXERCISE_ASSET_GROUP_IDS.some(
    (groupId) => getDefaultExerciseAssetUri(groupId) === uri,
  );
}

export const DEFAULT_STRENGTH_SESSIONS: readonly StrengthSession[] = [
  {
    id: 'fuerza-pecho',
    name: 'Pecho/Hombros/Tríceps',
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
    hiitGoal: settings.hiitWeeklyGoal,
    hiitCompleted: 0,
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

function createDefaultExercises(
  timestamp: string,
  reservedIds: readonly string[] = [],
): Exercise[] {
  const usedIds = new Set(reservedIds);
  const createAssetId = (prefix: string, groupId: string): string => {
    const baseId = `${prefix}-general-${groupId}`;
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    return id;
  };

  return DEFAULT_MUSCLE_GROUPS.map((group) => {
    const assetUri = getDefaultExerciseAssetUri(group.id);
    const cover = assetUri
      ? {
          id: createAssetId('cover', group.id),
          uri: assetUri,
          width: DEFAULT_EXERCISE_IMAGE_WIDTH,
          height: DEFAULT_EXERCISE_IMAGE_HEIGHT,
        }
      : null;
    const media = assetUri
      ? [
          {
            id: createAssetId('media', group.id),
            type: 'image' as const,
            uri: assetUri,
            width: DEFAULT_EXERCISE_IMAGE_WIDTH,
            height: DEFAULT_EXERCISE_IMAGE_HEIGHT,
          },
        ]
      : [];

    return {
      id: createAssetId('exercise', group.id),
      name: 'General',
      muscleGroupId: group.id,
      description: '',
      cover,
      media,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

function addMissingDefaultExercises(state: AppState, timestamp: string): AppState {
  const reservedIds = state.exercises.flatMap((exercise) => [
    exercise.id,
    ...(exercise.cover ? [exercise.cover.id] : []),
    ...exercise.media.map((mediaItem) => mediaItem.id),
  ]);
  const defaultExercises = createDefaultExercises(timestamp, reservedIds);
  const missingExercises = defaultExercises.filter(
    (defaultExercise) =>
      !state.exercises.some(
        (exercise) =>
          exercise.muscleGroupId === defaultExercise.muscleGroupId &&
          namesMatch(exercise.name, defaultExercise.name),
      ),
  );

  return missingExercises.length > 0
    ? { ...state, exercises: [...state.exercises, ...missingExercises] }
    : state;
}

export function createDefaultState(now = new Date()): AppState {
  const timestamp = now.toISOString();
  const state: AppState = {
    settings: {
      dailyStepGoal: DEFAULT_DAILY_STEP_GOAL,
      strengthSessions: copyStrengthSessions(DEFAULT_STRENGTH_SESSIONS),
      hiitWeeklyGoal: DEFAULT_HIIT_WEEKLY_GOAL,
      fastingGoalHours: DEFAULT_FASTING_GOAL_HOURS,
      water: { ...DEFAULT_WATER_SETTINGS },
      dailyStepReminder: { ...DEFAULT_DAILY_STEP_REMINDER_SETTINGS },
    },
    muscleGroups: DEFAULT_MUSCLE_GROUPS.map((group) => ({ ...group })),
    exercises: createDefaultExercises(timestamp),
    dailyRecords: {},
    weeklyRecords: {},
    fasting: {
      active: null,
      completed: [],
    },
  };

  return ensureCurrentPeriods(state, now);
}

function getCatalogGroupId(
  group: MuscleGroup,
  catalogByName: Map<string, string>,
): string | null {
  if (DEFAULT_MUSCLE_GROUPS.some((item) => item.id === group.id)) {
    return group.id;
  }

  return catalogByName.get(normalizeEntityName(group.name).toLocaleLowerCase()) ?? null;
}

function remapGroupIds(
  groupIds: readonly string[],
  groupIdMap: Map<string, string>,
): string[] {
  return [
    ...new Set(
      groupIds.flatMap((groupId) => {
        const mappedGroupId = groupIdMap.get(groupId);
        return mappedGroupId ? [mappedGroupId] : [];
      }),
    ),
  ];
}

function migrateToFixedMuscleGroupCatalog(state: AppState): AppState {
  const isFixedCatalog =
    state.muscleGroups.length === DEFAULT_MUSCLE_GROUPS.length &&
    state.muscleGroups.every(
      (group, index) =>
        group.id === DEFAULT_MUSCLE_GROUPS[index].id &&
        group.name === DEFAULT_MUSCLE_GROUPS[index].name,
    );

  if (isFixedCatalog) {
    return state;
  }

  const catalogByName = new Map(
    DEFAULT_MUSCLE_GROUPS.map((group) => [
      normalizeEntityName(group.name).toLocaleLowerCase(),
      group.id,
    ]),
  );
  const groupIdMap = new Map<string, string>();

  for (const group of state.muscleGroups) {
    const mappedGroupId = getCatalogGroupId(group, catalogByName);
    if (mappedGroupId) {
      groupIdMap.set(group.id, mappedGroupId);
    }
  }

  const migrateSession = (session: StrengthSession): StrengthSession => {
    const muscleGroupIds = remapGroupIds(session.muscleGroupIds, groupIdMap);
    return {
      ...session,
      muscleGroupIds: muscleGroupIds.length > 0 ? muscleGroupIds : ['pecho'],
    };
  };

  return {
    ...state,
    settings: {
      ...state.settings,
      strengthSessions: state.settings.strengthSessions.map(migrateSession),
    },
    muscleGroups: DEFAULT_MUSCLE_GROUPS.map((group) => ({ ...group })),
    exercises: state.exercises.flatMap((exercise) => {
      const muscleGroupId = groupIdMap.get(exercise.muscleGroupId);
      return muscleGroupId
        ? [{ ...exercise, muscleGroupId }]
        : [];
    }),
    weeklyRecords: Object.fromEntries(
      Object.entries(state.weeklyRecords).map(([weekStart, week]) => [
        weekStart,
        {
          ...week,
          strengthSessions: week.strengthSessions.map(migrateSession),
        },
      ]),
    ),
  };
}

function normalizeExerciseCovers(state: AppState): AppState {
  let hasMissingCover = false;
  const exercises = state.exercises.map((exercise) => {
    if (exercise.cover !== undefined) {
      return exercise;
    }

    hasMissingCover = true;
    return {
      ...exercise,
      cover: null,
    };
  });

  return hasMissingCover ? { ...state, exercises } : state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseDateKey(value: unknown): Date | null {
  if (!isNonEmptyString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function isValidDateKey(value: unknown): value is string {
  return parseDateKey(value) !== null;
}

function isMondayDateKey(value: unknown): value is string {
  const date = parseDateKey(value);
  return date !== null && date.getDay() === 1;
}

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseClockMinutes(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function isValidDailyStepReminderSettings(
  value: unknown,
): value is DailyStepReminderSettings {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    parseClockMinutes(value.time) !== null
  );
}

export function isValidWaterSettings(value: unknown): value is WaterSettings {
  if (!isRecord(value)) {
    return false;
  }

  const startMinutes = parseClockMinutes(value.startTime);
  const endMinutes = parseClockMinutes(value.endTime);

  return (
    typeof value.enabled === 'boolean' &&
    startMinutes !== null &&
    endMinutes !== null &&
    startMinutes < endMinutes &&
    typeof value.intervalHours === 'number' &&
    Number.isFinite(value.intervalHours) &&
    value.intervalHours > 0 &&
    Number.isSafeInteger(value.intervalHours * 60)
  );
}

function isValidActiveFasting(value: unknown): value is ActiveFasting {
  return isRecord(value) && isValidTimestamp(value.startedAt);
}

function isValidMuscleGroup(value: unknown): value is MuscleGroup {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name)
  );
}

function isValidStrengthSession(value: unknown): value is StrengthSession {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    Array.isArray(value.muscleGroupIds) &&
    value.muscleGroupIds.length > 0 &&
    value.muscleGroupIds.every(isNonEmptyString) &&
    typeof value.completed === 'boolean'
  );
}

function isValidCompletedFasting(value: unknown): value is CompletedFasting {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isValidTimestamp(value.startedAt) ||
    !isValidTimestamp(value.endedAt) ||
    !isNonNegativeSafeInteger(value.durationMinutes)
  ) {
    return false;
  }

  return Date.parse(value.endedAt) >= Date.parse(value.startedAt);
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0)
  );
}

function isValidExerciseAssetUri(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    (value.startsWith('file://') || isBundledExerciseAssetUri(value))
  );
}

function isValidMediaItem(value: unknown): value is MediaItem {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    (value.type === 'image' || value.type === 'video') &&
    isValidExerciseAssetUri(value.uri) &&
    isOptionalNonNegativeNumber(value.width) &&
    isOptionalNonNegativeNumber(value.height) &&
    isOptionalNonNegativeNumber(value.duration)
  );
}

function isValidExerciseCover(value: unknown): value is ExerciseCover {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isValidExerciseAssetUri(value.uri) &&
    isOptionalNonNegativeNumber(value.width) &&
    isOptionalNonNegativeNumber(value.height)
  );
}

function isValidExercise(value: unknown): value is Exercise {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.muscleGroupId) &&
    typeof value.description === 'string' &&
    (value.cover === undefined || value.cover === null || isValidExerciseCover(value.cover)) &&
    Array.isArray(value.media) &&
    value.media.every(isValidMediaItem) &&
    isValidTimestamp(value.createdAt) &&
    isValidTimestamp(value.updatedAt)
  );
}

function isValidDailyRecord(value: unknown): value is DailyRecord {
  return (
    isRecord(value) &&
    isValidDateKey(value.date) &&
    (value.steps === null || isNonNegativeSafeInteger(value.steps)) &&
    isNonNegativeSafeInteger(value.stepGoal)
  );
}

function isValidWeeklyRecord(value: unknown): value is WeeklyRecord {
  if (
    !isRecord(value) ||
    !isMondayDateKey(value.weekStart) ||
    !isNonNegativeSafeInteger(value.strengthGoal) ||
    !Array.isArray(value.strengthSessions) ||
    !value.strengthSessions.every(isValidStrengthSession) ||
    !isNonNegativeSafeInteger(value.hiitGoal) ||
    !isNonNegativeSafeInteger(value.hiitCompleted)
  ) {
    return false;
  }

  return (
    value.strengthGoal === value.strengthSessions.length &&
    value.hiitCompleted <= value.hiitGoal
  );
}

function isValidState(value: unknown): value is AppState {
  if (!isRecord(value)) {
    return false;
  }

  const settings = value.settings;
  const fasting = value.fasting;

  const hasValidShape =
    isRecord(settings) &&
    isNonNegativeSafeInteger(settings.dailyStepGoal) &&
    Array.isArray(settings.strengthSessions) &&
    settings.strengthSessions.length >= 1 &&
    settings.strengthSessions.length <= 7 &&
    settings.strengthSessions.every(isValidStrengthSession) &&
    typeof settings.hiitWeeklyGoal === 'number' &&
    Number.isInteger(settings.hiitWeeklyGoal) &&
    settings.hiitWeeklyGoal >= 0 &&
    typeof settings.fastingGoalHours === 'number' &&
    Number.isInteger(settings.fastingGoalHours) &&
    settings.fastingGoalHours >= MIN_FASTING_GOAL_HOURS &&
    settings.fastingGoalHours <= MAX_FASTING_GOAL_HOURS &&
    isValidWaterSettings(settings.water) &&
    isValidDailyStepReminderSettings(settings.dailyStepReminder) &&
    Array.isArray(value.muscleGroups) &&
    value.muscleGroups.every(isValidMuscleGroup) &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isValidExercise) &&
    isRecord(value.dailyRecords) &&
    Object.entries(value.dailyRecords).every(
      ([dateKey, record]) =>
        isValidDailyRecord(record) && record.date === dateKey,
    ) &&
    isRecord(value.weeklyRecords) &&
    Object.entries(value.weeklyRecords).every(
      ([weekKey, record]) =>
        isValidWeeklyRecord(record) && record.weekStart === weekKey,
    ) &&
    isRecord(fasting) &&
    (fasting.active === null || isValidActiveFasting(fasting.active)) &&
    Array.isArray(fasting.completed) &&
    fasting.completed.every(isValidCompletedFasting);

  if (!hasValidShape) {
    return false;
  }

  const state = value as unknown as AppState;
  const muscleGroupIds = new Set(state.muscleGroups.map((group) => group.id));
  const hasKnownGroups = (session: StrengthSession): boolean =>
    session.muscleGroupIds.every((groupId) => muscleGroupIds.has(groupId));

  const exerciseAssetIds = state.exercises.flatMap((exercise) => [
    ...(exercise.cover ? [exercise.cover.id] : []),
    ...exercise.media.map((mediaItem) => mediaItem.id),
  ]);

  return (
    hasUniqueIds(state.muscleGroups) &&
    hasUniqueIds(state.settings.strengthSessions) &&
    hasUniqueIds(state.exercises) &&
    hasUniqueIds(exerciseAssetIds.map((id) => ({ id }))) &&
    Object.values(state.weeklyRecords).every((week) =>
      hasUniqueIds(week.strengthSessions),
    ) &&
    hasUniqueIds(state.fasting.completed) &&
    state.settings.strengthSessions.every(hasKnownGroups) &&
    state.exercises.every((exercise) => muscleGroupIds.has(exercise.muscleGroupId)) &&
    Object.values(state.weeklyRecords).every((week) =>
      week.strengthSessions.every(hasKnownGroups),
    )
  );
}

function migrateLegacyState(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.settings) || !isRecord(value.weeklyRecords)) {
    return value;
  }

  const settings = value.settings;
  const weeklyRecords = Object.fromEntries(
    Object.entries(value.weeklyRecords).map(([weekStart, week]) => {
      if (!isRecord(week)) {
        return [weekStart, week];
      }

      return [
        weekStart,
        {
          weekStart: week.weekStart,
          strengthGoal: week.strengthGoal,
          strengthSessions: week.strengthSessions,
          hiitGoal: week.hiitGoal ?? week.heatGoal,
          hiitCompleted: week.hiitCompleted ?? week.heatCompleted,
        },
      ];
    }),
  );

  return {
    settings: {
      dailyStepGoal: settings.dailyStepGoal,
      strengthSessions: settings.strengthSessions,
      hiitWeeklyGoal: settings.hiitWeeklyGoal ?? settings.heatWeeklyGoal,
      fastingGoalHours: settings.fastingGoalHours ?? DEFAULT_FASTING_GOAL_HOURS,
      water: settings.water,
      dailyStepReminder: {
        ...DEFAULT_DAILY_STEP_REMINDER_SETTINGS,
        ...(isRecord(settings.dailyStepReminder)
          ? settings.dailyStepReminder
          : {}),
      },
    },
    muscleGroups: value.muscleGroups,
    exercises: value.exercises,
    dailyRecords: value.dailyRecords,
    weeklyRecords,
    fasting: value.fasting,
  };
}

function addDefaultFastingGoal(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.settings)) {
    return value;
  }

  if (value.settings.fastingGoalHours !== undefined) {
    return value;
  }

  return {
    ...value,
    settings: {
      ...value.settings,
      fastingGoalHours: DEFAULT_FASTING_GOAL_HOURS,
    },
  };
}

function addDefaultDailyStepReminder(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.settings)) {
    return value;
  }

  if (value.settings.dailyStepReminder !== undefined) {
    return value;
  }

  return {
    ...value,
    settings: {
      ...value.settings,
      dailyStepReminder: { ...DEFAULT_DAILY_STEP_REMINDER_SETTINGS },
    },
  };
}

interface ParsedPersistedState extends PersistedAppState {
  needsPersistence: boolean;
}

function parsePersistedStateWithMigration(
  rawValue: string,
): ParsedPersistedState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('El almacenamiento contiene datos que no se pueden leer.');
  }

  if (!isRecord(parsed)) {
    throw new Error('La versión de los datos guardados no es compatible.');
  }

  const needsPersistence =
    parsed.schemaVersion === LEGACY_STORAGE_SCHEMA_VERSION ||
    parsed.schemaVersion === FASTING_GOAL_STORAGE_SCHEMA_VERSION ||
    parsed.schemaVersion === PREVIOUS_STORAGE_SCHEMA_VERSION ||
    parsed.schemaVersion === DAILY_STEP_REMINDER_STORAGE_SCHEMA_VERSION;
  const state =
    parsed.schemaVersion === LEGACY_STORAGE_SCHEMA_VERSION
      ? addDefaultDailyStepReminder(migrateLegacyState(parsed.state))
      : parsed.schemaVersion === FASTING_GOAL_STORAGE_SCHEMA_VERSION
        ? addDefaultDailyStepReminder(addDefaultFastingGoal(parsed.state))
        : parsed.schemaVersion === PREVIOUS_STORAGE_SCHEMA_VERSION
          ? addDefaultDailyStepReminder(parsed.state)
          : parsed.schemaVersion === DAILY_STEP_REMINDER_STORAGE_SCHEMA_VERSION
            ? addDefaultDailyStepReminder(parsed.state)
            : parsed.schemaVersion === STORAGE_SCHEMA_VERSION
              ? parsed.state
              : null;

  if (!isValidState(state)) {
    throw new Error('La versión de los datos guardados no es compatible.');
  }

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    state,
    needsPersistence,
  };
}

export function parsePersistedState(rawValue: string): PersistedAppState {
  const parsed = parsePersistedStateWithMigration(rawValue);

  return {
    schemaVersion: parsed.schemaVersion,
    state: parsed.state,
  };
}

export async function saveAppState(
  storage: StorageAdapter,
  state: AppState,
): Promise<void> {
  const payload: PersistedAppState = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    state: discardShortCompletedFastings(state),
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

  const persisted = parsePersistedStateWithMigration(rawValue);
  const migratedState = migrateToFixedMuscleGroupCatalog(
    discardShortCompletedFastings(persisted.state),
  );
  const seededState = persisted.needsPersistence
    ? addMissingDefaultExercises(migratedState, now.toISOString())
    : migratedState;
  const normalizedState = normalizeExerciseCovers(seededState);
  const state = ensureCurrentPeriods(normalizedState, now);

  if (persisted.needsPersistence || state !== persisted.state) {
    await saveAppState(storage, state);
  }

  return state;
}
