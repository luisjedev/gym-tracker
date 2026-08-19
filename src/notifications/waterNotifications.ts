import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { colors } from '../theme';

export const WATER_NOTIFICATION_CHANNEL_ID = 'water-reminders';
export const WATER_NOTIFICATION_DATA_TYPE = 'gym-tracker-water-reminder';

export type WaterPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface WaterReminderTime {
  hour: number;
  minute: number;
}

export interface WaterNotificationConfiguration {
  startTime: string;
  endTime: string;
  intervalHours: number;
}

export interface WaterNotificationAdapter {
  getPermissionStatus(): Promise<WaterPermissionStatus>;
  requestPermission(): Promise<WaterPermissionStatus>;
  createChannel(): Promise<void>;
  getScheduledWaterReminderIds(): Promise<readonly string[]>;
  scheduleWaterReminder(time: WaterReminderTime): Promise<string>;
  cancelWaterReminder(identifier: string): Promise<void>;
}

function parseClockTime(value: string): WaterReminderTime {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());

  if (!match) {
    throw new Error('Usa horas válidas en formato HH:MM.');
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function toMinutes(time: WaterReminderTime): number {
  return time.hour * 60 + time.minute;
}

function getValidatedWaterConfiguration(
  configuration: WaterNotificationConfiguration,
): { startMinutes: number; endMinutes: number; intervalMinutes: number } {
  const startTime = parseClockTime(configuration.startTime);
  const endTime = parseClockTime(configuration.endTime);
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes >= endMinutes) {
    throw new Error('La hora inicial debe ser anterior a la hora final.');
  }

  if (!Number.isFinite(configuration.intervalHours) || configuration.intervalHours <= 0) {
    throw new Error('El intervalo debe ser un número positivo.');
  }

  const intervalMinutes = configuration.intervalHours * 60;
  if (!Number.isSafeInteger(intervalMinutes)) {
    throw new Error('El intervalo debe equivaler a minutos enteros.');
  }

  return { startMinutes, endMinutes, intervalMinutes };
}

export function validateWaterSettings(
  configuration: WaterNotificationConfiguration,
): void {
  getValidatedWaterConfiguration(configuration);
}

export function getWaterReminderTimes(
  configuration: WaterNotificationConfiguration,
): WaterReminderTime[] {
  const { startMinutes, endMinutes, intervalMinutes } =
    getValidatedWaterConfiguration(configuration);
  const reminders: WaterReminderTime[] = [];

  for (
    let currentMinutes = startMinutes;
    currentMinutes <= endMinutes;
    currentMinutes += intervalMinutes
  ) {
    reminders.push({
      hour: Math.floor(currentMinutes / 60),
      minute: currentMinutes % 60,
    });
  }

  return reminders;
}

function getPermissionStatus(
  response: { granted: boolean; status?: string },
): WaterPermissionStatus {
  if (response.granted || response.status === 'granted') {
    return 'granted';
  }

  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const defaultWaterNotificationAdapter: WaterNotificationAdapter = {
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

    await Notifications.setNotificationChannelAsync(WATER_NOTIFICATION_CHANNEL_ID, {
      name: 'Recordatorios de agua',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: colors.accent,
    });
  },

  async getScheduledWaterReminderIds() {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    return scheduledNotifications
      .filter(
        (notification) =>
          notification.content.data?.type === WATER_NOTIFICATION_DATA_TYPE,
      )
      .map((notification) => notification.identifier);
  },

  async scheduleWaterReminder(time) {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'Bebe agua',
        body: 'Bebe agua gordo, espabila!',
        data: { type: WATER_NOTIFICATION_DATA_TYPE },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: WATER_NOTIFICATION_CHANNEL_ID,
      },
    });
  },

  async cancelWaterReminder(identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
};
