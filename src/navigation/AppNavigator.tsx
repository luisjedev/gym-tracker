import {
  DarkTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  ExercisesScreen,
  HistoryScreen,
  HomeScreen,
  LoadingScreen,
  SettingsScreen,
  StorageErrorScreen,
} from '../screens';
import { NavigationIcon } from '../components/icons';
import { useAppState } from '../state/AppStateContext';
import { colors } from '../theme';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    notification: colors.danger,
    primary: colors.accent,
    text: colors.text,
  },
};

export default function AppNavigator() {
  const { status, retry } = useAppState();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'error') {
    return <StorageErrorScreen onRetry={retry} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          tabBarActiveBackgroundColor: colors.surfaceRaised,
          tabBarIconStyle: {
            marginTop: 2,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '800',
          },
          tabBarItemStyle: {
            borderRadius: 14,
            marginHorizontal: 4,
            marginVertical: 6,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 74,
            paddingBottom: 6,
            paddingTop: 4,
          },
        }}
      >
        <Tab.Screen
          component={HomeScreen}
          name="Home"
          options={{
            tabBarIcon: ({ color, size }) => (
              <NavigationIcon color={color} name="home" size={size} />
            ),
            tabBarLabel: 'Inicio',
          }}
        />
        <Tab.Screen
          component={ExercisesScreen}
          name="Exercises"
          options={{
            tabBarIcon: ({ color, size }) => (
              <NavigationIcon color={color} name="exercises" size={size} />
            ),
            tabBarLabel: 'Ejercicios',
          }}
        />
        <Tab.Screen
          component={HistoryScreen}
          name="History"
          options={{
            tabBarIcon: ({ color, size }) => (
              <NavigationIcon color={color} name="history" size={size} />
            ),
            tabBarLabel: 'Historial',
          }}
        />
        <Tab.Screen
          component={SettingsScreen}
          name="Settings"
          options={{
            tabBarIcon: ({ color, size }) => (
              <NavigationIcon color={color} name="settings" size={size} />
            ),
            tabBarLabel: 'Ajustes',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
