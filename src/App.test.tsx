import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import App from '../App';
import type { WaterNotificationAdapter, WaterPermissionStatus, WaterReminderTime } from './notifications/waterNotifications';
import type { StorageAdapter } from './storage/appStorage';

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
    const id = `water-${this.nextId}`;
    this.nextId += 1;
    this.scheduled.set(id, time);
    this.allScheduledIds.add(id);
    return id;
  }

  async cancelWaterReminder(id: string) {
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

  it('shows the exercise library empty with the initial groups and filter controls', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));

    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );
    expect(screen.getByText('Pecho')).toBeTruthy();
    expect(screen.getByText('Espalda')).toBeTruthy();
    expect(screen.getByText('Hombro')).toBeTruthy();
    expect(screen.getByText('Bíceps')).toBeTruthy();
    expect(screen.getByText('Tríceps')).toBeTruthy();
    expect(screen.getByText('Piernas')).toBeTruthy();
    expect(screen.getByText('Glúteos')).toBeTruthy();
    expect(screen.getByText('Abdomen')).toBeTruthy();
    expect(screen.getByText('Aún no hay ejercicios guardados.')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Filtrar por Pecho' }),
    );
    expect(screen.getByText('Filtro: Pecho')).toBeTruthy();
    expect(screen.getByText('No hay ejercicios en este grupo todavía.')).toBeTruthy();
  });

  it('creates and rehydrates a custom muscle group', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Crear grupo muscular' }),
    );
    await fireEvent.changeText(screen.getByTestId('muscle-group-name-input'), '  Core  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar grupo muscular' }));

    await waitFor(() => expect(screen.getByText('Core')).toBeTruthy());
    await firstRender.unmount();

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() => expect(screen.getByText('Core')).toBeTruthy());
  });

  it('creates an exercise, opens its detail, and rehydrates it', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Crear ejercicio' }),
    );
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Pecho' }),
    );
    await fireEvent.changeText(
      screen.getByTestId('exercise-description-input'),
      'Controla la bajada y mantén los pies apoyados.',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar ejercicio' }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Detalle del ejercicio')).toBeTruthy(),
    );
    expect(screen.getByText('Press banca')).toBeTruthy();
    expect(screen.getByText('Pecho')).toBeTruthy();
    expect(
      screen.getByText('Controla la bajada y mantén los pies apoyados.'),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Volver a ejercicios' }),
    );
    await firstRender.unmount();

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
      ).toBeTruthy(),
    );
  });

  it('orders exercises by group and name and filters them by group', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );

    async function createExercise(name: string, group: string) {
      await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
      await fireEvent.changeText(screen.getByTestId('exercise-name-input'), name);
      await fireEvent.press(
        screen.getByRole('button', { name: `Seleccionar grupo ${group}` }),
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: `Abrir detalle de ${name}` })).toBeTruthy(),
      );
    }

    await createExercise('Press militar', 'Pecho');
    await createExercise('Press banca', 'Pecho');
    await createExercise('Remo', 'Espalda');

    expect(
      screen.getAllByRole('button', { name: /Abrir detalle de/ }).map(
        (button) => button.props.accessibilityLabel,
      ),
    ).toEqual([
      'Abrir detalle de Press banca',
      'Abrir detalle de Press militar',
      'Abrir detalle de Remo',
    ]);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Filtrar por Pecho' }),
    );
    expect(screen.getByRole('button', { name: 'Abrir detalle de Press banca' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir detalle de Press militar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir detalle de Remo' })).toBeNull();
  });

  it('shows validation errors without saving incomplete groups or exercises', async () => {
    const storage = new MemoryStorage();

    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Crear grupo muscular' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar grupo muscular' }));
    expect(
      screen.getByText('Escribe un nombre para el grupo muscular.'),
    ).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('muscle-group-name-input'), ' pecho ');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar grupo muscular' }));
    expect(screen.getByText('Ya existe un grupo muscular con ese nombre.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    expect(screen.getByText('Escribe un nombre para el ejercicio.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    expect(screen.getByText('Selecciona un grupo muscular.')).toBeTruthy();
    expect(screen.getByText('Aún no hay ejercicios guardados.')).toBeTruthy();
  });

  it('edits an exercise from its detail and persists the changes through filters', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.changeText(
      screen.getByTestId('exercise-description-input'),
      'Descripción inicial',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Pecho' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Editar ejercicio' }));
    await fireEvent.changeText(
      screen.getByTestId('exercise-edit-name-input'),
      'No se guarda',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cancelar edición del ejercicio' }),
    );
    expect(screen.getByText('Press banca')).toBeTruthy();
    expect(screen.queryByText('No se guarda')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Editar ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-edit-name-input'), '   ');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar cambios del ejercicio' }),
    );
    expect(screen.getByText('Escribe un nombre para el ejercicio.')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByTestId('exercise-edit-name-input'),
      'Press banca inclinado',
    );
    await fireEvent.changeText(
      screen.getByTestId('exercise-edit-description-input'),
      'Descripción actualizada',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo para editar Espalda' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar cambios del ejercicio' }),
    );

    await waitFor(() => expect(screen.getByText('Press banca inclinado')).toBeTruthy());
    expect(screen.getByText('Espalda')).toBeTruthy();
    expect(screen.getByText('Descripción actualizada')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Volver a ejercicios' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca inclinado' }),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Filtrar por Espalda' }),
    );
    expect(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca inclinado' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Abrir detalle de Press banca' }),
    ).toBeNull();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca inclinado' }),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Filtrar por Espalda' }),
    );
    expect(screen.getByText('Filtro: Espalda')).toBeTruthy();
  });

  it('cancels exercise deletion without changing the persisted library', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Pecho' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar ejercicio' }));
    expect(screen.getByText('¿Eliminar este ejercicio?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar eliminación' }));
    expect(screen.getByText('Press banca')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Volver a ejercicios' }),
    );
    expect(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    ).toBeTruthy();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    expect(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    ).toBeTruthy();
  });

  it('confirms exercise deletion and removes it after rehydration', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Pecho' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar ejercicio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Abrir detalle de Press banca' })).toBeNull(),
    );
    expect(screen.getByText('Ejercicio eliminado')).toBeTruthy();

    await firstRender.unmount();
    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    expect(screen.queryByText('Press banca')).toBeNull();
    expect(screen.getByText('Aún no hay ejercicios guardados.')).toBeTruthy();
  });

  it('renames groups, preserves exercise references, and blocks deleting a used group', async () => {
    const storage = new MemoryStorage();

    const firstRender = await render(
      <App storage={storage} now={() => new Date(2026, 7, 17)} />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo muscular' }));
    await fireEvent.changeText(screen.getByTestId('muscle-group-name-input'), 'Core');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar grupo muscular' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Renombrar grupo Core' })).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Plancha');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Core' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Abrir detalle de Plancha' })).toBeTruthy(),
    );
    expect(screen.getAllByText('Core').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Renombrar grupo Core' }));
    await fireEvent.changeText(screen.getByTestId('muscle-group-edit-name-input'), ' P E C H O ');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar cambios del grupo muscular' }),
    );
    expect(screen.getByText('Ya existe un grupo muscular con ese nombre.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('muscle-group-edit-name-input'), '');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar cambios del grupo muscular' }),
    );
    expect(screen.getByText('Escribe un nombre para el grupo muscular.')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('muscle-group-edit-name-input'), 'Centro');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar cambios del grupo muscular' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Filtrar por Centro' })).toBeTruthy(),
    );
    expect(screen.getAllByText('Centro').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Abrir detalle de Plancha' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar grupo Centro' }));
    expect(
      screen.getByText('No se puede eliminar el grupo muscular porque está usado por un ejercicio.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filtrar por Centro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir detalle de Plancha' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar grupo Pecho' }));
    expect(
      screen.getByText('No se puede eliminar el grupo muscular porque está usado por la planificación semanal.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Crear grupo muscular' }));
    await fireEvent.changeText(screen.getByTestId('muscle-group-name-input'), 'Cuello');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar grupo muscular' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Eliminar grupo Cuello' })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar grupo Cuello' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Filtrar por Cuello' })).toBeNull(),
    );

    await firstRender.unmount();
    await render(<App storage={storage} now={() => new Date(2026, 7, 17)} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filtrar por Centro' }));
    expect(screen.getByRole('button', { name: 'Abrir detalle de Plancha' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Filtrar por Cuello' })).toBeNull();
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
      screen.getByText('Grupos musculares: Pecho, Hombro, Tríceps'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombro/Tríceps como completada',
      }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Abrir grupo Pecho de la próxima sesión',
      }),
    );
    await waitFor(() => expect(screen.getByText('Filtro: Pecho')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Press banca');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Pecho' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
      ).toBeTruthy(),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Remo');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Espalda' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Abrir detalle de Remo' })).toBeNull(),
    );
    expect(
      screen.getByRole('button', { name: 'Abrir detalle de Press banca' }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombro/Tríceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Parcial')).toBeTruthy();
    expect(screen.getByText('Grupos musculares: Espalda, Bíceps')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Desmarcar sesión Pecho/Hombro/Tríceps',
      }),
    );
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombro/Tríceps como completada',
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
        name: 'Desmarcar sesión Pecho/Hombro/Tríceps',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    expect(
      screen.getByRole('button', { name: 'Desmarcar sesión Espalda/Bíceps' }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombro/Tríceps como completada',
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
        name: 'Marcar sesión Pecho/Hombro/Tríceps como completada',
      }),
    );
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 3 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Marcar sesión Pecho/Hombro/Tríceps como completada',
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
    expect(screen.getByText('Grupos musculares: Pecho, Hombro, Tríceps, Piernas')).toBeTruthy();
    await rendered.unmount();

    currentNow = new Date(2026, 7, 9, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 16, 12, 0, 0);
    await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('1 / 3 sesiones')).toBeTruthy());
  });

  it('shows, caps, corrects, and persists the weekly HEAT checklist', async () => {
    const storage = new MemoryStorage();
    const now = new Date(2026, 7, 17, 12, 0, 0);

    const firstRender = await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());

    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Marcar sesión HEAT como completada' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Revertir última marca de HEAT' }),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HEAT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HEAT como completada' }),
    );
    expect(screen.getByText('1 / 1 sesiones')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Revertir última marca de HEAT' }),
    );
    await waitFor(() => expect(screen.getByText('0 / 1 sesiones')).toBeTruthy());
    expect(screen.getAllByText('Estado: Pendiente')).toHaveLength(2);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Revertir última marca de HEAT' }),
    );
    expect(screen.getByText('0 / 1 sesiones')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HEAT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    await firstRender.unmount();

    await render(<App storage={storage} now={() => now} />);
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    expect(screen.getByText('Estado: Completado')).toBeTruthy();
  });

  it('applies a changed HEAT goal on Monday without rewriting the previous week', async () => {
    const storage = new MemoryStorage();
    let currentNow = new Date(2026, 7, 16, 12, 0, 0);
    const now = () => currentNow;

    let rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getByText('0 / 1 sesiones')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HEAT como completada' }),
    );
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('heat-weekly-goal-input')).toBeTruthy(),
    );
    await fireEvent.changeText(
      screen.getByTestId('heat-weekly-goal-input'),
      '-1',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar objetivo semanal de HEAT' }),
    );
    expect(
      screen.getByText(
        'Escribe un número entero de sesiones HEAT igual o mayor que cero.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Objetivo semanal: 1 sesión')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByTestId('heat-weekly-goal-input'),
      '3',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar objetivo semanal de HEAT' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Objetivo HEAT guardado para la próxima semana')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByRole('button', { name: /Inicio/ }));
    await waitFor(() => expect(screen.getByText('1 / 1 sesiones')).toBeTruthy());
    await rendered.unmount();

    currentNow = new Date(2026, 7, 17, 12, 0, 0);
    rendered = await render(<App storage={storage} now={now} />);
    await waitFor(() => expect(screen.getAllByText('0 / 3 sesiones')).toHaveLength(2));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Marcar sesión HEAT como completada' }),
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

  it('recalculates the active fasting duration after the clock advances', async () => {
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

      expect(screen.getByText('Duración: 15 min')).toBeTruthy();
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
    await firstRender.unmount();

    notifications.permission = 'denied';
    await render(
      <App
        notifications={notifications}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Inactivos')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'Permiso de notificaciones denegado. Actívalo en Ajustes de Android para recibir avisos.',
        ),
      ).toBeTruthy(),
    );
    expect(notifications.scheduled.size).toBe(0);
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
    await waitFor(() => expect(screen.getByText('Inactivos')).toBeTruthy());
    expect(
      screen.getByText(
        'No se pudo guardar el cambio. Tus datos anteriores siguen intactos.',
      ),
    ).toBeTruthy();
    expect(notifications.scheduled.size).toBe(8);
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
});
