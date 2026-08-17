import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_STORAGE_KEY = '@gym-tracker/app-state';

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const defaultStorage: StorageAdapter = AsyncStorage;
