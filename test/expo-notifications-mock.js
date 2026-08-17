module.exports = {
  AndroidImportance: {
    DEFAULT: 5,
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
  cancelScheduledNotificationAsync: async () => undefined,
  getAllScheduledNotificationsAsync: async () => [],
  getPermissionsAsync: async () => ({
    granted: false,
    status: 'undetermined',
  }),
  requestPermissionsAsync: async () => ({
    granted: false,
    status: 'denied',
  }),
  scheduleNotificationAsync: async () => 'notification-id',
  setNotificationChannelAsync: async () => null,
  setNotificationHandler: () => undefined,
};
