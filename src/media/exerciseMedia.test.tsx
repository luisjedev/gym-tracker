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
  coverSelection: ExerciseMediaSelection | null = {
    uri: 'content://picked-cover.jpg',
    type: 'image',
    width: 1600,
    height: 900,
    fileName: 'cover.jpg',
  };
  readonly selected: ExerciseMediaSelection[] = [];
  readonly selectedCovers: ExerciseMediaSelection[] = [];
  readonly copies: ExerciseMediaCopy[] = [];
  readonly deletedUris: string[] = [];

  async selectMedia() {
    this.selected.push(...this.selection);
    return this.selection;
  }

  async selectCover() {
    if (this.coverSelection) {
      this.selectedCovers.push(this.coverSelection);
    }
    return this.coverSelection;
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

async function renderExercises(
  media: ControlledExerciseMedia,
  storage: StorageAdapter,
) {
  const rendered = await render(
    <App
      media={media}
      now={() => new Date(2026, 7, 17, 12)}
      storage={storage}
    />,
  );
  await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
  await settleNavigation();
  await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
  return rendered;
}

async function openExerciseGroup(group: string) {
  await fireEvent.press(screen.getByRole('button', { name: `Abrir grupo ${group}` }));
  await waitFor(() => expect(screen.getByTestId('exercise-group-list')).toBeTruthy());
}

async function createExerciseAndOpenDetail(
  media: ControlledExerciseMedia,
  storage: StorageAdapter,
) {
  const rendered = await renderExercises(media, storage);
  await openExerciseGroup('Piernas');
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
  await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));
  await fireEvent.press(
    screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
  );
  return rendered;
}

async function openExerciseDetail(
  media: ControlledExerciseMedia,
  storage: StorageAdapter,
) {
  await renderExercises(media, storage);
  await openExerciseGroup('Piernas');
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

    const firstRender = await createExerciseAndOpenDetail(media, storage);

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

    await createExerciseAndOpenDetail(media, storage);

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
    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await openExerciseGroup('Piernas');
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
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
    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await openExerciseGroup('Piernas');
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
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
    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await openExerciseGroup('Piernas');
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
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

    expect(screen.getByText('Todavía no hay ejercicios en este grupo.')).toBeTruthy();
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
    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ejercicios/ }));
    await settleNavigation();
    await waitFor(() => expect(screen.getByText('Biblioteca de ejercicios')).toBeTruthy());
    await openExerciseGroup('Piernas');
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
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

  it('creates a cover, shows it in the group and restores it after reopening', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();
    const rendered = await renderExercises(media, storage);

    await openExerciseGroup('Piernas');
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir ejercicio' }));
    await fireEvent.changeText(screen.getByTestId('exercise-name-input'), 'Sentadilla');
    await fireEvent.press(screen.getByRole('button', { name: 'Seleccionar portada' }));
    await waitFor(() =>
      expect(screen.getByTestId('exercise-cover-create-preview')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar ejercicio' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' })).toBeTruthy(),
    );
    expect(screen.getByLabelText('Portada de Sentadilla')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Abrir detalle de Sentadilla' }),
    );
    expect(screen.getByTestId(/exercise-cover-detail-exercise-/)).toBeTruthy();
    expect(screen.getByLabelText('Portada de Sentadilla')).toBeTruthy();
    expect(media.selectedCovers).toHaveLength(1);
    expect(media.copies.map((copy) => copy.uri)).toContain('file:///private/cover.jpg');

    await rendered.unmount();
    await openExerciseDetail(media, storage);
    expect(screen.getByLabelText('Portada de Sentadilla')).toBeTruthy();
  });

  it('changes and removes a cover without touching the exercise multimedia', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();
    const rendered = await createExerciseAndOpenDetail(media, storage);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );
    await waitFor(() => expect(screen.getByText('2 elementos multimedia')).toBeTruthy());

    media.coverSelection = {
      uri: 'content://picked-cover-a.jpg',
      type: 'image',
      width: 1000,
      height: 600,
      fileName: 'cover-a.jpg',
    };
    await fireEvent.press(screen.getByRole('button', { name: 'Editar ejercicio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Seleccionar portada' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios del ejercicio' }));
    await waitFor(() => expect(screen.getByLabelText('Portada de Sentadilla')).toBeTruthy());

    media.coverSelection = {
      uri: 'content://picked-cover-b.jpg',
      type: 'image',
      width: 900,
      height: 900,
      fileName: 'cover-b.jpg',
    };
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar portada' }));
    await waitFor(() => expect(screen.getByText('Portada guardada')).toBeTruthy());
    expect(media.deletedUris).toContain('file:///private/cover-a.jpg');
    expect(screen.getByText('2 elementos multimedia')).toBeTruthy();
    expect(media.deletedUris).not.toContain('file:///private/routine.jpg');
    expect(media.deletedUris).not.toContain('file:///private/routine.mp4');

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar portada' }));
    await waitFor(() => expect(screen.getByText('Portada eliminada')).toBeTruthy());
    expect(media.deletedUris).toContain('file:///private/cover-b.jpg');
    expect(screen.getByText('2 elementos multimedia')).toBeTruthy();

    await rendered.unmount();
    await openExerciseDetail(media, storage);
    expect(screen.queryByLabelText('Portada de Sentadilla')).toBeNull();
    expect(screen.getByText('2 elementos multimedia')).toBeTruthy();
  });

  it('keeps the previous cover and multimedia when replacing a cover cannot be persisted', async () => {
    const storage = new MemoryStorage();
    const media = new ControlledExerciseMedia();
    await createExerciseAndOpenDetail(media, storage);

    media.coverSelection = {
      uri: 'content://picked-cover-a.jpg',
      type: 'image',
      fileName: 'cover-a.jpg',
    };
    await fireEvent.press(screen.getByRole('button', { name: 'Seleccionar portada' }));
    await waitFor(() => expect(screen.getByText('Portada guardada')).toBeTruthy());
    await fireEvent.press(
      screen.getByRole('button', { name: 'Añadir imágenes y vídeos' }),
    );
    await waitFor(() => expect(screen.getByText('2 elementos multimedia')).toBeTruthy());

    storage.failWrites = true;
    media.coverSelection = {
      uri: 'content://picked-cover-b.jpg',
      type: 'image',
      fileName: 'cover-b.jpg',
    };
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar portada' }));

    await waitFor(() => expect(screen.getByText('write failed')).toBeTruthy());
    expect(media.deletedUris).toEqual(['file:///private/cover-b.jpg']);
    expect(screen.getByLabelText('Portada de Sentadilla')).toBeTruthy();
    expect(screen.getByText('2 elementos multimedia')).toBeTruthy();
  });
});
