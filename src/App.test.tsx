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
