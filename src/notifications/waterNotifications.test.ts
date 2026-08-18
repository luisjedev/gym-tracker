import * as Notifications from 'expo-notifications';

import {
  defaultWaterNotificationAdapter,
  getWaterReminderTimes,
  validateWaterSettings,
  WATER_NOTIFICATION_DATA_TYPE,
} from './waterNotifications';

const defaultConfiguration = {
  startTime: '08:00',
  endTime: '22:00',
  intervalHours: 2,
};

describe('water reminder scheduling', () => {
  it('includes every configured two-hour reminder in the initial window', () => {
    expect(getWaterReminderTimes(defaultConfiguration)).toEqual([
      { hour: 8, minute: 0 },
      { hour: 10, minute: 0 },
      { hour: 12, minute: 0 },
      { hour: 14, minute: 0 },
      { hour: 16, minute: 0 },
      { hour: 18, minute: 0 },
      { hour: 20, minute: 0 },
      { hour: 22, minute: 0 },
    ]);
  });

  it('rejects an invalid window and a non-positive interval', () => {
    expect(() => validateWaterSettings({
      startTime: '22:00',
      endTime: '08:00',
      intervalHours: 2,
    })).toThrow('La hora inicial debe ser anterior a la hora final.');

    expect(() => validateWaterSettings({
      startTime: '08:00',
      endTime: '22:00',
      intervalHours: 0,
    })).toThrow('El intervalo debe ser un número positivo.');
  });

  it('accepts a positive fractional interval when it maps to whole minutes', () => {
    expect(getWaterReminderTimes({
      startTime: '08:00',
      endTime: '11:00',
      intervalHours: 1.5,
    })).toEqual([
      { hour: 8, minute: 0 },
      { hour: 9, minute: 30 },
      { hour: 11, minute: 0 },
    ]);
  });

  it('does not produce a reminder after the configured end time', () => {
    expect(getWaterReminderTimes({
      startTime: '09:30',
      endTime: '14:00',
      intervalHours: 2,
    })).toEqual([
      { hour: 9, minute: 30 },
      { hour: 11, minute: 30 },
      { hour: 13, minute: 30 },
    ]);
  });

  it('filters scheduled notifications to the app-owned water reminders', async () => {
    const scheduledNotifications = jest.spyOn(
      Notifications,
      'getAllScheduledNotificationsAsync',
    );
    scheduledNotifications.mockResolvedValue([
      {
        identifier: 'water-1',
        content: {
          data: { type: WATER_NOTIFICATION_DATA_TYPE },
        },
        trigger: null,
      },
      {
        identifier: 'foreign-1',
        content: {
          data: { type: 'other-app-reminder' },
        },
        trigger: null,
      },
    ] as unknown as Notifications.NotificationRequest[]);

    await expect(
      defaultWaterNotificationAdapter.getScheduledWaterReminderIds(),
    ).resolves.toEqual(['water-1']);
    scheduledNotifications.mockRestore();
  });
});
