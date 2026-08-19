import { StatusBar } from 'expo-status-bar';

import AppNavigator from './src/navigation/AppNavigator';
import {
  AppStateProvider,
  type AppStateProviderProps,
} from './src/state/AppStateContext';

export type AppProps = Pick<
  AppStateProviderProps,
  'media' | 'storage' | 'now' | 'notifications' | 'stepNotifications'
> & Record<string, unknown>;

export default function App({
  media,
  storage,
  now,
  notifications,
  stepNotifications,
}: AppProps = {}) {
  return (
    <AppStateProvider
      media={media}
      now={now}
      notifications={notifications}
      stepNotifications={stepNotifications}
      storage={storage}
    >
      <>
        <StatusBar style="light" />
        <AppNavigator />
      </>
    </AppStateProvider>
  );
}
