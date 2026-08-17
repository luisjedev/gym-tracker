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
  type NewExerciseInput,
  type DailyRecord,
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
  updateDailyStepGoal(value: number): Promise<void>;
  createMuscleGroup(name: string): Promise<void>;
  createExercise(input: NewExerciseInput): Promise<void>;
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

  const createExercise = useCallback(
    async (input: NewExerciseInput) => {
      const normalizedName = normalizeEntityName(input.name);
      const description = input.description?.trim() ?? '';

      if (!normalizedName) {
        throw new Error('Escribe un nombre para el ejercicio.');
      }

      if (!input.muscleGroupId) {
        throw new Error('Selecciona un grupo muscular.');
      }

      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      if (!currentState.muscleGroups.some((group) => group.id === input.muscleGroupId)) {
        throw new Error('Selecciona un grupo muscular válido.');
      }

      const timestamp = now().toISOString();
      const nextExercise = {
        id: createUniqueId(
          'exercise',
          currentState.exercises.map((exercise) => exercise.id),
        ),
        name: normalizedName,
        muscleGroupId: input.muscleGroupId,
        description,
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

  const updateDailyStepGoal = useCallback(
    async (value: number) => {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('El objetivo debe ser un número entero no negativo.');
      }

      const currentState = stateRef.current;
      if (!currentState) {
        throw new Error('Los datos todavía se están cargando.');
      }

      const currentDateKey = formatDateKey(now());
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
        now(),
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
      updateDailyStepGoal,
      createMuscleGroup,
      createExercise,
      retry: () => {
        void load(true);
      },
    }),
    [
      currentDateKey,
      currentWeekStart,
      createExercise,
      createMuscleGroup,
      errorMessage,
      load,
      state,
      status,
      updateDailyStepGoal,
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
