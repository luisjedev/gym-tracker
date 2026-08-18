import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import { HealthConnectValidationCard } from './HealthConnectValidationCard';
import { STEPS_READ_PERMISSION, type HealthConnectClient } from './steps';

function createClient(overrides: Partial<HealthConnectClient> = {}): HealthConnectClient {
  return {
    aggregateGroupByPeriod: jest.fn(async () => [
      {
        startTime: new Date(2026, 7, 16).toISOString(),
        endTime: new Date(2026, 7, 17).toISOString(),
        result: { COUNT_TOTAL: 5_432, dataOrigins: ['com.xiaomi.wearable'] },
      },
    ]),
    getGrantedPermissions: jest.fn(async () => []),
    getSdkStatus: jest.fn(async () => SdkAvailabilityStatus.SDK_AVAILABLE),
    initialize: jest.fn(async () => true),
    requestPermission: jest.fn(async (_permissions: Permission[]) => [STEPS_READ_PERMISSION]),
    ...overrides,
  };
}

describe('HealthConnectValidationCard', () => {
  it('shows the locally grouped current and historical values after a successful read', async () => {
    const client = createClient();

    await render(
      <HealthConnectValidationCard
        client={client}
        now={() => new Date(2026, 7, 17, 12)}
      />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ejecutar validación de Health Connect' }),
    );

    await waitFor(() => expect(screen.getByText('Lectura completada')).toBeTruthy());
    expect(screen.getByText('16/08/2026')).toBeTruthy();
    expect(screen.getByText('5.432 pasos')).toBeTruthy();
    expect(screen.getByText('17/08/2026')).toBeTruthy();
    expect(screen.getAllByText('0 pasos').length).toBeGreaterThan(0);
    expect(client.requestPermission).toHaveBeenCalledWith([STEPS_READ_PERMISSION]);
  });

  it('shows the denial state without exposing a fake successful reading', async () => {
    const client = createClient({
      requestPermission: jest.fn(async (_permissions: Permission[]) => []),
    });

    await render(<HealthConnectValidationCard client={client} />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ejecutar validación de Health Connect' }),
    );

    await waitFor(() => expect(screen.getByText('Permiso denegado')).toBeTruthy());
    expect(screen.getByText('No se concedió el permiso de lectura de pasos.')).toBeTruthy();
    expect(client.aggregateGroupByPeriod).not.toHaveBeenCalled();
  });
});
