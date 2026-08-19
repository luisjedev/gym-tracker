import {
  DEFAULT_DAILY_STEP_GOAL,
  DEFAULT_DAILY_STEP_REMINDER_SETTINGS,
  DEFAULT_FASTING_GOAL_HOURS,
  DEFAULT_HIIT_WEEKLY_GOAL,
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_STRENGTH_SESSIONS,
  DEFAULT_WATER_SETTINGS,
  createDefaultState,
  formatDateKey,
  getMondayDateKey,
  loadAppState,
  saveAppState,
  STORAGE_SCHEMA_VERSION,
} from './schema';
import type { StorageAdapter } from './appStorage';

class MemoryStorage implements StorageAdapter {
  value: string | null = null;
  writes = 0;

  async getItem() {
    return this.value;
  }

  async setItem(_key: string, value: string) {
    this.value = value;
    this.writes += 1;
  }
}

async function createPersistedFixture(now: Date) {
  const storage = new MemoryStorage();
  await saveAppState(storage, createDefaultState(now));
  return {
    payload: JSON.parse(storage.value ?? '{}'),
    storage,
  };
}

describe('versioned local app state', () => {
  it('creates the documented defaults and persists the current schema version', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();

    const state = await loadAppState(storage, now);
    const payload = JSON.parse(storage.value ?? '{}');

    expect(payload.schemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    expect(state.settings.dailyStepGoal).toBe(DEFAULT_DAILY_STEP_GOAL);
    expect(state.settings.strengthSessions).toEqual(DEFAULT_STRENGTH_SESSIONS);
    expect(state.settings.hiitWeeklyGoal).toBe(DEFAULT_HIIT_WEEKLY_GOAL);
    expect(state.settings.fastingGoalHours).toBe(DEFAULT_FASTING_GOAL_HOURS);
    expect(state.settings.water).toEqual(DEFAULT_WATER_SETTINGS);
    expect(state.settings.dailyStepReminder).toEqual(
      DEFAULT_DAILY_STEP_REMINDER_SETTINGS,
    );
    expect(state.muscleGroups).toEqual(DEFAULT_MUSCLE_GROUPS);
    expect(state.dailyRecords[formatDateKey(now)]).toEqual({
      date: formatDateKey(now),
      steps: null,
      stepGoal: DEFAULT_DAILY_STEP_GOAL,
    });
    expect(state.weeklyRecords[getMondayDateKey(now)].strengthGoal).toBe(3);
  });

  it('rejects invalid daily values instead of hydrating them as saved data', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.state.dailyRecords[formatDateKey(now)].steps = -1;
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('migrates schema version one HEAT data to the current HIIT shape', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    const legacyState = JSON.parse(JSON.stringify(createDefaultState(now)));
    const weekStart = getMondayDateKey(now);

    legacyState.settings.hiitWeeklyGoal = 3;
    legacyState.settings.heatWeeklyGoal = legacyState.settings.hiitWeeklyGoal;
    delete legacyState.settings.hiitWeeklyGoal;
    legacyState.weeklyRecords[weekStart].hiitGoal = 3;
    legacyState.weeklyRecords[weekStart].hiitCompleted = 2;
    legacyState.weeklyRecords[weekStart].heatGoal =
      legacyState.weeklyRecords[weekStart].hiitGoal;
    legacyState.weeklyRecords[weekStart].heatCompleted =
      legacyState.weeklyRecords[weekStart].hiitCompleted;
    delete legacyState.weeklyRecords[weekStart].hiitGoal;
    delete legacyState.weeklyRecords[weekStart].hiitCompleted;
    storage.value = JSON.stringify({ schemaVersion: 1, state: legacyState });

    const migrated = await loadAppState(storage, now);

    expect(migrated.settings.hiitWeeklyGoal).toBe(3);
    expect(migrated.weeklyRecords[weekStart].hiitGoal).toBe(3);
    expect(migrated.weeklyRecords[weekStart].hiitCompleted).toBe(2);
    expect(JSON.parse(storage.value ?? '{}').schemaVersion).toBe(
      STORAGE_SCHEMA_VERSION,
    );
  });

  it('adds the fasting goal when migrating a schema version two snapshot', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    const state = createDefaultState(now);
    await saveAppState(storage, state);

    const payload = JSON.parse(storage.value ?? '{}');
    payload.schemaVersion = 2;
    delete payload.state.settings.fastingGoalHours;
    storage.value = JSON.stringify(payload);

    const migrated = await loadAppState(storage, now);

    expect(migrated.settings.fastingGoalHours).toBe(DEFAULT_FASTING_GOAL_HOURS);
    expect(JSON.parse(storage.value ?? '{}').schemaVersion).toBe(
      STORAGE_SCHEMA_VERSION,
    );
  });

  it('adds the disabled daily step reminder when migrating the previous schema', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.schemaVersion = 4;
    delete payload.state.settings.dailyStepReminder;
    storage.value = JSON.stringify(payload);

    const migrated = await loadAppState(storage, now);

    expect(migrated.settings.dailyStepReminder).toEqual(
      DEFAULT_DAILY_STEP_REMINDER_SETTINGS,
    );
    expect(JSON.parse(storage.value ?? '{}').schemaVersion).toBe(
      STORAGE_SCHEMA_VERSION,
    );
  });

  it('hydrates an existing snapshot without writing over it again', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    const original = createDefaultState(now);
    original.settings.dailyStepGoal = 8_000;
    await saveAppState(storage, original);
    const writesBeforeHydration = storage.writes;

    const hydrated = await loadAppState(storage, now);

    expect(hydrated.settings.dailyStepGoal).toBe(8_000);
    expect(storage.writes).toBe(writesBeforeHydration);
  });

  it('migrates the previous muscle-group snapshot to the fixed catalog', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    const legacy = createDefaultState(now);
    legacy.muscleGroups = legacy.muscleGroups
      .filter((group) => group.id !== 'antebrazos')
      .map((group) => (group.id === 'hombro' ? { ...group, name: 'Hombro' } : group));
    legacy.exercises = [
      {
        id: 'exercise-legacy-shoulder',
        name: 'Press militar',
        muscleGroupId: 'hombro',
        description: '',
        media: [],
        createdAt: '2026-08-17T10:00:00.000Z',
        updatedAt: '2026-08-17T10:00:00.000Z',
      },
    ];
    await saveAppState(storage, legacy);

    const migrated = await loadAppState(storage, now);

    expect(migrated.muscleGroups).toEqual(DEFAULT_MUSCLE_GROUPS);
    expect(migrated.exercises[0].muscleGroupId).toBe('hombro');
    expect(migrated.exercises[0].cover).toBeNull();
    expect(storage.writes).toBe(2);
  });

  it('rejects a weekly HIIT snapshot that exceeds its saved goal', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    const weekStart = getMondayDateKey(now);
    payload.state.weeklyRecords[weekStart].hiitCompleted = 2;
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects water settings that cannot be scheduled', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.state.settings.water.endTime = '07:00';
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects fasting records without valid timestamps or durations', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.state.fasting.active = { startedAt: 'not-a-date' };
    payload.state.fasting.completed = [
      {
        id: 'fasting-1',
        startedAt: '2026-08-17T10:00:00.000Z',
        endedAt: '2026-08-17T09:00:00.000Z',
        durationMinutes: -1,
      },
    ];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('discards persisted completed fastings shorter than eight hours', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.fasting.completed = [
      {
        id: 'fasting-short',
        startedAt: '2026-08-17T08:00:00.000Z',
        endedAt: '2026-08-17T15:00:00.000Z',
        durationMinutes: 420,
      },
    ];
    storage.value = JSON.stringify(payload);

    const loaded = await loadAppState(storage, now);

    expect(loaded.fasting.completed).toEqual([]);
    expect(JSON.parse(storage.value ?? '{}').state.fasting.completed).toEqual([]);
  });

  it('rejects persisted strength settings without assigned muscle groups', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.settings.strengthSessions[0].muscleGroupIds = [];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects persisted strength snapshots with malformed sessions', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.weeklyRecords[getMondayDateKey(now)].strengthSessions[0].completed =
      'yes';
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects persisted strength snapshots that reference an unknown group', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.weeklyRecords[getMondayDateKey(now)].strengthSessions[0].muscleGroupIds = [
      'missing-group',
    ];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects persisted weekly strength goals that disagree with their sessions', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.weeklyRecords[getMondayDateKey(now)].strengthGoal = 2;
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects duplicate persisted entity identifiers', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.exercises = [
      {
        id: 'exercise-1',
        name: 'Sentadilla',
        muscleGroupId: 'piernas',
        description: '',
        media: [],
        createdAt: '2026-08-17T10:00:00.000Z',
        updatedAt: '2026-08-17T10:00:00.000Z',
      },
      {
        id: 'exercise-1',
        name: 'Press banca',
        muscleGroupId: 'pecho',
        description: '',
        media: [],
        createdAt: '2026-08-17T10:00:00.000Z',
        updatedAt: '2026-08-17T10:00:00.000Z',
      },
    ];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects daily records whose date does not match their storage key', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    payload.state.dailyRecords[formatDateKey(now)].date = '2026-08-16';
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects weekly records that do not start on a Monday', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const { payload, storage } = await createPersistedFixture(now);
    const monday = getMondayDateKey(now);
    const sunday = '2026-08-16';
    payload.state.weeklyRecords[sunday] = {
      ...payload.state.weeklyRecords[monday],
      weekStart: sunday,
    };
    delete payload.state.weeklyRecords[monday];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('persists an independent exercise cover and keeps it when reloading', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    const state = createDefaultState(now);
    state.exercises = [
      {
        id: 'exercise-1',
        name: 'Sentadilla',
        muscleGroupId: 'piernas',
        description: '',
        cover: {
          id: 'cover-1',
          uri: 'file:///private/cover.jpg',
          width: 1200,
          height: 800,
        },
        media: [
          {
            id: 'media-1',
            type: 'image',
            uri: 'file:///private/detail.jpg',
          },
        ],
        createdAt: '2026-08-17T10:00:00.000Z',
        updatedAt: '2026-08-17T10:00:00.000Z',
      },
    ];

    await saveAppState(storage, state);
    const loaded = await loadAppState(storage, now);

    expect(loaded.exercises[0].cover).toEqual({
      id: 'cover-1',
      uri: 'file:///private/cover.jpg',
      width: 1200,
      height: 800,
    });
    expect(loaded.exercises[0].media).toHaveLength(1);
  });

  it('rejects persisted exercise covers without a private URI', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.state.exercises = [
      {
        id: 'exercise-1',
        name: 'Sentadilla',
        muscleGroupId: 'piernas',
        description: '',
        cover: {
          id: 'cover-1',
          uri: 'content://picked/cover.jpg',
        },
        media: [],
        createdAt: '2026-08-17T10:00:00.000Z',
        updatedAt: '2026-08-17T10:00:00.000Z',
      },
    ];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });

  it('rejects persisted exercise media without a private URI', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.state.exercises = [
      {
        id: 'exercise-1',
        name: 'Sentadilla',
        muscleGroupId: 'piernas',
        description: '',
        media: [
          {
            id: 'media-1',
            type: 'image',
            uri: 'content://picked/routine.jpg',
          },
        ],
        createdAt: '2026-08-17T10:00:00.000Z',
        updatedAt: '2026-08-17T10:00:00.000Z',
      },
    ];
    storage.value = JSON.stringify(payload);

    await expect(loadAppState(storage, now)).rejects.toThrow(
      'La versión de los datos guardados no es compatible.',
    );
  });
});
