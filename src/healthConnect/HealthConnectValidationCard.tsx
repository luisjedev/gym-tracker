import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatNumber } from '../formatting';
import { colors } from '../theme';
import {
  runHealthConnectValidation,
  type HealthConnectClient,
  type HealthConnectValidationResult,
} from './steps';

export interface HealthConnectValidationCardProps {
  client?: HealthConnectClient;
  now?: () => Date;
}

function formatDisplayDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function getResultLabel(result: HealthConnectValidationResult): string {
  switch (result.status) {
    case 'ready':
      return 'Lectura completada';
    case 'permission-denied':
      return 'Permiso denegado';
    case 'unavailable':
      return 'No disponible';
    case 'error':
      return 'Error de lectura';
  }
}

export function HealthConnectValidationCard({
  client,
  now,
}: HealthConnectValidationCardProps) {
  const [result, setResult] = useState<HealthConnectValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleValidation() {
    setIsLoading(true);
    try {
      setResult(
        await runHealthConnectValidation(client, {
          now: now?.(),
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.card} testID="health-connect-validation-card">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Validación de Health Connect</Text>
          <Text style={styles.description}>
            Panel técnico para comprobar Mi Fitness → Health Connect → Gym Tracker.
          </Text>
        </View>
        <Text style={styles.marker}>DEV ONLY</Text>
      </View>
      <Text style={styles.note}>
        Solo solicita lectura de Steps. No pide permisos de escritura, no guarda resultados y no
        envía datos fuera del teléfono.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ejecutar validación de Health Connect"
        disabled={isLoading}
        onPress={() => void handleValidation()}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isLoading && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Comprobando…' : 'Solicitar permiso y leer pasos'}
        </Text>
      </Pressable>

      {result ? (
        <View style={styles.result} testID="health-connect-validation-result">
          <Text style={styles.resultTitle}>{getResultLabel(result)}</Text>
          {result.status === 'ready' ? (
            <View style={styles.dayList}>
              <Text style={styles.resultDescription}>
                {result.days.length} días agrupados con la fecha local del teléfono.
              </Text>
              {result.days.map((day) => (
                <View key={day.date} style={styles.dayRow}>
                  <Text style={styles.dayDate}>{formatDisplayDateKey(day.date)}</Text>
                  <Text style={styles.daySteps}>{formatNumber(day.steps)} pasos</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.resultDescription}>{result.message}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.resultDescription}>
          Todavía no se ha ejecutado la comprobación.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 18,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  marker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  note: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  result: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  resultTitle: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  resultDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  dayList: {
    gap: 5,
  },
  dayRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
  },
  dayDate: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  daySteps: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
