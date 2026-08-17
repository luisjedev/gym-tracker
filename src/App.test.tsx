import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../App';
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
});
