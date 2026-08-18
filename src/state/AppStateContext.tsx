import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState as ReactNativeAppState } from 'react-native';

import { calculateFastingDurationMinutes } from '../storage/fasting';
import {
  defaultExerciseMediaAdapter,
  type ExerciseMediaAdapter,
  type ExerciseMediaCopy,
  type ExerciseMediaSelection,
} from '../media/exerciseMedia';
import {
  defaultWaterNotificationAdapter,
  getWaterReminderTimes,
  validateWaterSettings,
  type WaterNotificationAdapter,
  type WaterPermissionStatus,
  type WaterReminderTime,
} from '../notifications/waterNotifications';
import { defaultStorage, type StorageAdapter } from '../storage/appStorage';
import {
  DEFAULT_MUSCLE_GROUPS,
  ensureCurrentPeriods,
  formatDateKey,
  getMondayDateKey,
  loadAppState,
  normalizeEntityName,
  saveAppState,
  type AppState,
  type DailyRecord,
  type ExerciseCover,
  type MediaItem,
  type NewExerciseInput,
  type StrengthSession,
  type StrengthSessionInput,
  type WaterSettings,
  type WeeklyRecord,
} from '../storage/schema';

export type AppLoadStatus = 'loading' | 'ready' | 'error';
export type WaterScheduleStatus = 'inactive' | 'scheduled' | 'error';

type NowProvider = () => Date;

export interface AppStateContextValue {
  state: AppState | null;
  status: AppLoadStatus;
  errorMessage: string | null;
  currentDay: DailyRecord | null;
  currentWeek: WeeklyRecord | null;
  currentTime: Date;
  waterPermissionStatus: WaterPermissionStatus | null;
  waterScheduleStatus: WaterScheduleStatus;
  updateDailySteps(value: number): Promise<void>;
  updateDailyStepGoal(value: number): Promise<void>;
  startFasting(): Promise<void>;
  finishFasting(): Promise<void>;
  setStrengthSessionCompleted(id: string, completed: boolean): Promise<void>;
  markHiitSessionCompleted(): Promise<void>;
  undoHiitSession(): Promise<void>;
  updateHiitWeeklyGoal(value: number): Promise<void>;
  updateStrengthConfiguration(sessions: StrengthSessionInput[]): Promise<void>;
  updateWaterSettings(settings: WaterSettings): Promise<void>;
  pickExerciseCover(): Promise<ExerciseMediaSelection | null>;
  createExercise(
    input: NewExerciseInput,
    coverSelection?: ExerciseMediaSelection,
  ): Promise<void>;
  updateExercise(
    id: string,
    input: NewExerciseInput,
    coverSelection?: ExerciseMediaSelection | null,
  ): Promise<void>;
  setExerciseCover(id: string, selection: ExerciseMediaSelection): Promise<void>;
  removeExerciseCover(id: string): Promise<void>;
  deleteExercise(id: string): Promise<void>;
  addExerciseMedia(id: string): Promise<boolean>;
  removeExerciseMedia(id: string, mediaId: string): Promise<void>;
  retry(): void;
}

export interface AppStateProviderProps extends PropsWithChildren {
  storage?: StorageAdapter;
  now?: NowProvider;
  notifications?: WaterNotificationAdapter;
  media?: ExerciseMediaAdapter;
}

const defaultNow: NowProvider = () => new Date();

function createUniqueId(prefix: string, existingIds: readonly string[]): string {
  let id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  while (existingIds.includes(id)) {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  return id;
}

function getExerciseAssetIds(state: AppState): string[] {
  return state.exercises.flatMap((exercise) => [
    ...(exercise.cover ? [exercise.cover.id] : []),
    ...exercise.media.map((mediaItem) => mediaItem.id),
  ]);
}

function createExerciseCover(
  copy: ExerciseMediaCopy,
  existingAssetIds: readonly string[],
): ExerciseCover {
  if (
    !copy.uri ||
    !copy.uri.startsWith('file://') ||
    copy.type !== 'image'
  ) {
    throw new Error('La copia de portada no devolvió una imagen válida.');
  }

  return {
    id: createUniqueId('cover', existingAssetIds),
    uri: copy.uri,
    width: copy.width,
    height: copy.height,
  };
}

interface CopiedExerciseCover {
  cover: ExerciseCover;
  uri: string;
}

async function cleanupCopiedExerciseCover(
  media: ExerciseMediaAdapter,
  uri: string,
): Promise<void> {
  try {
    await media.deletePrivateCopy(uri);
  } catch {
    // Preserve the original copy or persistence error.
  }
}

async function copyExerciseCover(
  media: ExerciseMediaAdapter,
  selection: ExerciseMediaSelection,
  existingAssetIds: readonly string[],
): Promise<CopiedExerciseCover> {
  const copy = await media.copyToPrivateStorage(selection);

  try {
    return {
      cover: createExerciseCover(copy, existingAssetIds),
      uri: copy.uri,
    };
  } catch (error) {
    if (copy.uri.startsWith('file://')) {
      await cleanupCopiedExerciseCover(media, copy.uri);
    }
    throw error;
  }
}

async function deleteReplacedExerciseCover(
  media: ExerciseMediaAdapter,
  previousCover: ExerciseCover | null | undefined,
  nextUri: string | undefined,
): Promise<void> {
  if (!previousCover || previousCover.uri === nextUri) {
    return;
  }

  try {
    await media.deletePrivateCopy(previousCover.uri);
  } catch (error) {
    throw new Error(
      'La portada se actualizó, pero no se pudo limpiar la portada anterior.',
      { cause: error },
    );
  }
}

function normalizeExerciseInput(
  currentState: AppState,
  input: NewExerciseInput,
): NewExerciseInput {
  const normalizedName = normalizeEntityName(input.name);

  if (!normalizedName) {
    throw new Error('Escribe un nombre para el ejercicio.');
  }

  if (!input.muscleGroupId) {
    throw new Error('Selecciona un grupo muscular.');
  }

  if (!DEFAULT_MUSCLE_GROUPS.some((group) => group.id === input.muscleGroupId)) {
    throw new Error('Selecciona un grupo muscular válido.');
  }

  return {
    name: normalizedName,
    muscleGroupId: input.muscleGroupId,
    description: input.description?.trim() ?? '',
  };
}

function normalizeStrengthConfiguration(
  currentState: AppState,
  sessions: StrengthSessionInput[],
): StrengthSession[] {
  if (sessions.length < 1 || sessions.length > 7) {
    throw new Error('El plan semanal debe tener entre 1 y 7 sesiones.');
  }

  const muscleGroupIds = new Set(DEFAULT_MUSCLE_GROUPS.map((group) => group.id));
  const usedSessionIds = currentState.settings.strengthSessions.map(
    (session) => session.id,
  );

  return sessions.map((session, index) => {
    const normalizedGroupIds = [...new Set(session.muscleGroupIds)];

    if (normalizedGroupIds.length === 0) {
      throw new Error(`Asigna al menos un grupo muscular a la sesión ${index + 1}.`);
    }

    if (normalizedGroupIds.some((id) => !muscleGroupIds.has(id))) {
      throw new Error(`La sesión ${index + 1} contiene un grupo muscular no válido.`);
    }

    const existingSession = currentState.settings.strengthSessions[index];
    const id = existingSession?.id ?? createUniqueId('strength', usedSessionIds);
    if (!usedSessionIds.includes(id)) {
      usedSessionIds.push(id);
    }

    return {
      id,
      name: normalizeEntityName(session.name ?? '') || `Sesión ${index + 1}`,
      muscleGroupIds: normalizedGroupIds,
      completed: false,
    };
  });
}

const WATER_PERMISSION_ERROR =
  'No se concedió el permiso de notificaciones. Actívalo en Ajustes de Android para recibir avisos.';
const WATER_SCHEDULE_ERROR =
  'No se pudieron actualizar los recordatorios de agua. Comprueba los permisos e inténtalo de nuevo.';

async function cancelWaterReminders(
  notifications: WaterNotificationAdapter,
): Promise<void> {
  const identifiers = await notifications.getScheduledWaterReminderIds();
  let firstError: unknown = null;

  for (const identifier of identifiers) {
    try {
      await notifications.cancelWaterReminder(identifier);
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError) {
    throw firstError;
  }
}

async function scheduleWaterReminders(
  notifications: WaterNotificationAdapter,
  times: readonly WaterReminderTime[],
): Promise<void> {
  for (const time of times) {
    await notifications.scheduleWaterReminder(time);
  }
}

async function replaceWaterReminderSchedule(
  notifications: WaterNotificationAdapter,
  settings: WaterSettings,
): Promise<void> {
  await cancelWaterReminders(notifications);
  await scheduleWaterReminders(notifications, getWaterReminderTimes(settings));
}

async function restoreWaterReminderSchedule(
  notifications: WaterNotificationAdapter,
  previousWaterSettings: WaterSettings,
): Promise<boolean> {
  try {
    if (previousWaterSettings.enabled) {
      if ((await notifications.getPermissionStatus()) !== 'granted') {
        await cancelWaterReminders(notifications);
        return false;
      }

      await replaceWaterReminderSchedule(notifications, previousWaterSettings);
    } else {
      await cancelWaterReminders(notifications);
    }
    return true;
  } catch {
    return false;
  }
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  children,
  storage = defaultStorage,
  now = defaultNow,
  notifications = defaultWaterNotificationAdapter,
  media = defaultExerciseMediaAdapter,
}: AppStateProviderProps) {
  const [state, setState] = useState<AppState | null>(null);
  const [status, setStatus] = useState<AppLoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waterPermissionStatus, setWaterPermissionStatus] =
    useState<WaterPermissionStatus | null>(null);
  const [waterScheduleStatus, setWaterScheduleStatus] =
    useState<WaterScheduleStatus>('inactive');
  const [currentTime, setCurrentTime] = useState(() => now());
  const stateRef = useRef<AppState | null>(null);
  const strengthMutationQueueRef = useRef(Promise.resolve());
  const hiitMutationQueueRef = useRef(Promise.resolve());
  const fastingMutationQueueRef = useRef(Promise.resolve());
  const waterMutationQueueRef = useRef(Promise.resolve());
  const exerciseMutationQueueRef = useRef(Promise.resolve());

  const load = useCallback(
    async (isInitialLoad: boolean) => {
      const previousWaterOperation = waterMutationQueueRef.current;
      let releaseWaterLoad!: () => void;
      const waterLoadGate = new Promise<void>((resolve) => {
        releaseWaterLoad = resolve;
      });
      waterMutationQueueRef.current = previousWaterOperation
        .then(() => waterLoadGate)
        .catch(() => undefined);

      if (isInitialLoad) {
        setStatus('loading');
      }

      try {
        const currentDate = now();
        setCurrentTime(currentDate);
        await previousWaterOperation;
        const loadedState = await loadAppState(storage, currentDate);
        let stateToUse = loadedState;
        let permission: WaterPermissionStatus | null = null;
        let waterStatePersistenceFailed = false;
        let waterScheduleFailed = false;
        let nextWaterScheduleStatus: WaterScheduleStatus = 'inactive';

        try {
          permission = await notifications.getPermissionStatus();
          setWaterPermissionStatus(permission);
        } catch {
          // Notification availability must not prevent local data from loading.
          waterScheduleFailed = loadedState.settings.water.enabled;
          if (waterScheduleFailed) {
            nextWaterScheduleStatus = 'error';
          }
        }

        if (loadedState.settings.water.enabled && permission === 'granted') {
          try {
            await notifications.createChannel();
            await replaceWaterReminderSchedule(
              notifications,
              loadedState.settings.water,
            );
            nextWaterScheduleStatus = 'scheduled';
          } catch {
            waterScheduleFailed = true;
            nextWaterScheduleStatus = 'error';
          }
        } else if (
          loadedState.settings.water.enabled &&
          permission !== null
        ) {
          try {
            await cancelWaterReminders(notifications);
          } catch {
            // Do not persist a disabled state while old reminders may still exist.
            waterScheduleFailed = true;
            nextWaterScheduleStatus = 'error';
          }

          if (!waterScheduleFailed) {
            stateToUse = {
              ...loadedState,
              settings: {
                ...loadedState.settings,
                water: {
                  ...loadedState.settings.water,
                  enabled: false,
                },
              },
            };
            try {
              await saveAppState(storage, stateToUse);
            } catch {
              // Permission is not available, so do not re-create the old schedule.
              stateToUse = loadedState;
              waterStatePersistenceFailed = true;
              nextWaterScheduleStatus = 'error';
            }
          }
        } else if (!loadedState.settings.water.enabled) {
          try {
            await cancelWaterReminders(notifications);
          } catch {
            // Clean up stale water reminders without blocking local data loading.
            waterScheduleFailed = true;
            nextWaterScheduleStatus = 'error';
          }
        }

        setWaterScheduleStatus(nextWaterScheduleStatus);
        stateRef.current = stateToUse;
        setState(stateToUse);
        setStatus('ready');
        setErrorMessage(
          waterStatePersistenceFailed
            ? 'No se pudo guardar el cambio. Tus datos anteriores siguen intactos.'
            : waterScheduleFailed
              ? WATER_SCHEDULE_ERROR
              : null,
        );
      } catch {
        setErrorMessage(
          isInitialLoad
            ? 'No se pudieron cargar tus datos. Comprueba el almacenamiento e inténtalo de nuevo.'
            : 'No se pudieron actualizar los periodos actuales. Se conserva el estado anterior.',
        );
        if (isInitialLoad || !stateRef.current) {
          setStatus('error');
        }
      } finally {
        releaseWaterLoad();
      }
    },
    [notifications, now, storage],
  );

  const persistState = useCallback(
    async (nextState: AppState) => {
      try {
        await saveAppState(storage, nextState);
        stateRef.current = nextState;
        setState(nextState);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(
          'No se pudo guardar el cambio. Tus datos anteriores siguen intactos.',
        );
        throw error;
      }
    },
    [storage],
  );

  const startFasting = useCallback(() => {
    const operation = fastingMutationQueueRef.current.then(async () => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      if (currentState.fasting.active) {
        return;
      }

      const currentDate = now();
      await persistState({
        ...currentState,
        fasting: {
          ...currentState.fasting,
          active: { startedAt: currentDate.toISOString() },
        },
      });
      setCurrentTime(currentDate);
    });
    fastingMutationQueueRef.current = operation.catch(() => undefined);
    return operation;
  }, [now, persistState]);

  const finishFasting = useCallback(() => {
    const operation = fastingMutationQueueRef.current.then(async () => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const activeFasting = currentState.fasting.active;
      if (!activeFasting) {
        return;
      }

      const currentDate = now();
      const endedAt = currentDate.toISOString();
      const completedFasting = {
        id: createUniqueId(
          'fasting',
          currentState.fasting.completed.map((fasting) => fasting.id),
        ),
        startedAt: activeFasting.startedAt,
        endedAt,
        durationMinutes: calculateFastingDurationMinutes(
          activeFasting.startedAt,
          endedAt,
        ),
      };

      await persistState({
        ...currentState,
        fasting: {
          active: null,
          completed: [completedFasting, ...currentState.fasting.completed],
        },
      });
      setCurrentTime(currentDate);
    });
    fastingMutationQueueRef.current = operation.catch(() => undefined);
    return operation;
  }, [now, persistState]);

  const setStrengthSessionCompleted = useCallback(
    (id: string, completed: boolean) => {
      const operation = strengthMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const currentDate = now();
        const currentWeekStart = getMondayDateKey(currentDate);
        const stateWithCurrentPeriods = ensureCurrentPeriods(currentState, currentDate);
        const currentWeek = stateWithCurrentPeriods.weeklyRecords[currentWeekStart];

        if (!currentWeek.strengthSessions.some((session) => session.id === id)) {
          throw new Error('No se encontró la sesión de fuerza.');
        }

        await persistState({
          ...stateWithCurrentPeriods,
          weeklyRecords: {
            ...stateWithCurrentPeriods.weeklyRecords,
            [currentWeekStart]: {
              ...currentWeek,
              strengthSessions: currentWeek.strengthSessions.map((session) =>
                session.id === id ? { ...session, completed } : session,
              ),
            },
          },
        });
      });
      strengthMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [now, persistState],
  );

  const updateHiitCompletion = useCallback(
    (delta: number) => {
      const operation = hiitMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const currentDate = now();
        const currentWeekStart = getMondayDateKey(currentDate);
        const stateWithCurrentPeriods = ensureCurrentPeriods(currentState, currentDate);
        const currentWeek = stateWithCurrentPeriods.weeklyRecords[currentWeekStart];
        const hiitCompleted = Math.min(
          Math.max(currentWeek.hiitCompleted + delta, 0),
          currentWeek.hiitGoal,
        );

        await persistState({
          ...stateWithCurrentPeriods,
          weeklyRecords: {
            ...stateWithCurrentPeriods.weeklyRecords,
            [currentWeekStart]: {
              ...currentWeek,
              hiitCompleted,
            },
          },
        });
      });
      hiitMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [now, persistState],
  );

  const markHiitSessionCompleted = useCallback(
    () => updateHiitCompletion(1),
    [updateHiitCompletion],
  );

  const undoHiitSession = useCallback(
    () => updateHiitCompletion(-1),
    [updateHiitCompletion],
  );

  const updateHiitWeeklyGoal = useCallback(
    async (value: number) => {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('El objetivo debe ser un número entero no negativo.');
      }

      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const nextState = ensureCurrentPeriods(
        {
          ...currentState,
          settings: {
            ...currentState.settings,
            hiitWeeklyGoal: value,
          },
        },
        now(),
      );

      await persistState(nextState);
    },
    [now, persistState],
  );

  const updateStrengthConfiguration = useCallback(
    async (sessions: StrengthSessionInput[]) => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const normalizedSessions = normalizeStrengthConfiguration(currentState, sessions);
      const nextState = ensureCurrentPeriods(
        {
          ...currentState,
          settings: {
            ...currentState.settings,
            strengthSessions: normalizedSessions,
          },
        },
        now(),
      );

      await persistState(nextState);
    },
    [now, persistState],
  );

  const updateWaterSettings = useCallback(
    (settings: WaterSettings) => {
      const operation = waterMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        validateWaterSettings(settings);
        const previousWaterSettings = currentState.settings.water;

        if (settings.enabled) {
          let finalPermission: WaterPermissionStatus;
          try {
            await notifications.createChannel();
            const permission = await notifications.getPermissionStatus();
            setWaterPermissionStatus(permission);
            finalPermission =
              permission === 'undetermined'
                ? await notifications.requestPermission()
                : permission;
            setWaterPermissionStatus(finalPermission);
          } catch {
            setWaterScheduleStatus('error');
            throw new Error(WATER_SCHEDULE_ERROR);
          }

          if (finalPermission !== 'granted') {
            try {
              await cancelWaterReminders(notifications);
              await persistState({
                ...currentState,
                settings: {
                  ...currentState.settings,
                  water: {
                    ...settings,
                    enabled: false,
                  },
                },
              });
              setWaterScheduleStatus('inactive');
            } catch (error) {
              // Permission is not available, so never re-create the old schedule.
              setWaterScheduleStatus('error');
              throw new Error(WATER_SCHEDULE_ERROR, { cause: error });
            }

            throw new Error(WATER_PERMISSION_ERROR);
          }
        }

        try {
          if (settings.enabled) {
            await replaceWaterReminderSchedule(notifications, settings);
          } else {
            await cancelWaterReminders(notifications);
          }

          await persistState({
            ...currentState,
            settings: {
              ...currentState.settings,
              water: { ...settings },
            },
          });
          setWaterScheduleStatus(settings.enabled ? 'scheduled' : 'inactive');
        } catch (error) {
          const restored = await restoreWaterReminderSchedule(
            notifications,
            previousWaterSettings,
          );
          setWaterScheduleStatus(
            restored
              ? previousWaterSettings.enabled
                ? 'scheduled'
                : 'inactive'
              : 'error',
          );
          throw new Error(WATER_SCHEDULE_ERROR, { cause: error });
        }
      });
      waterMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [notifications, persistState],
  );

  const pickExerciseCover = useCallback(async () => {
    if (media.selectCover) {
      return media.selectCover();
    }

    const selections = await media.selectMedia();
    return selections.find((selection) => selection.type === 'image') ?? null;
  }, [media]);

  const createExercise = useCallback(
    (input: NewExerciseInput, coverSelection?: ExerciseMediaSelection) => {
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const normalizedInput = normalizeExerciseInput(currentState, input);
        const timestamp = now().toISOString();
        let copiedCover: CopiedExerciseCover | null = null;
        let stateWasPersisted = false;

        try {
          if (coverSelection) {
            copiedCover = await copyExerciseCover(
              media,
              coverSelection,
              getExerciseAssetIds(currentState),
            );
          }

          const nextExercise = {
            id: createUniqueId(
              'exercise',
              currentState.exercises.map((exercise) => exercise.id),
            ),
            name: normalizedInput.name,
            muscleGroupId: normalizedInput.muscleGroupId,
            description: normalizedInput.description ?? '',
            cover: copiedCover?.cover ?? null,
            media: [],
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          await persistState({
            ...currentState,
            exercises: [...currentState.exercises, nextExercise],
          });
          stateWasPersisted = true;
        } catch (error) {
          if (copiedCover && !stateWasPersisted) {
            await cleanupCopiedExerciseCover(media, copiedCover.uri);
          }
          throw error;
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [media, now, persistState],
  );

  const updateExercise = useCallback(
    (
      id: string,
      input: NewExerciseInput,
      coverSelection?: ExerciseMediaSelection | null,
    ) => {
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const existingExercise = currentState.exercises.find(
          (exercise) => exercise.id === id,
        );
        if (!existingExercise) {
          throw new Error('No se encontró el ejercicio.');
        }

        const normalizedInput = normalizeExerciseInput(currentState, input);
        let copiedCover: CopiedExerciseCover | null = null;
        let stateWasPersisted = false;
        let nextCover = existingExercise.cover ?? null;

        try {
          if (coverSelection !== undefined && coverSelection !== null) {
            copiedCover = await copyExerciseCover(
              media,
              coverSelection,
              getExerciseAssetIds(currentState),
            );
            nextCover = copiedCover.cover;
          } else if (coverSelection === null) {
            nextCover = null;
          }

          const updatedExercise = {
            ...existingExercise,
            name: normalizedInput.name,
            muscleGroupId: normalizedInput.muscleGroupId,
            description: normalizedInput.description ?? '',
            cover: nextCover,
            updatedAt: now().toISOString(),
          };

          await persistState({
            ...currentState,
            exercises: currentState.exercises.map((exercise) =>
              exercise.id === id ? updatedExercise : exercise,
            ),
          });
          stateWasPersisted = true;

          if (coverSelection !== undefined) {
            await deleteReplacedExerciseCover(
              media,
              existingExercise.cover,
              nextCover?.uri,
            );
          }
        } catch (error) {
          if (copiedCover && !stateWasPersisted) {
            await cleanupCopiedExerciseCover(media, copiedCover.uri);
          }
          throw error;
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [media, now, persistState],
  );

  const setExerciseCover = useCallback(
    (id: string, selection: ExerciseMediaSelection) => {
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const existingExercise = currentState.exercises.find(
          (exercise) => exercise.id === id,
        );
        if (!existingExercise) {
          throw new Error('No se encontró el ejercicio.');
        }

        let copiedCover: CopiedExerciseCover | null = null;
        let stateWasPersisted = false;

        try {
          copiedCover = await copyExerciseCover(
            media,
            selection,
            getExerciseAssetIds(currentState),
          );

          await persistState({
            ...currentState,
            exercises: currentState.exercises.map((exercise) =>
              exercise.id === id
                ? {
                    ...exercise,
                    cover: copiedCover?.cover ?? null,
                    updatedAt: now().toISOString(),
                  }
                : exercise,
            ),
          });
          stateWasPersisted = true;

          await deleteReplacedExerciseCover(
            media,
            existingExercise.cover,
            copiedCover.cover.uri,
          );
        } catch (error) {
          if (copiedCover && !stateWasPersisted) {
            await cleanupCopiedExerciseCover(media, copiedCover.uri);
          }
          throw error;
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [media, now, persistState],
  );

  const removeExerciseCover = useCallback(
    (id: string) => {
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const existingExercise = currentState.exercises.find(
          (exercise) => exercise.id === id,
        );
        if (!existingExercise) {
          throw new Error('No se encontró el ejercicio.');
        }

        if (!existingExercise.cover) {
          return;
        }

        await persistState({
          ...currentState,
          exercises: currentState.exercises.map((exercise) =>
            exercise.id === id
              ? { ...exercise, cover: null, updatedAt: now().toISOString() }
              : exercise,
          ),
        });

        try {
          await media.deletePrivateCopy(existingExercise.cover.uri);
        } catch (error) {
          throw new Error(
            'La portada se eliminó, pero no se pudo limpiar su copia privada.',
            { cause: error },
          );
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [media, now, persistState],
  );

  const addExerciseMedia = useCallback(
    (id: string) => {
      let mediaWasAdded = false;
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const exercise = currentState.exercises.find((item) => item.id === id);
        if (!exercise) {
          throw new Error('No se encontró el ejercicio.');
        }

        const selections = await media.selectMedia();
        if (selections.length === 0) {
          return;
        }

        const copiedMedia: { copy: ExerciseMediaCopy; uri: string }[] = [];

        try {
          for (const selection of selections) {
            const copy = await media.copyToPrivateStorage(selection);
            if (
              !copy.uri ||
              (copy.type !== 'image' && copy.type !== 'video')
            ) {
              throw new Error('La copia multimedia no devolvió datos válidos.');
            }

            copiedMedia.push({ copy, uri: copy.uri });
          }

          const latestState = stateRef.current;
          const latestExercise = latestState?.exercises.find((item) => item.id === id);
          if (!latestState || !latestExercise) {
            throw new Error('No se encontró el ejercicio.');
          }

          const usedMediaIds = latestState.exercises.flatMap((item) =>
            item.media.map((mediaItem) => mediaItem.id),
          );
          const nextMedia = copiedMedia.map(({ copy }) => {
            const item: MediaItem = {
              id: createUniqueId('media', usedMediaIds),
              type: copy.type,
              uri: copy.uri,
              width: copy.width,
              height: copy.height,
              duration: copy.duration,
            };
            usedMediaIds.push(item.id);
            return item;
          });

          await persistState({
            ...latestState,
            exercises: latestState.exercises.map((item) =>
              item.id === id
                ? {
                    ...item,
                    media: [...item.media, ...nextMedia],
                    updatedAt: now().toISOString(),
                  }
                : item,
            ),
          });
          mediaWasAdded = true;
        } catch (error) {
          await Promise.all(
            copiedMedia.map(async ({ uri }) => {
              try {
                await media.deletePrivateCopy(uri);
              } catch {
                // Preserve the original selection or persistence error.
              }
            }),
          );
          throw error;
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation.then(() => mediaWasAdded);
    },
    [media, now, persistState],
  );

  const removeExerciseMedia = useCallback(
    (id: string, mediaId: string) => {
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const exercise = currentState.exercises.find((item) => item.id === id);
        if (!exercise) {
          throw new Error('No se encontró el ejercicio.');
        }

        const mediaItem = exercise.media.find((item) => item.id === mediaId);
        if (!mediaItem) {
          throw new Error('No se encontró el elemento multimedia.');
        }

        await persistState({
          ...currentState,
          exercises: currentState.exercises.map((item) =>
            item.id === id
              ? {
                  ...item,
                  media: item.media.filter((candidate) => candidate.id !== mediaId),
                  updatedAt: now().toISOString(),
                }
              : item,
          ),
        });

        try {
          await media.deletePrivateCopy(mediaItem.uri);
        } catch (error) {
          throw new Error(
            'La referencia se eliminó, pero no se pudo limpiar la copia privada.',
            { cause: error },
          );
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [media, now, persistState],
  );

  const deleteExercise = useCallback(
    (id: string) => {
      const operation = exerciseMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const exercise = currentState.exercises.find((item) => item.id === id);
        if (!exercise) {
          throw new Error('No se encontró el ejercicio.');
        }

        await persistState({
          ...currentState,
          exercises: currentState.exercises.filter((item) => item.id !== id),
        });

        let cleanupFailed = false;
        const privateCopies = [
          ...(exercise.cover ? [exercise.cover.uri] : []),
          ...exercise.media.map((mediaItem) => mediaItem.uri),
        ];
        for (const uri of new Set(privateCopies)) {
          try {
            await media.deletePrivateCopy(uri);
          } catch {
            cleanupFailed = true;
          }
        }

        if (cleanupFailed) {
          setErrorMessage(
            'El ejercicio se eliminó, pero no se pudieron limpiar todas sus copias multimedia. Puedes revisar el almacenamiento de la aplicación.',
          );
        }
      });
      exerciseMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [media, persistState],
  );

  useEffect(() => {
    // Loading bridges React with the asynchronous local storage adapter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
  }, [load]);

  useEffect(() => {
    const subscription = ReactNativeAppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active' && stateRef.current) {
          void load(false);
        }
      },
    );

    return () => subscription.remove();
  }, [load]);

  const updateDailySteps = useCallback(
    async (value: number) => {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Los pasos deben ser un número entero no negativo.');
      }

      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const currentDate = now();
      const currentDateKey = formatDateKey(currentDate);
      const existingDay = currentState.dailyRecords[currentDateKey];
      const nextDay: DailyRecord = existingDay ?? {
        date: currentDateKey,
        steps: null,
        stepGoal: currentState.settings.dailyStepGoal,
      };
      const nextState = ensureCurrentPeriods(
        {
          ...currentState,
          dailyRecords: {
            ...currentState.dailyRecords,
            [currentDateKey]: {
              ...nextDay,
              steps: value,
            },
          },
        },
        currentDate,
      );

      await persistState(nextState);
    },
    [now, persistState],
  );

  const updateDailyStepGoal = useCallback(
    async (value: number) => {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('El objetivo debe ser un número entero no negativo.');
      }

      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const currentDate = now();
      const currentDateKey = formatDateKey(currentDate);
      const existingDay = currentState.dailyRecords[currentDateKey];
      const nextDay: DailyRecord = existingDay ?? {
        date: currentDateKey,
        steps: null,
        stepGoal: value,
      };
      const nextState = ensureCurrentPeriods(
        {
          ...currentState,
          settings: {
            ...currentState.settings,
            dailyStepGoal: value,
          },
          dailyRecords: {
            ...currentState.dailyRecords,
            [currentDateKey]: {
              ...nextDay,
              stepGoal: value,
            },
          },
        },
        currentDate,
      );

      await persistState(nextState);
    },
    [now, persistState],
  );

  const currentDateKey = state ? formatDateKey(now()) : null;
  const currentWeekStart = state ? getMondayDateKey(now()) : null;
  const contextValue = useMemo<AppStateContextValue>(
    () => ({
      state,
      status,
      errorMessage,
      currentDay: currentDateKey
        ? state?.dailyRecords[currentDateKey] ?? null
        : null,
      currentWeek: currentWeekStart
        ? state?.weeklyRecords[currentWeekStart] ?? null
        : null,
      currentTime,
      waterPermissionStatus,
      waterScheduleStatus,
      updateDailySteps,
      updateDailyStepGoal,
      startFasting,
      finishFasting,
      setStrengthSessionCompleted,
      markHiitSessionCompleted,
      undoHiitSession,
      updateHiitWeeklyGoal,
      updateStrengthConfiguration,
      updateWaterSettings,
      pickExerciseCover,
      createExercise,
      updateExercise,
      setExerciseCover,
      removeExerciseCover,
      deleteExercise,
      addExerciseMedia,
      removeExerciseMedia,
      retry: () => {
        void load(true);
      },
    }),
    [
      currentDateKey,
      currentTime,
      currentWeekStart,
      addExerciseMedia,
      createExercise,
      deleteExercise,
      errorMessage,
      pickExerciseCover,
      removeExerciseCover,
      setExerciseCover,
      load,
      markHiitSessionCompleted,
      state,
      status,
      startFasting,
      finishFasting,
      setStrengthSessionCompleted,
      undoHiitSession,
      updateDailySteps,
      updateDailyStepGoal,
      updateExercise,
      updateHiitWeeklyGoal,
      removeExerciseMedia,
      updateStrengthConfiguration,
      updateWaterSettings,
      waterPermissionStatus,
      waterScheduleStatus,
    ],
  );

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState debe usarse dentro de AppStateProvider.');
  }

  return context;
}

export type { AppState };
