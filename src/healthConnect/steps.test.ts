import { SdkAvailabilityStatus, type Permission } from 'react-native-health-connect';

import {
  getLocalDayRanges,
  runHealthConnectValidation,
  STEPS_READ_PERMISSION,
  type HealthConnectClient,
} from './steps';

class FakeHealthConnectClient implements HealthConnectClient {
  sdkStatus: number = SdkAvailabilityStatus.SDK_AVAILABLE;
  initialized = true;
  grantedPermissions: Permission[] = [];
  permissionsAfterRequest: Permission[] = [];
  groups: Awaited<ReturnType<HealthConnectClient['aggregateGroupByPeriod']>> = [];
  requestedPermissions: Permission[] = [];
  aggregateRequests: Parameters<HealthConnectClient['aggregateGroupByPeriod']>[0][] = [];

  async getSdkStatus() {
    return this.sdkStatus;
  }

  async initialize() {
    return this.initialized;
  }

  async getGrantedPermissions() {
    return this.grantedPermissions;
  }

  async requestPermission(permissions: Permission[]) {
    this.requestedPermissions = permissions;
    this.grantedPermissions = this.permissionsAfterRequest;
    return this.permissionsAfterRequest;
  }

  async aggregateGroupByPeriod(
    request: Parameters<HealthConnectClient['aggregateGroupByPeriod']>[0],
  ) {
    this.aggregateRequests.push(request);
    return this.groups;
  }
}

describe('Health Connect step validation', () => {
  it('builds local calendar-day ranges across the requested lookback', () => {
    const now = new Date(2026, 7, 17, 12, 30);
    const ranges = getLocalDayRanges(now, 3);

    expect(ranges.map((range) => range.date)).toEqual([
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
    ]);
    expect(new Date(ranges[0].startTime).getHours()).toBe(0);
    expect(new Date(ranges[0].endTime).getHours()).toBe(0);
    expect(new Date(ranges[2].endTime).getDate()).toBe(18);
  });

  it('caps the validation lookback at the permission-free Health Connect history window', () => {
    expect(() => getLocalDayRanges(new Date(2026, 7, 17, 12), 31)).toThrow(
      'El histórico debe incluir entre 1 y 30 días.',
    );
  });

  it('requests only read access and returns current plus historical days by local date', async () => {
    const client = new FakeHealthConnectClient();
    const now = new Date(2026, 7, 17, 12, 30);
    client.permissionsAfterRequest = [STEPS_READ_PERMISSION];
    client.groups = [
      {
        startTime: new Date(2026, 7, 16).toISOString(),
        endTime: new Date(2026, 7, 17).toISOString(),
        result: { COUNT_TOTAL: 5_432, dataOrigins: ['com.xiaomi.wearable'] },
      },
      {
        startTime: new Date(2026, 7, 17).toISOString(),
        endTime: new Date(2026, 7, 18).toISOString(),
        result: { COUNT_TOTAL: 7_654, dataOrigins: ['com.xiaomi.wearable'] },
      },
    ];

    const result = await runHealthConnectValidation(client, {
      now,
      lookbackDays: 3,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      return;
    }

    expect(result.days).toEqual([
      { date: '2026-08-15', steps: 0 },
      { date: '2026-08-16', steps: 5_432 },
      { date: '2026-08-17', steps: 7_654 },
    ]);
    expect(client.requestedPermissions).toEqual([STEPS_READ_PERMISSION]);
    expect(client.requestedPermissions).not.toContainEqual({
      accessType: 'write',
      recordType: 'Steps',
    });
    expect(client.aggregateRequests[0]).toMatchObject({
      recordType: 'Steps',
      timeRangeSlicer: { length: 1, period: 'DAYS' },
    });
  });

  it('does not query data after the user denies the read permission', async () => {
    const client = new FakeHealthConnectClient();
    client.permissionsAfterRequest = [];

    const result = await runHealthConnectValidation(client, {
      now: new Date(2026, 7, 17, 12),
      lookbackDays: 2,
    });

    expect(result).toEqual({
      status: 'permission-denied',
      message: 'No se concedió el permiso de lectura de pasos.',
    });
    expect(client.aggregateRequests).toHaveLength(0);
  });

  it('reports an unavailable provider without trying to initialize it', async () => {
    const client = new FakeHealthConnectClient();
    client.sdkStatus = SdkAvailabilityStatus.SDK_UNAVAILABLE;
    client.initialized = false;

    const result = await runHealthConnectValidation(client, {
      now: new Date(2026, 7, 17, 12),
      lookbackDays: 2,
    });

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'unavailable',
      message: 'Health Connect no está disponible en este dispositivo.',
    });
  });

  it('reports a provider that needs an update separately from an unavailable provider', async () => {
    const client = new FakeHealthConnectClient();
    client.sdkStatus =
      SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED;

    const result = await runHealthConnectValidation(client, {
      now: new Date(2026, 7, 17, 12),
      lookbackDays: 2,
    });

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'provider-update-required',
      message: 'Health Connect necesita instalarse o actualizarse.',
    });
  });
});
