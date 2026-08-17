import AppNavigator from './src/navigation/AppNavigator';
import {
  AppStateProvider,
  type AppStateProviderProps,
} from './src/state/AppStateContext';

export type AppProps = Pick<AppStateProviderProps, 'storage' | 'now' | 'notifications'> &
  Record<string, unknown>;

export default function App({ storage, now, notifications }: AppProps = {}) {
  return (
    <AppStateProvider now={now} notifications={notifications} storage={storage}>
      <AppNavigator />
    </AppStateProvider>
  );
}
