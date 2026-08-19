import { StyleSheet } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import App from '../App';
import { LoadingScreen, StorageErrorScreen } from './screens';
import { colors } from './theme';
import type { StorageAdapter } from './storage/appStorage';

class MemoryStorage implements StorageAdapter {
  async getItem() {
    return null;
  }

  async setItem() {}
}

function relativeLuminance(hexColor: string): number {
  const normalizedColor = hexColor.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(
      normalizedColor.slice(offset, offset + 2),
      16,
    ) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(firstColor: string, secondColor: string): number {
  const firstLuminance = relativeLuminance(firstColor);
  const secondLuminance = relativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('dark visual system', () => {
  it('keeps loading, error, screen, and card surfaces in the dark theme', async () => {
    expect(relativeLuminance(colors.background)).toBeLessThan(0.1);
    expect(relativeLuminance(colors.surface)).toBeLessThan(0.15);
    expect(contrastRatio(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.accentText, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.danger, colors.dangerSurface)).toBeGreaterThanOrEqual(4.5);

    const loading = await render(<LoadingScreen />);
    expect(StyleSheet.flatten(screen.getByTestId('loading-screen').props.style)).toMatchObject({
      backgroundColor: colors.background,
    });
    await loading.unmount();

    const error = await render(<StorageErrorScreen onRetry={() => undefined} />);
    expect(StyleSheet.flatten(screen.getByTestId('storage-error-screen').props.style)).toMatchObject({
      backgroundColor: colors.background,
    });
    await error.unmount();

    const app = await render(
      <App storage={new MemoryStorage()} now={() => new Date(2026, 7, 17, 12)} />,
    );
    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());

    expect(StyleSheet.flatten(screen.getByTestId('app-screen').props.style)).toMatchObject({
      backgroundColor: colors.background,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('home-hero').props.style),
    ).toMatchObject({
      backgroundColor: colors.surface,
      borderColor: colors.border,
    });
    await app.unmount();
  });
});
