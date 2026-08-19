import * as Notifications from 'expo-notifications';

import {
  DAILY_STEP_REMINDER_DATA_TYPE,
  DAILY_STEP_REMINDER_TIME,
  defaultDailyStepNotificationAdapter,
  getDailyStepReminderTime,
  validateDailyStepReminderTime,
} from './dailyStepNotifications';

describe('daily step reminder notifications', () => {
  it('uses the configured daily time and defaults to eleven at night', () => {
    expect(DAILY_STEP_REMINDER_TIME).toEqual({ hour: 23, minute: 0 });
    expect(getDailyStepReminderTime('21:45')).toEqual({ hour: 21, minute: 45 });
  });

  it('rejects malformed clock values', () => {
    expect(() => validateDailyStepReminderTime('24:00')).toThrow(
      'Usa horas válidas en formato HH:MM.',
    );
    expect(() => validateDailyStepReminderTime('23:60')).toThrow(
      'Usa horas válidas en formato HH:MM.',
    );
  });

  it('filters scheduled notifications to the app-owned step reminder', async () => {
    const scheduledNotifications = jest.spyOn(
      Notifications,
      'getAllScheduledNotificationsAsync',
    );
    scheduledNotifications.mockResolvedValue([
      {
        identifier: 'steps-1',
        content: {
          data: { type: DAILY_STEP_REMINDER_DATA_TYPE },
        },
        trigger: null,
      },
      {
        identifier: 'water-1',
        content: {
          data: { type: 'gym-tracker-water-reminder' },
        },
        trigger: null,
      },
    ] as unknown as Notifications.NotificationRequest[]);

    await expect(
      defaultDailyStepNotificationAdapter.getScheduledDailyStepReminderIds(),
    ).resolves.toEqual(['steps-1']);

    scheduledNotifications.mockRestore();
  });

  it('schedules a daily notification with the selected time and owned data type', async () => {
    const scheduleNotification = jest.spyOn(
      Notifications,
      'scheduleNotificationAsync',
    );

    await defaultDailyStepNotificationAdapter.scheduleDailyStepReminder({
      hour: 22,
      minute: 30,
    });

    expect(scheduleNotification).toHaveBeenCalledWith({
      content: {
        title: 'Actualiza tus pasos',
        body: 'Registra el total de pasos de hoy para guardar tu progreso.',
        data: { type: DAILY_STEP_REMINDER_DATA_TYPE },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 22,
        minute: 30,
        channelId: 'daily-step-reminders',
      },
    });
    scheduleNotification.mockRestore();
  });
});
