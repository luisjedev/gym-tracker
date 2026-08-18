import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState } from 'react-native';

import App from '../App';
import type { WaterNotificationAdapter, WaterPermissionStatus, WaterReminderTime } from './notifications/waterNotifications';
import type { StorageAdapter } from './storage/appStorage';
import { createDefaultState, saveAppState } from './storage/schema';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;

  async getItem(key: string) {
    if (this.failReads) {
      throw new Error('read failed');
    }

    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    if (this.failWrites) {
      throw new Error('write failed');
    }

    this.values.set(key, value);
  }
}

class ControlledWaterNotifications implements WaterNotificationAdapter {
  permission: WaterPermissionStatus = 'undetermined';
  permissionAfterRequest: WaterPermissionStatus | null = null;
  permissionRequests = 0;
  channelCreations = 0;
  readonly scheduled = new Map<string, WaterReminderTime>();
  readonly allScheduledIds = new Set(['foreign-reminder']);
  readonly cancelled: string[] = [];
  readonly foreignIds = new Set(['foreign-reminder']);
  foreignCancellationAttempts = 0;
  failCancellations = false;
  failCancellationId: string | null = null;
  failScheduling = false;
  private nextId = 1;

  async getPermissionStatus() {
    return this.permission;
  }

  async requestPermission() {
    this.permissionRequests += 1;
    const result = this.permissionAfterRequest ?? this.permission;
    this.permission = result;
    return result;
  }

  async createChannel() {
    this.channelCreations += 1;
  }

  async getScheduledWaterReminderIds() {
    return [...this.scheduled.keys()];
  }

  async scheduleWaterReminder(time: WaterReminderTime) {
    if (this.failScheduling) {
      throw new Error('schedule failed');
    }

    const id = `water-${this.nextId}`;
    this.nextId += 1;
    this.scheduled.set(id, time);
    this.allScheduledIds.add(id);
    return id;
  }

  async cancelWaterReminder(id: string) {
    if (this.failCancellations || id === this.failCancellationId) {
      throw new Error('cancel failed');
    }

    if (this.foreignIds.has(id)) {
      this.foreignCancellationAttempts += 1;
      return;
    }

    this.cancelled.push(id);
    this.scheduled.delete(id);
    this.allScheduledIds.delete(id);
  }
}

describe('Gym Tracker app flow', () => {
  it('opens Inicio, navigates through the four sections, persists a setting, and rehydrates it', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 12, 0, 0);

    const firstRender = await render(<App storage={storage} now={() => now} />);

    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    expect(screen.getByText('Objetivo: 7.000 pasos')).toBeTruthy();
    expect(screen.getByText('0 / 3 sesiones')).toBeTruthy();
    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() => expect(screen.getByText('Pecho')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Aún no hay historial')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('daily-step-goal-input')).toBeTruthy(),
    );
    await fireEvent.changeText(screen.getByTestId('daily-step-goal-input'), '8000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar objetivo' }));

    await waitFor(() => expect(screen.getByText('Objetivo guardado')).toBeTruthy());
    await firstRender.unmount();

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Objetivo: 8.000 pasos')).toBeTruthy());
  });

  it('shows the home progress dashboard, caps visual percentages, and keeps water in settings only', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 12, 0, 0);
    const state = createDefaultState(now);
    const today = Object.values(state.dailyRecords)[0];
    const week = Object.values(state.weeklyRecords)[0];

    today.steps = 10_000;
    week.strengthSessions = week.strengthSessions.map((session, index) => ({
      ...session,
      completed: index === 0,
    }));
    await saveAppState(storage, state);

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    expect(screen.getByTestId('home-daily-progress').props.accessibilityValue).toMatchObject({
      min: 0,
      max: 100,
      now: 100,
    });
    expect(screen.getByTestId('home-strength-progress').props.accessibilityValue).toMatchObject({
      min: 0,
      max: 100,
      now: 33,
    });
    expect(screen.getByTestId('home-hiit-progress').props.accessibilityValue).toMatchObject({
      min: 0,
      max: 100,
      now: 0,
    });
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByText('10.000 / 7.000 pasos')).toBeTruthy();
    expect(screen.getByText('1 / 3 sesiones')).toBeTruthy();
    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();
    expect(screen.queryByTestId('home-water-card')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() => expect(screen.getByText('Recordatorios de agua')).toBeTruthy());
    expect(screen.getByTestId('water-enabled-switch')).toBeTruthy();
  });

  it('shows an empty history and keeps navigation available before any activity', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17, 12)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Aún no hay historial')).toBeTruthy());
    expect(
      screen.getByText(
        'Cuando registres pasos, entrenamientos o ayunos, aparecerán aquí sin borrar los periodos anteriores.',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
  });

  it('lists recent days newest first without inventing totals for an empty day', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 16, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '8000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    await waitFor(() => expect(screen.getByText('8.000 / 7.000 pasos')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Historial de días')).toBeTruthy());

    expect(
      screen.getAllByTestId(/history-day-header-/).map((header) => header.props.children),
    ).toEqual(['17/08/2026', '16/08/2026']);
    expect(screen.getByText('Sin pasos registrados')).toBeTruthy();
    expect(screen.queryByText('0 pasos')).toBeNull();
    expect(screen.getByText('8.000 pasos')).toBeTruthy();
    expect(screen.getAllByText('Objetivo guardado: 7.000 pasos')).toHaveLength(2);
    expect(screen.getByText('Objetivo alcanzado')).toBeTruthy();

    await rendered.unmount();
    await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('8.000 pasos')).toBeTruthy());
  });

  it('keeps the saved goal and compliance for earlier days after changing today\'s goal', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 16, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '6500');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    await waitFor(() => expect(screen.getByText('6.500 / 7.000 pasos')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent.changeText(screen.getByTestId('daily-step-goal-input'), '6000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar objetivo' }));
    await waitFor(() => expect(screen.getByText('Objetivo guardado')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('0 / 6.000 pasos')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '6000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    await waitFor(() => expect(screen.getByText('6.000 / 6.000 pasos')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Historial de días')).toBeTruthy());

    expect(screen.getByText('6.500 pasos')).toBeTruthy();
    expect(screen.getByText('Objetivo guardado: 7.000 pasos')).toBeTruthy();
    expect(screen.getByText('Objetivo no alcanzado')).toBeTruthy();
    expect(screen.getByText('Objetivo guardado: 6.000 pasos')).toBeTruthy();
    expect(screen.getAllByText('Objetivo alcanzado')).toHaveLength(1);

    await rendered.unmount();
    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    await render(<App storage={storage} now={now} />);
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Objetivo no alcanzado')).toBeTruthy());
  });

  it('shows an active fast separately and preserves a completed fast across midnight', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 16, 22, 30, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    expect(screen.getByText('Aún no hay ayunos finalizados')).toBeTruthy();
    expect(screen.queryByText('Ayuno finalizado')).toBeNull();
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 0, 30, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar ayuno' }));
    await waitFor(() => expect(screen.getByText('No hay un ayuno activo.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Ayunos finalizados')).toBeTruthy());

    expect(screen.getByText('Ayuno finalizado')).toBeTruthy();
    expect(screen.getByText('Inicio: 16/08/2026, 22:30')).toBeTruthy();
    expect(screen.getByText('Fin: 17/08/2026, 00:30')).toBeTruthy();
    expect(screen.getByText('Duración: 2 h 0 min')).toBeTruthy();
    expect(screen.queryByText('Ayuno activo')).toBeNull();

    await rendered.unmount();
    await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Inicio: 16/08/2026, 22:30')).toBeTruthy());
  });

  it('records, replaces, and persists today\'s steps while showing progress', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 12, 0, 0);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy();
    expect(screen.getByText('Faltan 7.000 pasos')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '2500');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    await waitFor(() => expect(screen.getByText('2.500 / 7.000 pasos')).toBeTruthy());
    expect(screen.getByText('Faltan 4.500 pasos')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '8000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    await waitFor(() => expect(screen.getByText('8.000 / 7.000 pasos')).toBeTruthy());
    expect(screen.getByText('Objetivo completado')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '3000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    await waitFor(() => expect(screen.getByText('3.000 / 7.000 pasos')).toBeTruthy());
    expect(screen.getByText('Faltan 4.000 pasos')).toBeTruthy();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('3.000 / 7.000 pasos')).toBeTruthy());
  });

  it('applies a changed goal from that day and preserves earlier daily snapshots', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 16, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent.changeText(screen.getByTestId('daily-step-goal-input'), '6500');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar objetivo' }));
    await waitFor(() => expect(screen.getByText('Objetivo guardado')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 6.500 pasos')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent.changeText(screen.getByTestId('daily-step-goal-input'), '8000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar objetivo' }));
    await waitFor(() => expect(screen.getByText('Objetivo guardado')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('0 / 8.000 pasos')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 18, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 8.000 pasos')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 6.500 pasos')).toBeTruthy());
  });

  it('rejects invalid step totals and goals without presenting them as saved', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17, 12)} />);
    await waitFor(() => expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    expect(
      screen.getByText('Escribe un número entero de pasos igual o mayor que cero.'),
    ).toBeTruthy();
    expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '1.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));
    expect(
      screen.getByText('Escribe un número entero de pasos igual o mayor que cero.'),
    ).toBeTruthy();
    expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent.changeText(screen.getByTestId('daily-step-goal-input'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar objetivo' }));
    expect(
      screen.getByText('Escribe un número entero de pasos igual o mayor que cero.'),
    ).toBeTruthy();
    expect(screen.getByText('Objetivo diario: 7.000 pasos')).toBeTruthy();
  });

  it('keeps the previous steps when local storage rejects a write', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17, 12)} />);
    await waitFor(() => expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy());

    storage.failWrites = true;
    await fireEvent.changeText(screen.getByTestId('daily-steps-input'), '5000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar pasos' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudo guardar el cambio. Tus datos anteriores siguen intactos.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText('0 / 7.000 pasos')).toBeTruthy();
  });

  it('shows the fixed muscle-group catalog in a three-column grid', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));

    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );
    expect(screen.getAllByTestId(/muscle-group-card-/)).toHaveLength(9);
    for (const group of [
      'Pecho',
      'Espalda',
      'Hombros',
      'Bíceps',
      'Tríceps',
      'Antebrazos',
      'Abdomen',
      'Glúteos',
      'Piernas',
    ]) {
      expect(screen.getByRole('button', { name: `Abrir grupo ${group}` })).toBeTruthy();
    }
    expect(screen.getAllByText('0 ejercicios')).toHaveLength(9);
    expect(screen.queryByRole('button', { name: 'Crear grupo muscular' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Renombrar grupo/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Eliminar grupo/ })).toBeNull();
  });

  it('opens a group, creates an exercise with that group locked, and keeps its detail accessible', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);
    const description =
      'Controla la bajada y mantén los pies apoyados. Respira antes de empujar.';

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() => expect(screen.getByTestId('muscle-group-grid')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir grupo Pecho' }));
    await waitFor(() => expect(screen.getByTestId('exercise-group-list')).toBeTruthy());
    expect(screen.getByText('Pecho')).toBeTruthy();
    expect(screen.getByText('0 ejercicios')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Añadir ejercicio' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver a grupos musculares' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    expect(screen.getAllByText('Pecho').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: 'Seleccionar grupo Pecho' }),
    ).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    expect(screen.getByText('Escribe un nombre para el ejercicio.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.changeText(
      screen.getByTestId('exercise-description-input'),
      description,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId(/exercise-cover-exercise-/)).toBeTruthy();
    expect(screen.getByText(description).props.numberOfLines).toBe(3);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    );
    await waitFor(() => expect(screen.getByText('Detalle del ejercicio')).toBeTruthy());
    expect(screen.getByText('Pecho')).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a ejercicios' }));
    expect(screen.getByTestId('exercise-group-list')).toBeTruthy();
    expect(screen.getByText('1 ejercicio')).toBeTruthy();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() => expect(screen.getByTestId('muscle-group-grid')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir grupo Pecho' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
      ).toBeTruthy(),
    );
  });

  it('counts and orders exercises inside each fixed group', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() => expect(screen.getByTestId('muscle-group-grid')).toBeTruthy());

    async function createExercise(name: string, group: string) {
      await fireEvent.press(screen.getByRole('button', { name: `Abrir grupo ${group}` }));
      await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
      await fireEvent.changeText(screen.getByTestId('exercise-name-input'), name);
      await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: `Abrir detalle de ${name}` })).toBeTruthy(),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Volver a grupos musculares' }));
    }

    await createExercise('Press militar', 'Pecho');
    await createExercise('Press banca', 'Pecho');
    await createExercise('Remo', 'Espalda');

    expect(screen.getByText('2 ejercicios')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir grupo Pecho' }));
    expect(
      screen.getAllByRole('button', { name: /Abrir detalle de/ }).map(
        (button) => button.props.accessibilityLabel,
      ),
    ).toEqual([
      'Abrir detalle de Press banca',
      'Abrir detalle de Press militar',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a grupos musculares' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir grupo Espalda' }));
    expect(screen.getByRole('button', { name: 'Abrir detalle de Remo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir detalle de Press banca' })).toBeNull();
  });

  it('edits and deletes exercises without changing the fixed group catalog', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir grupo Pecho' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.changeText(
      screen.getByTestId('exercise-description-input'),
      'Descripción inicial',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Editar ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-edit-name-input'), 'Press banca inclinado');
    await fireEvent.changeText(
      screen.getByTestId('exercise-edit-description-input'),
      'Descripción actualizada',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo para editar Espalda' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios del ejercicio' }));
    await waitFor(() => expect(screen.getByText('Press banca inclinado')).toBeTruthy());
    expect(screen.getByText('Espalda')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver a ejercicios' }));
    expect(screen.getAllByText('Espalda').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Abrir detalle de Press banca inclinado' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir detalle de Press banca inclinado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar ejercicio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(screen.getByText('Ejercicio eliminado')).toBeTruthy());
    expect(screen.getByTestId('exercise-group-list')).toBeTruthy();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    expect(screen.getAllByTestId(/muscle-group-card-/)).toHaveLength(9);
    expect(screen.queryByText('Press banca inclinado')).toBeNull();
  });

  it('shows a recoverable error when local storage cannot be read', async () => {
    const storage = new MemoryStorage();
    storage.failReads = true;

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);

    await waitFor(() =>
      expect(screen.getByText('No se pudieron cargar tus datos')).toBeTruthy(),
    );
    expect(screen.queryByText('Objetivo guardado')).toBeNull();
  });

  it('keeps the previous value and does not confirm a failed write', async () => {
    const storage = new MemoryStorage();
    const rendered = await render(
      <App storage={storage} now={() => new Date(2026, 7, 17)} />,
    );

    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('daily-step-goal-input')).toBeTruthy(),
    );

    storage.failWrites = true;
    await fireEvent.changeText(screen.getByTestId('daily-step-goal-input'), '9000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar objetivo' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudo guardar el cambio. Tus datos anteriores siguen intactos.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('Objetivo guardado')).toBeNull();
    await rendered.unmount();
  });

  it('shows, completes, corrects, and persists the weekly strength checklist', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 12, 0, 0);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    expect(screen.getByText('0 / 3 sesiones')).toBeTruthy();
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);
    expect(screen.getByText('Próxima sesión')).toBeTruthy();
    expect(
      screen.getByText('Grupos musculares: Pecho, Hombros, Tríceps'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Abrir grupo Pecho de la próxima sesión',
      }),
    );
    await waitFor(() => expect(screen.getByTestId('exercise-group-list')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
      ).toBeTruthy(),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Volver a grupos musculares' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir grupo Espalda' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Remo');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Abrir detalle de Remo' })).toBeTruthy(),
    );
    expect(
      screen.queryByRole('button', { name: 'Abrir detalle de Press banca' }),
    ).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Parcial')).toBeTruthy();
    expect(screen.getByText('Grupos musculares: Espalda, Bíceps')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Desmarcar sesión Pecho/Hombros/Tríceps',
      }),
    );
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Espalda/Bíceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('2 / 3 sesiones')).toBeTruthy());
    expect(
      screen.getByRole('button', { name: 'Desmarcar sesión Espalda/Bíceps' }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Desmarcar sesión Pecho/Hombros/Tríceps',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    expect(
      screen.getByRole('button', { name: 'Desmarcar sesión Espalda/Bíceps' }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Piernas como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('3 / 3 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();
    expect(screen.getByText('Todas las sesiones están completadas.')).toBeTruthy();
    await firstRender.unmount();

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('3 / 3 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();
  });

  it('rejects an invalid weekly strength plan without changing the current week', async () => {
    const storage = new MemoryStorage();

    await render(
      <App storage={storage} now={() => new Date(2026, 7, 17, 12, 0, 0)} />,
    );
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('strength-session-count-input')).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByTestId('strength-session-count-input'),
      '0',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar plan semanal de fuerza' }),
    );

    expect(
      screen.getByText('El plan semanal debe tener entre 1 y 7 sesiones.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
  });

  it('applies a strength plan on Monday without rewriting the previous week', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 9, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('strength-session-count-input')).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByTestId('strength-session-count-input'),
      '2',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar Piernas para sesión 1' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar plan semanal de fuerza' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Plan semanal guardado para la próxima semana'),
      ).toBeTruthy(),
    );

    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 2 sesiones')).toBeTruthy());
    expect(screen.getByText('Grupos musculares: Pecho, Hombros, Tríceps, Piernas')).toBeTruthy();
    await rendered.unmount();

    currentNow = new Date(2026, 7, 9, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
  });

  it('shows, caps, corrects, and persists the weekly HIIT checklist', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 12, 0, 0);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Revertir última marca de HIIT' }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    );
    expect(screen.getByText('1 / 1 sesiones')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Revertir última marca de HIIT' }),
    );
    await waitFor(() => expect(screen.getByText('0 / 1 sesiones')).toBeTruthy());
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Revertir última marca de HIIT' }),
    );
    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    await firstRender.unmount();

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();
  });

  it('applies a changed HIIT goal on Monday without rewriting the previous week', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 16, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 1 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('hiit-weekly-goal-input')).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByTestId('hiit-weekly-goal-input'),
      '-1',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar objetivo semanal de HIIT' }),
    );
    expect(
      screen.getByText(
        'Escribe un número entero de sesiones HIIT igual o mayor que cero.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Objetivo semanal: 1 sesión')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByTestId('hiit-weekly-goal-input'),
      '3',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar objetivo semanal de HIIT' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Objetivo HIIT guardado para la próxima semana')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getAllByText('0 / 3 sesiones')).toHaveLength(2));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();
  });

  it('starts one fasting, shows its elapsed time, and restores the active fast', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 22, 30, 0);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    expect(screen.getByText('No hay un ayuno activo.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));

    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    expect(screen.getByText(/Hora de inicio:.*22:30/)).toBeTruthy();
    expect(screen.getByText('Duración: 0 min')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Iniciar ayuno' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Finalizar ayuno' })).toBeTruthy();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    expect(screen.getByText('Duración: 0 min')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Iniciar ayuno' })).toBeNull();
  });

  it('does not create a contradictory second active fasting on a double start', async () => {
    const storage = new MemoryStorage();
    const originalSetItem = storage.setItem.bind(storage);
    let writes = 0;
    let blockWrites = false;
    let releaseWrite: (() => void) | null = null;
    storage.setItem = async (key, value) => {
      if (blockWrites) {
        await new Promise<void>((resolve) => {
          releaseWrite = resolve;
        });
      }
      await originalSetItem(key, value);
      writes += 1;
    };

    const rendered = await render(
      <App storage={storage} now={() => new Date(2026, 7, 17, 22, 30, 0)} />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    const writesBeforeStart = writes;
    blockWrites = true;
    const startButton = screen.getByRole('button', { name: 'Iniciar ayuno' });
    await fireEvent.press(startButton);
    await fireEvent.press(startButton);

    await waitFor(() => expect(releaseWrite).not.toBeNull());
    blockWrites = false;
    const resolveWrite = releaseWrite as (() => void) | null;
    if (resolveWrite) {
      resolveWrite();
    }
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    expect(writes).toBe(writesBeforeStart + 1);
    await rendered.unmount();
  });

  it('shows seven fasting circles from Monday to Sunday with the longest start-day fast', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 21, 12, 0, 0);
    const state = createDefaultState(now);

    state.fasting.completed = [
      {
        id: 'monday-long',
        startedAt: new Date(2026, 7, 17, 20, 0, 0).toISOString(),
        endedAt: new Date(2026, 7, 18, 12, 1, 0).toISOString(),
        durationMinutes: 961,
      },
      {
        id: 'monday-short',
        startedAt: new Date(2026, 7, 17, 8, 0, 0).toISOString(),
        endedAt: new Date(2026, 7, 17, 23, 0, 0).toISOString(),
        durationMinutes: 900,
      },
      {
        id: 'tuesday-cross-midnight',
        startedAt: new Date(2026, 7, 18, 20, 0, 0).toISOString(),
        endedAt: new Date(2026, 7, 19, 11, 0, 0).toISOString(),
        durationMinutes: 900,
      },
    ];
    await saveAppState(storage, state);

    await render(<App now={() => now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    const week = screen.getByTestId('home-fasting-week');
    expect(within(week).getByText('Lun')).toBeTruthy();
    expect(within(week).getByText('Mar')).toBeTruthy();
    expect(within(week).getByText('Mié')).toBeTruthy();
    expect(within(week).getByText('Jue')).toBeTruthy();
    expect(within(week).getByText('Vie')).toBeTruthy();
    expect(within(week).getByText('Sáb')).toBeTruthy();
    expect(within(week).getByText('Dom')).toBeTruthy();

    const mondayCircle = screen.getByTestId('home-fasting-day-2026-08-17-circle');
    const tuesdayCircle = screen.getByTestId('home-fasting-day-2026-08-18-circle');
    const wednesdayCircle = screen.getByTestId('home-fasting-day-2026-08-19-circle');
    const fridayCircle = screen.getByTestId('home-fasting-day-2026-08-21-circle');

    expect(mondayCircle.props.accessibilityLabel).toBe(
      'Lunes: 16 horas, más de 15 horas',
    );
    expect(tuesdayCircle.props.accessibilityLabel).toBe(
      'Martes: 15 horas, 15 horas o menos o sin ayuno válido',
    );
    expect(wednesdayCircle.props.accessibilityLabel).toBe(
      'Miércoles: 0 horas, 15 horas o menos o sin ayuno válido',
    );
    expect(fridayCircle.props.accessibilityLabel).toBe(
      'Viernes: 0 horas, sin ayuno iniciado',
    );
  });

  it('shows the active state, eating guidance, and the result after finishing a fast', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 17, 20, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App now={now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());

    expect(
      screen.getByText('Primera hora válida para comer: 18/08/2026, 11:01'),
    ).toBeTruthy();
    expect(screen.getByText('Aún no puedes comer')).toBeTruthy();
    expect(
      screen.getByTestId('home-fasting-day-2026-08-17-circle').props.accessibilityLabel,
    ).toBe('Lunes: 0 horas, ayuno activo');

    currentNow = new Date(2026, 7, 18, 11, 2, 0);
    await rendered.unmount();
    rendered = await render(<App now={now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('Ya puedes comer')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar ayuno' }));
    await waitFor(() => expect(screen.getByText('No hay un ayuno activo.')).toBeTruthy());
    expect(
      screen.getByTestId('home-fasting-day-2026-08-17-circle').props.accessibilityLabel,
    ).toBe('Lunes: 15 horas, más de 15 horas');

    await rendered.unmount();
    await render(<App now={now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('Último ayuno: 15 h 2 min')).toBeTruthy());
    expect(
      screen.getByTestId('home-fasting-day-2026-08-17-circle').props.accessibilityLabel,
    ).toBe('Lunes: 15 horas, más de 15 horas');
  });

  it('keeps the active fasting duration until the app is reopened or resumed', async () => {
    jest.useFakeTimers();

    try {
      const storage = new MemoryStorage();
      let currentNow = new Date(2026, 7, 17, 22, 30, 0);
      const now = () => currentNow;

      const rendered = await render(<App storage={storage} now={now} />);
      await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));
      await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());

      currentNow = new Date(2026, 7, 17, 22, 45, 0);
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });

      expect(screen.getByText('Duración: 0 min')).toBeTruthy();
      expect(screen.queryByText('Duración: 15 min')).toBeNull();
      await rendered.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('refreshes the active fasting duration when the app returns to the foreground', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 17, 22, 30, 0);
    const now = () => currentNow;
    let handleAppStateChange: ((nextState: string) => void) | null = null;
    const originalAddEventListener = AppState.addEventListener;
    const addEventListener = jest.spyOn(AppState, 'addEventListener');
    addEventListener.mockImplementation(((_type, listener) => {
      handleAppStateChange = listener as (nextState: string) => void;
      return { remove: jest.fn() };
    }) as typeof AppState.addEventListener);

    try {
      const rendered = await render(<App storage={storage} now={now} />);
      await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));
      await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());

      currentNow = new Date(2026, 7, 17, 23, 45, 0);
      await act(async () => {
        handleAppStateChange?.('active');
        await Promise.resolve();
      });

      await waitFor(() => expect(screen.getByText('Duración: 1 h 15 min')).toBeTruthy());
      await rendered.unmount();
    } finally {
      AppState.addEventListener = originalAddEventListener;
    }
  });

  it('finishes a fasting across midnight and persists the last duration', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 17, 22, 30, 0);
    const now = () => currentNow;

    const firstRender = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());

    currentNow = new Date(2026, 7, 18, 0, 30, 0);
    await fireEvent.press(screen.getByRole('button', { name: 'Finalizar ayuno' }));
    await waitFor(() => expect(screen.getByText('No hay un ayuno activo.')).toBeTruthy());
    expect(screen.getByText('Último ayuno: 2 h 0 min')).toBeTruthy();
    expect(screen.getByText('Duración media: 2 h 0 min')).toBeTruthy();

    await firstRender.unmount();
    const rehydrated = await render(<App storage={storage} now={() => currentNow} />);
    await waitFor(() => expect(screen.getByText('No hay un ayuno activo.')).toBeTruthy());
    expect(screen.getByText('Último ayuno: 2 h 0 min')).toBeTruthy();
    expect(screen.getByText('Duración media: 2 h 0 min')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar ayuno' }));
    await waitFor(() => expect(screen.getByText('Ayuno activo')).toBeTruthy());
    expect(screen.getByText('Duración media: 2 h 0 min')).toBeTruthy();
    await rehydrated.unmount();
  });

  it('shows the default water settings and schedules the eight local reminders after permission', async () => {
    const storage = new MemoryStorage();
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'undetermined';
    notifications.permissionAfterRequest = 'granted';

    const firstRender = await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('water-start-time-input')).toBeTruthy(),
    );

    expect(screen.getByTestId('water-start-time-input').props.value).toBe('08:00');
    expect(screen.getByTestId('water-end-time-input').props.value).toBe('22:00');
    expect(screen.getByTestId('water-interval-input').props.value).toBe('2');
    expect(screen.getByText('Inactivos')).toBeTruthy();

    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );

    await waitFor(() => expect(screen.getByText('Activos')).toBeTruthy());
    expect(notifications.permissionRequests).toBe(1);
    expect(notifications.channelCreations).toBe(1);
    expect([...notifications.scheduled.values()]).toEqual([
      { hour: 8, minute: 0 },
      { hour: 10, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 14, minute: 0 },
      { hour: 16, minute: 0 },
      { hour: 18, minute: 0 },
      { hour: 20, minute: 0 },
      { hour: 22, minute: 0 },
    ]);

    await firstRender.unmount();
    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() => expect(screen.getByText('Activos')).toBeTruthy());
  });

  it('turns active reminders off when Android permission is revoked', async () => {
    const storage = new MemoryStorage();
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';

    const firstRender = await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(8));
    notifications.permission = 'denied';
    await fireEvent.changeText(screen.getByTestId('water-interval-input'), '3');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorios de agua' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'No se concedió el permiso de notificaciones. Actívalo en Ajustes de Android para recibir avisos.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Inactivos')).toBeTruthy();
    expect(notifications.scheduled.size).toBe(0);
    await firstRender.unmount();

    notifications.permission = 'denied';
    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() => expect(screen.getByText('Inactivos')).toBeTruthy());
    await waitFor(() =>
      expect(
        screen.getByText(
          'Permiso de notificaciones denegado. Actívalo en Ajustes de Android para recibir avisos.',
        ),
      ).toBeTruthy(),
    );
    expect(notifications.scheduled.size).toBe(0);
  });

  it('keeps active water configuration when revoked reminders cannot be cancelled', async () => {
    const storage = new MemoryStorage();
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';

    const firstRender = await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(8));
    await firstRender.unmount();

    notifications.permission = 'denied';
    notifications.failCancellations = true;
    const failedLoad = await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudieron actualizar los recordatorios de agua. Comprueba los permisos e inténtalo de nuevo.',
        ),
      ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() => expect(screen.getByText('Inactivos')).toBeTruthy());
    expect(notifications.scheduled.size).toBe(8);
    await failedLoad.unmount();

    notifications.permission = 'granted';
    notifications.failCancellations = false;
    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() => expect(screen.getByText('Activos')).toBeTruthy());
  });

  it('does not report water reminders active when scheduling fails and can retry', async () => {
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';
    notifications.failScheduling = true;

    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={new MemoryStorage()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudieron actualizar los recordatorios de agua. Comprueba los permisos e inténtalo de nuevo.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Inactivos')).toBeTruthy();
    expect(screen.getByTestId('water-enabled-switch').props.value).toBe(false);

    notifications.failScheduling = false;
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(screen.getByText('Activos')).toBeTruthy());
    expect(notifications.scheduled.size).toBe(8);
  });

  it('reports a recoverable error when reprogramming cannot cancel every previous reminder', async () => {
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';

    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={new MemoryStorage()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(8));
    const firstScheduleIds = [...notifications.scheduled.keys()];
    notifications.failCancellationId = firstScheduleIds[1];

    await fireEvent.changeText(screen.getByTestId('water-interval-input'), '3');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorios de agua' }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudieron actualizar los recordatorios de agua. Comprueba los permisos e inténtalo de nuevo.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Inactivos')).toBeTruthy();
    expect(screen.getByTestId('water-enabled-switch').props.value).toBe(true);

    notifications.failCancellationId = null;
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorios de agua' }),
    );
    await waitFor(() =>
      expect([...notifications.scheduled.values()]).toEqual([
        { hour: 8, minute: 0 },
        { hour: 11, minute: 0 },
        { hour: 14, minute: 0 },
        { hour: 17, minute: 0 },
        { hour: 20, minute: 0 },
      ]),
    );
    expect(screen.getByText('Activos')).toBeTruthy();
  });

  it('keeps the loaded state and reports a recoverable error when revocation cannot be persisted', async () => {
    const storage = new MemoryStorage();
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';

    const firstRender = await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(8));
    await firstRender.unmount();

    notifications.permission = 'denied';
    storage.failWrites = true;
    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() => expect(screen.getByText('Inactivos')).toBeTruthy());
    expect(
      screen.getByText(
        'No se pudo guardar el cambio. Tus datos anteriores siguen intactos.',
      ),
    ).toBeTruthy();
    expect(notifications.scheduled.size).toBe(0);
  });

  it('explains denied notification permission without enabling water reminders', async () => {
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'denied';

    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={new MemoryStorage()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se concedió el permiso de notificaciones. Actívalo en Ajustes de Android para recibir avisos.',
        ),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Inactivos')).toBeTruthy();
    expect(screen.getByTestId('water-enabled-switch').props.value).toBe(false);
    expect(notifications.scheduled.size).toBe(0);
    expect(notifications.channelCreations).toBe(1);
  });

  it('validates the water window before changing the local schedule', async () => {
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';

    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={new MemoryStorage()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));

    await fireEvent.changeText(screen.getByTestId('water-start-time-input'), '22:00');
    await fireEvent.changeText(screen.getByTestId('water-end-time-input'), '08:00');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorios de agua' }),
    );
    expect(
      screen.getByText('La hora inicial debe ser anterior a la hora final.'),
    ).toBeTruthy();
    expect(notifications.scheduled.size).toBe(0);

    await fireEvent.changeText(screen.getByTestId('water-start-time-input'), '08:00');
    await fireEvent.changeText(screen.getByTestId('water-end-time-input'), '22:00');
    await fireEvent.changeText(screen.getByTestId('water-interval-input'), '0');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorios de agua' }),
    );
    expect(
      screen.getByText('El intervalo debe ser un número positivo.'),
    ).toBeTruthy();
  });

  it('replaces and cancels only water reminders without duplicates', async () => {
    const notifications = new ControlledWaterNotifications();
    notifications.permission = 'granted';

    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={new MemoryStorage()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(8));
    const firstScheduleIds = [...notifications.scheduled.keys()];

    await fireEvent.changeText(screen.getByTestId('water-start-time-input'), '09:00');
    await fireEvent.changeText(screen.getByTestId('water-end-time-input'), '21:00');
    await fireEvent.changeText(screen.getByTestId('water-interval-input'), '3');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorios de agua' }),
    );

    await waitFor(() =>
      expect([...notifications.scheduled.values()]).toEqual([
        { hour: 9, minute: 0 },
        { hour: 12, minute: 0 },
        { hour: 15, minute: 0 },
        { hour: 18, minute: 0 },
        { hour: 21, minute: 0 },
      ]),
    );
    expect(notifications.cancelled).toEqual(firstScheduleIds);
    expect(notifications.scheduled.size).toBe(5);
    expect(notifications.foreignCancellationAttempts).toBe(0);
    expect(notifications.allScheduledIds).toEqual(
      new Set(['foreign-reminder', ...notifications.scheduled.keys()]),
    );

    await fireEvent(
      screen.getByTestId('water-enabled-switch'),
      'valueChange',
      false,
    );
    await waitFor(() => expect(screen.getByText('Inactivos')).toBeTruthy());
    expect(notifications.scheduled.size).toBe(0);
    expect(notifications.cancelled).toHaveLength(13);
    expect(notifications.foreignCancellationAttempts).toBe(0);
    expect(notifications.allScheduledIds).toEqual(new Set(['foreign-reminder']));
  });

  it('shows weekly history snapshots across Monday boundaries and rehydrates them', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 9, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App now={now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombros/Tríceps como completada',
      }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HIIT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('strength-session-count-input')).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByTestId('strength-session-count-input'),
      '1',
    );
    for (const group of ['Pecho', 'Hombros', 'Tríceps']) {
      await fireEvent.press(
        screen.getByRole('button', {
          name: `Seleccionar ${group} para sesión 1`,
        }),
      );
    }
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar Abdomen para sesión 1' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar plan semanal de fuerza' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Plan semanal guardado para la próxima semana'),
      ).toBeTruthy(),
    );

    await fireEvent.changeText(screen.getByTestId('hiit-weekly-goal-input'), '2');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar objetivo semanal de HIIT' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Objetivo HIIT guardado para la próxima semana'),
      ).toBeTruthy(),
    );
    await rendered.unmount();

    currentNow = new Date(2026, 7, 10, 12, 0, 0);
    rendered = await render(<App now={now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('0 / 1 sesiones')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Historial de semanas')).toBeTruthy());

    expect(
      screen
        .getAllByTestId(/history-week-header-/)
        .map((header) => header.props.children),
    ).toEqual([
      'Semana actual · lunes 10/08/2026',
      'Semana del lunes 03/08/2026',
    ]);
    expect(screen.getByText('Semana actual (en curso)')).toBeTruthy();
    expect(screen.getByText('Semana finalizada')).toBeTruthy();
    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();
    expect(screen.getByText('0 / 2 sesiones')).toBeTruthy();
    expect(screen.getByText('1 / 3 sesiones')).toBeTruthy();
    expect(screen.getByText('1 / 1 sesiones')).toBeTruthy();
    expect(screen.getByText('Grupos musculares: Abdomen')).toBeTruthy();
    expect(
      screen.getByText('Grupos musculares: Pecho, Hombros, Tríceps'),
    ).toBeTruthy();
    expect(screen.getByText('Estado: Completado')).toBeTruthy();
    expect(screen.getAllByText('Estado: Pendiente').length).toBeGreaterThanOrEqual(2);

    await rendered.unmount();
    await render(<App now={now} storage={storage} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));
    await waitFor(() => expect(screen.getByText('Historial de semanas')).toBeTruthy());
    expect(screen.getByText('Semana del lunes 03/08/2026')).toBeTruthy();
    expect(screen.getByText('Grupos musculares: Pecho, Hombros, Tríceps')).toBeTruthy();
  });

  it('shows understandable empty progress values without dividing by zero', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));

    await waitFor(() => expect(screen.getByText('Progreso')).toBeTruthy());
    expect(screen.getByText('Días con objetivo cumplido: Sin datos')).toBeTruthy();
    expect(screen.getByText('Media de pasos: Sin datos')).toBeTruthy();
    expect(screen.getByText('Semanas de fuerza cumplidas: Sin datos')).toBeTruthy();
    expect(screen.getByText('Semanas de HIIT cumplidas: Sin datos')).toBeTruthy();
    expect(screen.getByText('Último ayuno: Sin ayunos finalizados')).toBeTruthy();
    expect(screen.getByText('Cumplimiento general: Sin datos')).toBeTruthy();
  });

  it('summarizes partial activity with saved goals from each historical period', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 16, 12);
    const state = createDefaultState(now);
    const firstSession = state.settings.strengthSessions[0];
    const secondSession = state.settings.strengthSessions[1];
    const thirdSession = state.settings.strengthSessions[2];

    state.dailyRecords = {
      '2026-08-15': {
        date: '2026-08-15',
        steps: 8_000,
        stepGoal: 7_000,
      },
      '2026-08-16': {
        date: '2026-08-16',
        steps: 10_000,
        stepGoal: 8_000,
      },
    };
    state.weeklyRecords = {
      '2026-08-03': {
        weekStart: '2026-08-03',
        strengthGoal: 3,
        strengthSessions: [
          { ...firstSession, completed: true },
          { ...secondSession, completed: true },
          { ...thirdSession, completed: false },
        ],
        hiitGoal: 1,
        hiitCompleted: 1,
      },
      '2026-08-10': {
        weekStart: '2026-08-10',
        strengthGoal: 1,
        strengthSessions: [{ ...firstSession, completed: true }],
        hiitGoal: 2,
        hiitCompleted: 1,
      },
    };
    state.fasting.active = {
      startedAt: '2026-08-16T08:00:00.000Z',
    };
    state.fasting.completed = [
      {
        id: 'fasting-old',
        startedAt: '2026-08-10T08:00:00.000Z',
        endedAt: '2026-08-10T09:00:00.000Z',
        durationMinutes: 60,
      },
      {
        id: 'fasting-last',
        startedAt: '2026-08-16T08:00:00.000Z',
        endedAt: '2026-08-16T10:05:00.000Z',
        durationMinutes: 125,
      },
    ];
    await saveAppState(storage, state);

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Historial/ }));

    await waitFor(() => expect(screen.getByText('Progreso')).toBeTruthy());
    expect(screen.getByText('Días con objetivo cumplido: 2')).toBeTruthy();
    expect(screen.getByText('Media de pasos: 9.000 pasos')).toBeTruthy();
    expect(screen.getByText('Entrenamientos de fuerza por semana')).toBeTruthy();
    expect(screen.getByText('Sesiones de fuerza realizadas: 3')).toBeTruthy();
    expect(screen.getByText('Semanas de fuerza cumplidas: 1 de 2 (50%)')).toBeTruthy();
    expect(screen.getByText('Sesiones HIIT realizadas: 2')).toBeTruthy();
    expect(screen.getByText('Semanas de HIIT cumplidas: 1 de 2 (50%)')).toBeTruthy();
    expect(screen.getByText('Último ayuno: 2 h 5 min')).toBeTruthy();
    expect(screen.getByText('Media de ayunos: 1 h 33 min')).toBeTruthy();
    expect(screen.getByText('Ayuno activo')).toBeTruthy();
    expect(screen.getByText('Cumplimiento general: 67%')).toBeTruthy();
    expect(screen.getByText('Unidades cumplidas: 4 de 6')).toBeTruthy();
  });
});
