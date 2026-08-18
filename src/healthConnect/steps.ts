import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
  type AggregateGroupByPeriodRequest,
  type AggregationGroupResult,
  type Permission,
} from 'react-native-health-connect';

import { formatDateKey } from '../storage/schema';

export const HEALTH_CONNECT_LOOKBACK_DAYS = 30;

export const STEPS_READ_PERMISSION = {
  accessType: 'read',
  recordType: 'Steps',
} satisfies Permission;

export interface LocalDayRange {
  date: string;
  startTime: string;
  endTime: string;
}

export interface LocalDaySteps {
  date: string;
  steps: number;
}

export interface HealthConnectClient {
  getSdkStatus(): Promise<number>;
  initialize(): Promise<boolean>;
  getGrantedPermissions(): Promise<Permission[]>;
  requestPermission(permissions: Permission[]): Promise<Permission[]>;
  aggregateGroupByPeriod(
    request: AggregateGroupByPeriodRequest<'Steps'>,
  ): Promise<AggregationGroupResult<'Steps'>[]>;
}

export type HealthConnectValidationResult =
  | {
      status: 'ready';
      days: LocalDaySteps[];
    }
  | {
      status: 'permission-denied';
      message: string;
    }
  | {
      status: 'unavailable';
      reason: 'unavailable' | 'provider-update-required';
      message: string;
    }
  | {
      status: 'error';
      message: string;
    };

const defaultHealthConnectClient: HealthConnectClient = {
  aggregateGroupByPeriod: (request) => aggregateGroupByPeriod(request),
  getGrantedPermissions: async () =>
    (await getGrantedPermissions()).filter(
      (permission): permission is Permission =>
        'accessType' in permission && 'recordType' in permission,
    ),
  getSdkStatus: () => getSdkStatus(),
  initialize: () => initialize(),
  requestPermission: async (permissions) =>
    (await requestPermission(permissions)).filter(
      (permission): permission is Permission =>
        'accessType' in permission && 'recordType' in permission,
    ),
};

export function getLocalDayRanges(
  now: Date,
  lookbackDays = HEALTH_CONNECT_LOOKBACK_DAYS,
): LocalDayRange[] {
  if (
    !Number.isSafeInteger(lookbackDays) ||
    lookbackDays < 1 ||
    lookbackDays > HEALTH_CONNECT_LOOKBACK_DAYS
  ) {
    throw new Error(
      `El histórico debe incluir entre 1 y ${HEALTH_CONNECT_LOOKBACK_DAYS} días.`,
    );
  }

  if (Number.isNaN(now.getTime())) {
    throw new Error('La fecha de consulta no es válida.');
  }

  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Array.from({ length: lookbackDays }, (_, index) => {
    const start = new Date(
      currentDay.getFullYear(),
      currentDay.getMonth(),
      currentDay.getDate() - lookbackDays + index + 1,
    );
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);

    return {
      date: formatDateKey(start),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  });
}

function hasStepsReadPermission(permissions: readonly Permission[]): boolean {
  return permissions.some(
    (permission) =>
      permission.accessType === STEPS_READ_PERMISSION.accessType &&
      permission.recordType === STEPS_READ_PERMISSION.recordType,
  );
}

function getLocalDateKeyFromGroup(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (!Number.isNaN(date.getTime())) {
    return formatDateKey(date);
  }

  const dateKey = timestamp.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
}

function groupStepsByLocalDate(
  ranges: readonly LocalDayRange[],
  groups: readonly AggregationGroupResult<'Steps'>[],
): LocalDaySteps[] {
  const requestedDates = new Set(ranges.map((range) => range.date));
  const stepsByDate = new Map<string, number>();

  for (const group of groups) {
    const date = getLocalDateKeyFromGroup(group.startTime);
    const count = group.result.COUNT_TOTAL;

    if (
      !date ||
      !requestedDates.has(date) ||
      !Number.isFinite(count) ||
      !Number.isSafeInteger(count) ||
      count < 0
    ) {
      continue;
    }

    stepsByDate.set(date, (stepsByDate.get(date) ?? 0) + count);
  }

  return ranges.map((range) => ({
    date: range.date,
    steps: stepsByDate.get(range.date) ?? 0,
  }));
}

export async function runHealthConnectValidation(
  client: HealthConnectClient = defaultHealthConnectClient,
  options: { now?: Date; lookbackDays?: number } = {},
): Promise<HealthConnectValidationResult> {
  const now = options.now ?? new Date();
  const lookbackDays = options.lookbackDays ?? HEALTH_CONNECT_LOOKBACK_DAYS;
  let sdkStatus: number;

  try {
    sdkStatus = await client.getSdkStatus();
  } catch {
    return {
      status: 'unavailable',
      reason: 'unavailable',
      message: 'Health Connect no está disponible en este dispositivo.',
    };
  }

  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    return {
      status: 'unavailable',
      reason: 'unavailable',
      message: 'Health Connect no está disponible en este dispositivo.',
    };
  }

  if (
    sdkStatus ===
    SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
  ) {
    return {
      status: 'unavailable',
      reason: 'provider-update-required',
      message: 'Health Connect necesita instalarse o actualizarse.',
    };
  }

  if (sdkStatus !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return {
      status: 'unavailable',
      reason: 'unavailable',
      message: 'Health Connect no está disponible en este dispositivo.',
    };
  }

  try {
    if (!(await client.initialize())) {
      return {
        status: 'unavailable',
        reason: 'unavailable',
        message: 'Health Connect no está disponible en este dispositivo.',
      };
    }

    let grantedPermissions = await client.getGrantedPermissions();
    if (!hasStepsReadPermission(grantedPermissions)) {
      grantedPermissions = await client.requestPermission([STEPS_READ_PERMISSION]);
    }

    if (!hasStepsReadPermission(grantedPermissions)) {
      return {
        status: 'permission-denied',
        message: 'No se concedió el permiso de lectura de pasos.',
      };
    }

    const ranges = getLocalDayRanges(now, lookbackDays);
    const groups = await client.aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: ranges[0].startTime,
        endTime: ranges[ranges.length - 1].endTime,
      },
      timeRangeSlicer: {
        length: 1,
        period: 'DAYS',
      },
    });

    return {
      status: 'ready',
      days: groupStepsByLocalDate(ranges, groups),
    };
  } catch {
    return {
      status: 'error',
      message: 'No se pudieron consultar los pasos de Health Connect.',
    };
  }
}
