import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../../App';
import type {
  ExerciseMediaAdapter,
  ExerciseMediaCopy,
  ExerciseMediaSelection,
} from './exerciseMedia';
import type { StorageAdapter } from '../storage/appStorage';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();
  failWrites = false;

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    if (this.failWrites) {
      throw new Error('write failed');
    }

    this.values.set(key, value);
  }
}

async function settleNavigation() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  });
}

class ControlledExerciseMedia implements ExerciseMediaAdapter {
  selection: readonly ExerciseMediaSelection[] = [
    {
      uri: 'content://picked-routine.jpg',
      type: 'image',
      width: 1200,
      height: 800,
      fileName: 'routine.jpg',
    },
    {
      uri: 'content://picked-routine.mp4',
      type: 'video',
      width: 1920,
      height: 1080,
      duration: 12_500,
      fileName: 'routine.mp4',
    },
  ];
  readonly selected: ExerciseMediaSelection[] = [];
  readonly copies: ExerciseMediaCopy[] = [];
  readonly deletedUris: string[] = [];

  async selectMedia() {
    this.selected.push(...this.selection);
    return this.selection;
  }

  async copyToPrivateStorage(selection: ExerciseMediaSelection) {
    const copy = {
      ...selection,
      uri: `file:///private/${selection.fileName}`,
    };
    this.copies.push(copy);
    return copy;
  }

  async deletePrivateCopy(uri: string) {
    this.deletedUris.push(uri);
  }
}

async function openExerciseDetail(
  media: ControlledExerciseMedia,
  storage: StorageAdapter,
) {
  await render(
    <App
      media={media}
      now={() => new Date(2026, 7, 17, 12)}
      storage={storage}
    />,
  );
  await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
  await settleNavigation();
  await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
  );
}

describe('exercise multimedia', () => {
  it('selects mixed media, copies it privately, and restores it after reopening', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();

    const firstRender = await render(
      <App
        media={media}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Piernas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Abrir imagen 1' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Reproducir vídeo 2' })).toBeTruthy();
    });
    expect(screen.getByText('2 elementos multimedia')).toBeTruthy();
    expect(media.selected).toEqual(media.selection);
    expect(media.copies.map((copy) => copy.uri)).toEqual([
      'file:///private/routine.jpg',
      'file:///private/routine.mp4',
    ]);

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir imagen 1' }));
    expect(screen.getByRole('button', { name: 'Cerrar visor multimedia' })).toBeTruthy();
    expect(screen.getByLabelText('Imagen multimedia abierta')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar visor multimedia' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Reproducir vídeo 2' }));
    expect(screen.getByTestId('video-view')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar visor multimedia' }));

    await firstRender.unmount();
    await openExerciseDetail(media, storage);
    expect(screen.getByText('2 elementos multimedia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir imagen 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reproducir vídeo 2' })).toBeTruthy();
  });

  it('explains a cancelled system selection without reporting saved media', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();
    media.selection = [];

    await render(
      <App
        media={media}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Piernas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );

    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );

    await waitFor(() =>
      expect(screen.getByText('No se seleccionó ninguna imagen ni vídeo.')).toBeTruthy(),
    );
    expect(screen.queryByText('Multimedia guardada')).toBeNull();
    expect(media.copies).toHaveLength(0);
  });

  it('cleans newly copied files when local persistence fails', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();

    await render(
      <App
        media={media}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Piernas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );
    storage.failWrites = true;

    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );

    await waitFor(() => expect(screen.getByText('write failed')).toBeTruthy());
    expect(screen.getByText('Sin imágenes ni vídeos asociados.')).toBeTruthy();
    expect(media.deletedUris).toEqual([
      'file:///private/routine.jpg',
      'file:///private/routine.mp4',
    ]);
  });

  it('removes one media reference before cleaning only its private copy', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();

    await render(
      <App
        media={media}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Piernas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );
    await waitFor(() => expect(screen.getByText('2 elementos multimedia')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar imagen 1' }));

    await waitFor(() => expect(screen.getByText('1 elementos multimedia')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Abrir imagen 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reproducir vídeo 1' })).toBeTruthy();
    expect(media.deletedUris).toEqual(['file:///private/routine.jpg']);

    await fireEvent.press(screen.getByRole('button', { name: 'Volver a ejercicios' }));
    await openExerciseDetail(media, storage);
    expect(screen.getByText('1 elementos multimedia')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir imagen 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reproducir vídeo 1' })).toBeTruthy();
  });

  it('cleans every private copy after confirming exercise deletion', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();

    await render(
      <App
        media={media}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Piernas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );
    await waitFor(() => expect(screen.getByText('2 elementos multimedia')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar ejercicio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    await waitFor(() => expect(screen.getByText('Ejercicio eliminado')).toBeTruthy());
    expect(media.deletedUris).toEqual([
      'file:///private/routine.jpg',
      'file:///private/routine.mp4',
    ]);
    expect(screen.queryByText('Sentadilla')).toBeNull();

    expect(screen.getByText('Aún no hay ejercicios guardados.')).toBeTruthy();
  });

  it('keeps the remaining exercise media visible when one private file is absent', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();

    await render(
      <App
        media={media}
        now={() => new Date(2026, 7, 17, 12)}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByText('Pasos de hoy')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Crear ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Seleccionar grupo Piernas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );
    await waitFor(() => expect(screen.getByText('2 elementos multimedia')).toBeTruthy());

    fireEvent(screen.getByTestId('exercise-media-image-1'), 'error');

    await waitFor(() => expect(screen.getByText('Archivo no disponible')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Reproducir vídeo 2' })).toBeTruthy();
  });
});
