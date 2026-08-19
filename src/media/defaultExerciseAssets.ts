import type { ImageSourcePropType } from 'react-native';

import {
  DEFAULT_EXERCISE_ASSET_URI_PREFIX,
  isBundledExerciseAssetUri,
} from '../storage/schema';

import abdomenImage from '../../assets/images/exercises/Abdomen.png';
import bicepsImage from '../../assets/images/exercises/biceps.png';
import espaldaImage from '../../assets/images/exercises/Espalda.png';
import gluteosImage from '../../assets/images/exercises/Gluteos.png';
import hombrosImage from '../../assets/images/exercises/hombros.png';
import pechoImage from '../../assets/images/exercises/pecho.png';
import piernasImage from '../../assets/images/exercises/Piernas.png';
import tricepsImage from '../../assets/images/exercises/Triceps.png';

const bundledExerciseImages: Record<string, ImageSourcePropType> = {
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}abdomen`]: abdomenImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}biceps`]: bicepsImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}espalda`]: espaldaImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}gluteos`]: gluteosImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}hombro`]: hombrosImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}pecho`]: pechoImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}piernas`]: piernasImage,
  [`${DEFAULT_EXERCISE_ASSET_URI_PREFIX}triceps`]: tricepsImage,
};

export function getExerciseImageSource(uri: string): ImageSourcePropType {
  if (isBundledExerciseAssetUri(uri)) {
    return bundledExerciseImages[uri];
  }

  return { uri };
}
