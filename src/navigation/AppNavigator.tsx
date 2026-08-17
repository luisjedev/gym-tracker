import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import {
  ExercisesScreen,
  HistoryScreen,
  HomeScreen,
  LoadingScreen,
  SettingsScreen,
  StorageErrorScreen,
} from '../screens';
import { useAppState } from '../state/AppStateContext';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function AppNavigator() {
  const { status, retry } = useAppState();

  if (status === 'loading') {
    return <LoadingScreen />;
  }

  if (status === 'error') {
    return <StorageErrorScreen onRetry={retry} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#287A4D',
          tabBarInactiveTintColor: '#718078',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#DCE8DF',
            height: 68,
            paddingBottom: 8,
            paddingTop: 6,
          },
        }}
      >
        <Tab.Screen
          component={HomeScreen}
          name="Home"
          options={{ tabBarLabel: 'Inicio' }}
        />
        <Tab.Screen
          component={ExercisesScreen}
          name="Exercises"
          options={{ tabBarLabel: 'Ejercicios' }}
        />
        <Tab.Screen
          component={HistoryScreen}
          name="History"
          options={{ tabBarLabel: 'Historial' }}
        />
        <Tab.Screen
          component={SettingsScreen}
          name="Settings"
          options={{ tabBarLabel: 'Ajustes' }}
        />
      </Tab.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}
