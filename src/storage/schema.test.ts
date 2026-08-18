import {
  DEFAULT_DAILY_STEP_GOAL,
  DEFAULT_HEAT_WEEKLY_GOAL,
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

describe('versioned local app state', () => {
  it('creates the documented defaults and persists schema version one', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();

    const state = await loadAppState(storage, now);
    const payload = JSON.parse(storage.value ?? '{}');

    expect(payload.schemaVersion).toBe(STORAGE_SCHEMA_VERSION);
    expect(state.settings.dailyStepGoal).toBe(DEFAULT_DAILY_STEP_GOAL);
    expect(state.settings.strengthSessions).toEqual(DEFAULT_STRENGTH_SESSIONS);
    expect(state.settings.heatWeeklyGoal).toBe(DEFAULT_HEAT_WEEKLY_GOAL);
    expect(state.settings.water).toEqual(DEFAULT_WATER_SETTINGS);
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

  it('rejects a weekly HEAT snapshot that exceeds its saved goal', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    const weekStart = getMondayDateKey(now);
    payload.state.weeklyRecords[weekStart].heatCompleted = 2;
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

  it('rejects persisted strength snapshots with malformed sessions', async () => {
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const storage = new MemoryStorage();
    await saveAppState(storage, createDefaultState(now));

    const payload = JSON.parse(storage.value ?? '{}');
    payload.state.settings.strengthSessions[0].completed = 'yes';
    payload.state.weeklyRecords[getMondayDateKey(now)].strengthSessions[0].muscleGroupIds = [
      null,
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
            uri: '',
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
