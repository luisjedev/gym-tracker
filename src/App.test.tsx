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
