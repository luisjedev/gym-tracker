import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { colors } from '../theme';

export const DAILY_STEP_REMINDER_CHANNEL_ID = 'daily-step-reminders';
export const DAILY_STEP_REMINDER_DATA_TYPE = 'gym-tracker-daily-step-reminder';
export const DAILY_STEP_REMINDER_TIME = { hour: 23, minute: 0 } as const;

export type DailyStepReminderPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined';

export interface DailyStepReminderTime {
  hour: number;
  minute: number;
}

export interface DailyStepNotificationAdapter {
  getPermissionStatus(): Promise<DailyStepReminderPermissionStatus>;
  requestPermission(): Promise<DailyStepReminderPermissionStatus>;
  createChannel(): Promise<void>;
  getScheduledDailyStepReminderIds(): Promise<readonly string[]>;
  scheduleDailyStepReminder(time: DailyStepReminderTime): Promise<string>;
  cancelDailyStepReminder(identifier: string): Promise<void>;
}

function getPermissionStatus(response: {
  granted: boolean;
  status?: string;
}): DailyStepReminderPermissionStatus {
  if (response.granted || response.status === 'granted') {
    return 'granted';
  }

  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

export function getDailyStepReminderTime(value: string): DailyStepReminderTime {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    throw new Error('Usa horas válidas en formato HH:MM.');
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

export function validateDailyStepReminderTime(value: string): void {
  getDailyStepReminderTime(value);
}

export const defaultDailyStepNotificationAdapter: DailyStepNotificationAdapter = {
  async getPermissionStatus() {
    return getPermissionStatus(await Notifications.getPermissionsAsync());
  },

  async requestPermission() {
    return getPermissionStatus(await Notifications.requestPermissionsAsync());
  },

  async createChannel() {
    if (Platform.OS !== 'android') {
      return;
    }

    await Notifications.setNotificationChannelAsync(DAILY_STEP_REMINDER_CHANNEL_ID, {
      name: 'Recordatorios de pasos',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: colors.accent,
    });
  },

  async getScheduledDailyStepReminderIds() {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    return scheduledNotifications
      .filter(
        (notification) =>
          notification.content.data?.type === DAILY_STEP_REMINDER_DATA_TYPE,
      )
      .map((notification) => notification.identifier);
  },

  async scheduleDailyStepReminder(time) {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Actualiza tus pasos',
        body: '¿Cuanto has caminado hoy gordito?',
        data: { type: DAILY_STEP_REMINDER_DATA_TYPE },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: DAILY_STEP_REMINDER_CHANNEL_ID,
      },
    });
  },

  async cancelDailyStepReminder(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
};

export const defaultDailyStepReminderAdapter = defaultDailyStepNotificationAdapter;
