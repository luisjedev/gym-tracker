import AppNavigator from './src/navigation/AppNavigator';
import {
  AppStateProvider,
  type AppStateProviderProps,
} from './src/state/AppStateContext';

export type AppProps = Pick<AppStateProviderProps, 'storage' | 'now'> &
  Record<string, unknown>;

export default function App({ storage, now }: AppProps = {}) {
  return (
    <AppStateProvider now={now} storage={storage}>
      <AppNavigator />
    </AppStateProvider>
  );
}
