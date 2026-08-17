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

import { defaultStorage, type StorageAdapter } from '../storage/appStorage';
import {
  ensureCurrentPeriods,
  formatDateKey,
  getMondayDateKey,
  loadAppState,
  namesMatch,
  normalizeEntityName,
  saveAppState,
  type AppState,
  type DailyRecord,
  type NewExerciseInput,
  type StrengthSession,
  type StrengthSessionInput,
  type WeeklyRecord,
} from '../storage/schema';

export type AppLoadStatus = 'loading' | 'ready' | 'error';

type NowProvider = () => Date;

export interface AppStateContextValue {
  state: AppState | null;
  status: AppLoadStatus;
  errorMessage: string | null;
  currentDay: DailyRecord | null;
  currentWeek: WeeklyRecord | null;
  updateDailySteps(value: number): Promise<void>;
  updateDailyStepGoal(value: number): Promise<void>;
  setStrengthSessionCompleted(id: string, completed: boolean): Promise<void>;
  markHeatSessionCompleted(): Promise<void>;
  undoHeatSession(): Promise<void>;
  updateHeatWeeklyGoal(value: number): Promise<void>;
  updateStrengthConfiguration(sessions: StrengthSessionInput[]): Promise<void>;
  createMuscleGroup(name: string): Promise<void>;
  updateMuscleGroup(id: string, name: string): Promise<void>;
  deleteMuscleGroup(id: string): Promise<void>;
  createExercise(input: NewExerciseInput): Promise<void>;
  updateExercise(id: string, input: NewExerciseInput): Promise<void>;
  deleteExercise(id: string): Promise<void>;
  retry(): void;
}

export interface AppStateProviderProps extends PropsWithChildren {
  storage?: StorageAdapter;
  now?: NowProvider;
}

const defaultNow: NowProvider = () => new Date();

function createUniqueId(prefix: string, existingIds: readonly string[]): string {
  let id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  while (existingIds.includes(id)) {
    id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  return id;
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

  if (!currentState.muscleGroups.some((group) => group.id === input.muscleGroupId)) {
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

  const muscleGroupIds = new Set(currentState.muscleGroups.map((group) => group.id));
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

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  children,
  storage = defaultStorage,
  now = defaultNow,
}: AppStateProviderProps) {
  const [state, setState] = useState<AppState | null>(null);
  const [status, setStatus] = useState<AppLoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const strengthMutationQueueRef = useRef(Promise.resolve());
  const heatMutationQueueRef = useRef(Promise.resolve());

  const load = useCallback(
    async (isInitialLoad: boolean) => {
      if (isInitialLoad) {
        setStatus('loading');
      }

      try {
        const loadedState = await loadAppState(storage, now());
        stateRef.current = loadedState;
        setState(loadedState);
        setStatus('ready');
        setErrorMessage(null);
      } catch {
        setErrorMessage(
          isInitialLoad
            ? 'No se pudieron cargar tus datos. Comprueba el almacenamiento e inténtalo de nuevo.'
            : 'No se pudieron actualizar los periodos actuales. Se conserva el estado anterior.',
        );
        if (isInitialLoad || !stateRef.current) {
          setStatus('error');
        }
      }
    },
    [now, storage],
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

  const updateHeatCompletion = useCallback(
    (delta: number) => {
      const operation = heatMutationQueueRef.current.then(async () => {
        const currentState = stateRef.current;
        if (!currentState) {
          throw new Error('Los datos todavía se están cargando.');
        }

        const currentDate = now();
        const currentWeekStart = getMondayDateKey(currentDate);
        const stateWithCurrentPeriods = ensureCurrentPeriods(currentState, currentDate);
        const currentWeek = stateWithCurrentPeriods.weeklyRecords[currentWeekStart];
        const heatCompleted = Math.min(
          Math.max(currentWeek.heatCompleted + delta, 0),
          currentWeek.heatGoal,
        );

        await persistState({
          ...stateWithCurrentPeriods,
          weeklyRecords: {
            ...stateWithCurrentPeriods.weeklyRecords,
            [currentWeekStart]: {
              ...currentWeek,
              heatCompleted,
            },
          },
        });
      });
      heatMutationQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [now, persistState],
  );

  const markHeatSessionCompleted = useCallback(
    () => updateHeatCompletion(1),
    [updateHeatCompletion],
  );

  const undoHeatSession = useCallback(
    () => updateHeatCompletion(-1),
    [updateHeatCompletion],
  );

  const updateHeatWeeklyGoal = useCallback(
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
            heatWeeklyGoal: value,
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

  const createMuscleGroup = useCallback(
    async (name: string) => {
      const normalizedName = normalizeEntityName(name);

      if (!normalizedName) {
        throw new Error('Escribe un nombre para el grupo muscular.');
      }

      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      if (
        currentState.muscleGroups.some((group) =>
          namesMatch(group.name, normalizedName),
        )
      ) {
        throw new Error('Ya existe un grupo muscular con ese nombre.');
      }

      const nextGroup = {
        id: createUniqueId(
          'group',
          currentState.muscleGroups.map((group) => group.id),
        ),
        name: normalizedName,
      };

      await persistState({
        ...currentState,
        muscleGroups: [...currentState.muscleGroups, nextGroup],
      });
    },
    [persistState],
  );

  const updateMuscleGroup = useCallback(
    async (id: string, name: string) => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      if (!currentState.muscleGroups.some((group) => group.id === id)) {
        throw new Error('No se encontró el grupo muscular.');
      }

      const normalizedName = normalizeEntityName(name);
      if (!normalizedName) {
        throw new Error('Escribe un nombre para el grupo muscular.');
      }

      if (
        currentState.muscleGroups.some(
          (group) => group.id !== id && namesMatch(group.name, normalizedName),
        )
      ) {
        throw new Error('Ya existe un grupo muscular con ese nombre.');
      }

      await persistState({
        ...currentState,
        muscleGroups: currentState.muscleGroups.map((group) =>
          group.id === id ? { ...group, name: normalizedName } : group,
        ),
      });
    },
    [persistState],
  );

  const deleteMuscleGroup = useCallback(
    async (id: string) => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      if (!currentState.muscleGroups.some((group) => group.id === id)) {
        throw new Error('No se encontró el grupo muscular.');
      }

      const usedByExercise = currentState.exercises.some(
        (exercise) => exercise.muscleGroupId === id,
      );
      const usedByPlan =
        currentState.settings.strengthSessions.some((session) =>
          session.muscleGroupIds.includes(id),
        ) ||
        Object.values(currentState.weeklyRecords).some((week) =>
          week.strengthSessions.some((session) => session.muscleGroupIds.includes(id)),
        );

      if (usedByExercise && usedByPlan) {
        throw new Error(
          'No se puede eliminar el grupo muscular porque está usado por ejercicios y por la planificación semanal.',
        );
      }

      if (usedByExercise) {
        throw new Error(
          'No se puede eliminar el grupo muscular porque está usado por un ejercicio.',
        );
      }

      if (usedByPlan) {
        throw new Error(
          'No se puede eliminar el grupo muscular porque está usado por la planificación semanal.',
        );
      }

      await persistState({
        ...currentState,
        muscleGroups: currentState.muscleGroups.filter((group) => group.id !== id),
      });
    },
    [persistState],
  );

  const createExercise = useCallback(
    async (input: NewExerciseInput) => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const normalizedInput = normalizeExerciseInput(currentState, input);
      const timestamp = now().toISOString();
      const nextExercise = {
        id: createUniqueId(
          'exercise',
          currentState.exercises.map((exercise) => exercise.id),
        ),
        name: normalizedInput.name,
        muscleGroupId: normalizedInput.muscleGroupId,
        description: normalizedInput.description ?? '',
        media: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await persistState({
        ...currentState,
        exercises: [...currentState.exercises, nextExercise],
      });
    },
    [now, persistState],
  );

  const updateExercise = useCallback(
    async (id: string, input: NewExerciseInput) => {
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
      const updatedExercise = {
        ...existingExercise,
        name: normalizedInput.name,
        muscleGroupId: normalizedInput.muscleGroupId,
        description: normalizedInput.description ?? '',
        updatedAt: now().toISOString(),
      };

      await persistState({
        ...currentState,
        exercises: currentState.exercises.map((exercise) =>
          exercise.id === id ? updatedExercise : exercise,
        ),
      });
    },
    [now, persistState],
  );

  const deleteExercise = useCallback(
    async (id: string) => {
      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      if (!currentState.exercises.some((exercise) => exercise.id === id)) {
        throw new Error('No se encontró el ejercicio.');
      }

      await persistState({
        ...currentState,
        exercises: currentState.exercises.filter((exercise) => exercise.id !== id),
      });
    },
    [persistState],
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
      updateDailySteps,
      updateDailyStepGoal,
      setStrengthSessionCompleted,
      markHeatSessionCompleted,
      undoHeatSession,
      updateHeatWeeklyGoal,
      updateStrengthConfiguration,
      createMuscleGroup,
      updateMuscleGroup,
      deleteMuscleGroup,
      createExercise,
      updateExercise,
      deleteExercise,
      retry: () => {
        void load(true);
      },
    }),
    [
      currentDateKey,
      currentWeekStart,
      createExercise,
      createMuscleGroup,
      deleteExercise,
      deleteMuscleGroup,
      errorMessage,
      load,
      markHeatSessionCompleted,
      state,
      status,
      setStrengthSessionCompleted,
      undoHeatSession,
      updateDailySteps,
      updateDailyStepGoal,
      updateExercise,
      updateHeatWeeklyGoal,
      updateStrengthConfiguration,
      updateMuscleGroup,
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
