import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import App from '../App';
import type {
  DailyStepNotificationAdapter,
  DailyStepReminderPermissionStatus,
  DailyStepReminderTime,
} from './notifications/dailyStepNotifications';
import type { StorageAdapter } from './storage/appStorage';

class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ControlledDailyStepNotifications implements DailyStepNotificationAdapter {
  permission: DailyStepReminderPermissionStatus = 'granted';
  permissionAfterRequest: DailyStepReminderPermissionStatus | null = null;
  readonly scheduled = new Map<string, DailyStepReminderTime>();
  readonly cancelled: string[] = [];
  channelCreations = 0;
  private nextId = 1;

  async getPermissionStatus() {
    return this.permission;
  }

  async requestPermission() {
    const result = this.permissionAfterRequest ?? this.permission;
    this.permission = result;
    return result;
  }

  async createChannel() {
    this.channelCreations += 1;
  }

  async getScheduledDailyStepReminderIds() {
    return [...this.scheduled.keys()];
  }

  async scheduleDailyStepReminder(time: DailyStepReminderTime) {
    const id = `daily-steps-${this.nextId}`;
    this.nextId += 1;
    this.scheduled.set(id, time);
    return id;
  }

  async cancelDailyStepReminder(identifier: string) {
    this.cancelled.push(identifier);
    this.scheduled.delete(identifier);
  }
}

describe('daily step reminder settings', () => {
  it('schedules the selected time, replaces it without duplicates, persists it, and cancels it', async () => {
    const storage = new MemoryStorage();
    const notifications = new ControlledDailyStepNotifications();
    let rendered = await render(
      <App
        now={() => new Date(2026, 7, 17, 12)}
        stepNotifications={notifications}
        storage={storage}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('daily-step-reminder-time-input')).toBeTruthy(),
    );
    expect(screen.getByTestId('daily-step-reminder-time-input').props.value).toBe(
      '23:00',
    );

    await fireEvent(
      screen.getByTestId('daily-step-reminder-enabled-switch'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(1));
    expect([...notifications.scheduled.values()]).toEqual([{ hour: 23, minute: 0 }]);

    await fireEvent.changeText(
      screen.getByTestId('daily-step-reminder-time-input'),
      '22:30',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Guardar recordatorio de pasos' }),
    );
    await waitFor(() =>
      expect([...notifications.scheduled.values()]).toEqual([
        { hour: 22, minute: 30 },
      ]),
    );
    expect(notifications.scheduled.size).toBe(1);
    expect(notifications.cancelled).toHaveLength(1);

    await rendered.unmount();
    rendered = await render(
      <App
        now={() => new Date(2026, 7, 17, 12)}
        stepNotifications={notifications}
        storage={storage}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('home-actions')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /Ajustes/ }));
    await waitFor(() =>
      expect(screen.getByTestId('daily-step-reminder-time-input').props.value).toBe(
        '22:30',
      ),
    );
    expect(notifications.scheduled.size).toBe(1);

    await fireEvent(
      screen.getByTestId('daily-step-reminder-enabled-switch'),
      'valueChange',
      false,
    );
    await waitFor(() => expect(notifications.scheduled.size).toBe(0));
    expect(notifications.cancelled).toHaveLength(3);
    await rendered.unmount();
  });
});
