import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

export type ExerciseMediaType = 'image' | 'video';

export interface ExerciseMediaSelection {
  uri: string;
  type: ExerciseMediaType;
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
  mimeType?: string;
}

export interface ExerciseMediaCopy {
  uri: string;
  type: ExerciseMediaType;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ExerciseMediaAdapter {
  selectMedia(): Promise<readonly ExerciseMediaSelection[]>;
  selectCover?(): Promise<ExerciseMediaSelection | null>;
  copyToPrivateStorage(selection: ExerciseMediaSelection): Promise<ExerciseMediaCopy>;
  deletePrivateCopy(uri: string): Promise<void>;
}

const PRIVATE_MEDIA_DIRECTORY_NAME = 'exercise-media';

function getFileExtension(selection: ExerciseMediaSelection): string {
  const candidate = selection.fileName ?? selection.uri.split(/[?#]/, 1)[0];
  const match = /\.([a-z0-9]{1,8})$/i.exec(candidate);

  if (match) {
    return `.${match[1].toLowerCase()}`;
  }

  return selection.type === 'video' ? '.mp4' : '.jpg';
}

function createPrivateFileName(selection: ExerciseMediaSelection): string {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${getFileExtension(selection)}`;
}

function toSelection(
  asset: ImagePicker.ImagePickerAsset,
): ExerciseMediaSelection | null {
  if (asset.type !== 'image' && asset.type !== 'video') {
    return null;
  }

  return {
    uri: asset.uri,
    type: asset.type,
    width: asset.width,
    height: asset.height,
    duration: asset.duration ?? undefined,
    fileName: asset.fileName ?? undefined,
    mimeType: asset.mimeType,
  };
}

const privateMediaDirectory = new Directory(
  Paths.document,
  PRIVATE_MEDIA_DIRECTORY_NAME,
);

export const defaultExerciseMediaAdapter: ExerciseMediaAdapter = {
  async selectMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
      quality: 1,
      selectionLimit: 0,
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.flatMap((asset) => {
      const selection = toSelection(asset);
      return selection ? [selection] : [];
    });
  },

  async selectCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return null;
    }

    const selection = toSelection(result.assets[0]);
    return selection?.type === 'image' ? selection : null;
  },

  async copyToPrivateStorage(selection) {
    privateMediaDirectory.create({ idempotent: true });
    const destination = new File(
      privateMediaDirectory,
      createPrivateFileName(selection),
    );
    const source = new File(selection.uri);
    await source.copy(destination);

    return {
      uri: destination.uri,
      type: selection.type,
      width: selection.width,
      height: selection.height,
      duration: selection.duration,
    };
  },

  async deletePrivateCopy(uri) {
    if (!uri.startsWith('file://')) {
      return;
    }

    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  },
};
