import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateFastingDurationMinutes,
  getAverageFastingDurationMinutes,
  getFirstValidEatingTime,
  getWeeklyFastingSummary,
  type WeeklyFastingDay,
} from './storage/fasting';
import {
  getHistoryDays,
  getHistoryFastings,
  getHistoryWeeks,
} from './storage/history';
import {
  getProgressStatistics,
  type WeeklyGoalStatistics,
} from './storage/statistics';
import type { ExerciseMediaSelection } from './media/exerciseMedia';
import { useAppState } from './state/AppStateContext';
import {
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_WATER_SETTINGS,
  formatDateKey,
  getMondayDateKey,
  sortExercises,
  type Exercise,
  type ExerciseCover,
  type MediaItem,
  type MuscleGroup,
  type StrengthSession,
  type StrengthSessionInput,
  type WaterSettings,
  type WeeklyRecord,
} from './storage/schema';
import type { RootTabParamList } from './navigation/types';
import { colors } from './theme';

export function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseNonNegativeInteger(value: string): number | null {
  const normalizedValue = value.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

function parsePositiveNumber(value: string): number | null {
  const normalizedValue = value.trim().replace(',', '.');

  if (!/^\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function formatFastingDuration(durationMinutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(durationMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const datePart = [date.getDate(), date.getMonth() + 1, date.getFullYear()]
    .map((part) => String(part).padStart(2, '0'))
    .join('/');
  const timePart = [date.getHours(), date.getMinutes()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');

  return `${datePart}, ${timePart}`;
}

function formatHistoryDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} testID="app-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.appName}>GYM TRACKER</Text>
        <Text style={styles.screenTitle}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function getStrengthProgressStatus(completed: number, goal: number): string {
  if (completed >= goal) {
    return 'Completado';
  }

  return completed > 0 ? 'Parcial' : 'Pendiente';
}

function getProgressPercentage(current: number, goal: number): number {
  if (goal <= 0) {
    return current >= goal ? 100 : 0;
  }

  return Math.min(100, Math.max(0, Math.round((current / goal) * 100)));
}

const PROGRESS_SEGMENT_COUNT = 32;

function CircularProgress({
  current,
  goal,
  label,
  size,
  testID,
}: {
  current: number;
  goal: number;
  label: string;
  size: number;
  testID: string;
}) {
  const percentage = getProgressPercentage(current, goal);
  const completedSegmentCount = Math.ceil(
    (percentage / 100) * PROGRESS_SEGMENT_COUNT,
  );
  const segmentWidth = size >= 160 ? 8 : 7;
  const segmentHeight = size >= 160 ? 22 : 18;
  const segmentRadius = size / 2 - 15;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatNumber(current)} de ${formatNumber(goal)}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percentage, text: `${percentage}%` }}
      style={[styles.circularProgress, { height: size, width: size }]}
      testID={testID}
    >
      {Array.from({ length: PROGRESS_SEGMENT_COUNT }, (_, index) => {
        const angle = (index / PROGRESS_SEGMENT_COUNT) * Math.PI * 2 - Math.PI / 2;
        const angleInDegrees = (index / PROGRESS_SEGMENT_COUNT) * 360;
        const left = size / 2 + Math.cos(angle) * segmentRadius - segmentWidth / 2;
        const top = size / 2 + Math.sin(angle) * segmentRadius - segmentHeight / 2;

        return (
          <View
            key={`${testID}-segment-${index}`}
            style={[
              styles.progressSegment,
              {
                backgroundColor:
                  index < completedSegmentCount
                    ? colors.accent
                    : colors.neutralSurface,
                height: segmentHeight,
                left,
                transform: [{ rotate: `${angleInDegrees + 90}deg` }],
                width: segmentWidth,
                top,
              },
            ]}
            testID={`${testID}-segment-${index}`}
          />
        );
      })}
      <View pointerEvents="none" style={styles.circularProgressCenter}>
        <Text style={styles.circularProgressCurrent}>{formatNumber(current)}</Text>
        <Text style={styles.circularProgressGoal}>de {formatNumber(goal)}</Text>
        <Text style={styles.circularProgressPercentage}>{percentage}%</Text>
      </View>
    </View>
  );
}

function toStrengthSessionInput(session: StrengthSession): StrengthSessionInput {
  return {
    name: session.name,
    muscleGroupIds: [...session.muscleGroupIds],
  };
}

function getSessionGroups(
  session: StrengthSession,
  muscleGroups: readonly MuscleGroup[],
): MuscleGroup[] {
  return session.muscleGroupIds.flatMap((groupId) => {
    const group = muscleGroups.find((item) => item.id === groupId);
    return group ? [group] : [];
  });
}

function MuscleGroupLinks({
  groups,
  keyPrefix,
  onOpenGroup,
  getAccessibilityLabel,
}: {
  groups: readonly MuscleGroup[];
  keyPrefix: string;
  onOpenGroup: (groupId: string) => void;
  getAccessibilityLabel: (group: MuscleGroup) => string;
}) {
  return (
    <View style={styles.sessionGroupList}>
      {groups.map((group) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={getAccessibilityLabel(group)}
          key={`${keyPrefix}-${group.id}`}
          onPress={() => onOpenGroup(group.id)}
          style={({ pressed }) => [
            styles.sessionGroupChip,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.sessionGroupChipText}>{group.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function StrengthSessionRow({
  session,
  muscleGroups,
  onOpenGroup,
  onToggle,
}: {
  session: StrengthSession;
  muscleGroups: MuscleGroup[];
  onOpenGroup: (groupId: string) => void;
  onToggle: (session: StrengthSession) => void;
}) {
  return (
    <View style={styles.strengthSessionRow}>
      <View style={styles.listRow}>
        <View style={styles.listRowCopy}>
          <Text style={styles.listRowTitle}>{session.name}</Text>
          <Text style={styles.mutedText}>
            {session.completed ? 'Completada' : 'Pendiente'}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={session.completed ? 'Completada' : 'Pendiente'}
          style={[
            styles.statusPill,
            session.completed ? styles.statusPillDone : styles.statusPillPending,
          ]}
        >
          <Text style={styles.statusPillText}>{session.completed ? '✓' : '—'}</Text>
        </View>
      </View>
      <MuscleGroupLinks
        getAccessibilityLabel={(group) =>
          `Abrir grupo ${group.name} en ${session.name}`
        }
        groups={muscleGroups}
        keyPrefix={session.id}
        onOpenGroup={onOpenGroup}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          session.completed
            ? `Desmarcar sesión ${session.name}`
            : `Marcar sesión ${session.name} como completada`
        }
        accessibilityState={{ selected: session.completed }}
        onPress={() => onToggle(session)}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryButtonText}>
          {session.completed ? 'Desmarcar sesión' : 'Marcar como completada'}
        </Text>
      </Pressable>
    </View>
  );
}

const FASTING_WEEKDAY_LABELS = [
  { short: 'Lun', full: 'Lunes' },
  { short: 'Mar', full: 'Martes' },
  { short: 'Mié', full: 'Miércoles' },
  { short: 'Jue', full: 'Jueves' },
  { short: 'Vie', full: 'Viernes' },
  { short: 'Sáb', full: 'Sábado' },
  { short: 'Dom', full: 'Domingo' },
] as const;

function getFastingDayHours(durationMinutes: number | null): number {
  return durationMinutes === null
    ? 0
    : Math.max(0, Math.floor(durationMinutes / 60));
}

function getFastingDayPresentation(status: WeeklyFastingDay['status']) {
  const presentations = {
    neutral: {
      circleStyle: styles.fastingDayCircleNeutral,
      statusLabel: 'sin ayuno iniciado',
    },
    success: {
      circleStyle: styles.fastingDayCircleSuccess,
      statusLabel: 'más de 15 horas',
    },
    danger: {
      circleStyle: styles.fastingDayCircleDanger,
      statusLabel: '15 horas o menos o sin ayuno válido',
    },
    active: {
      circleStyle: styles.fastingDayCircleActive,
      statusLabel: 'ayuno activo',
    },
  };

  return presentations[status];
}

function FastingWeekSummary({ days }: { days: readonly WeeklyFastingDay[] }) {
  return (
    <View style={styles.fastingWeekSummary} testID="home-fasting-week">
      <Text style={styles.fastingSummaryTitle}>Resumen semanal</Text>
      <View style={styles.fastingDayList}>
        {days.map((day, index) => {
          const weekday = FASTING_WEEKDAY_LABELS[index];
          const hours = getFastingDayHours(day.durationMinutes);
          const presentation = getFastingDayPresentation(day.status);

          return (
            <View
              key={day.date}
              style={styles.fastingDayItem}
              testID={`home-fasting-day-${day.date}`}
            >
              <Text style={styles.fastingDayLabel}>{weekday.short}</Text>
              <View
                accessible
                accessibilityLabel={`${weekday.full}: ${hours} horas, ${presentation.statusLabel}`}
                style={[styles.fastingDayCircle, presentation.circleStyle]}
                testID={`home-fasting-day-${day.date}-circle`}
              >
                <Text style={styles.fastingDayHours}>{formatNumber(hours)}</Text>
                <Text style={styles.fastingDayHoursUnit}>h</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.emptyText}>
        Verde: más de 15 h · rojo: 15 h o menos · amarillo: ayuno activo
      </Text>
    </View>
  );
}

function FastingEatingGuidance({
  startedAt,
  currentTime,
}: {
  startedAt: string;
  currentTime: Date;
}) {
  const firstValidEatingTime = getFirstValidEatingTime(startedAt);
  const canEat = currentTime.getTime() >= firstValidEatingTime.getTime();

  return (
    <View style={styles.fastingGuidance}>
      <Text style={styles.supportText}>
        Primera hora válida para comer: {formatTimestamp(firstValidEatingTime.toISOString())}
      </Text>
      <Text style={[styles.supportText, canEat && styles.activeMetricText]}>
        {canEat ? 'Ya puedes comer' : 'Aún no puedes comer'}
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const {
    state,
    currentDay,
    currentTime,
    currentWeek,
    errorMessage,
    finishFasting,
    markHiitSessionCompleted,
    setStrengthSessionCompleted,
    startFasting,
    undoHiitSession,
    updateDailySteps,
  } = useAppState();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [stepsInput, setStepsInput] = useState(
    currentDay?.steps === null || currentDay?.steps === undefined
      ? ''
      : String(currentDay.steps),
  );
  const [stepsValidationError, setStepsValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Keep the form aligned with the local day when the app resumes or rehydrates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepsInput(
      currentDay?.steps === null || currentDay?.steps === undefined
        ? ''
        : String(currentDay.steps),
    );
    setStepsValidationError(null);
  }, [currentDay?.date, currentDay?.steps]);

  if (!state) {
    return null;
  }

  const stepGoal = currentDay?.stepGoal ?? state.settings.dailyStepGoal;
  const currentSteps = currentDay?.steps ?? 0;
  const remainingSteps = Math.max(stepGoal - currentSteps, 0);
  const strengthSessions = currentWeek?.strengthSessions ?? state.settings.strengthSessions;
  const completedStrength = strengthSessions.filter((session) => session.completed).length;
  const strengthGoal = currentWeek?.strengthGoal ?? strengthSessions.length;
  const strengthStatus = getStrengthProgressStatus(completedStrength, strengthGoal);
  const nextStrengthSession = strengthSessions.find((session) => !session.completed);
  const nextStrengthGroups = nextStrengthSession
    ? getSessionGroups(nextStrengthSession, DEFAULT_MUSCLE_GROUPS)
    : [];
  const hiitCompleted = currentWeek?.hiitCompleted ?? 0;
  const hiitGoal = currentWeek?.hiitGoal ?? state.settings.hiitWeeklyGoal;
  const hiitStatus = getStrengthProgressStatus(hiitCompleted, hiitGoal);
  const hiitRemaining = Math.max(hiitGoal - hiitCompleted, 0);
  const activeFasting = state.fasting.active;
  const activeFastingDuration = activeFasting
    ? calculateFastingDurationMinutes(
        activeFasting.startedAt,
        currentTime.toISOString(),
      )
    : null;
  const lastCompletedFasting = getHistoryFastings(state.fasting.completed)[0] ?? null;
  const weeklyFastingSummary = getWeeklyFastingSummary(
    state.fasting.completed,
    activeFasting,
    currentTime,
  );
  const fastingGuidanceStart = activeFasting?.startedAt ?? lastCompletedFasting?.startedAt;
  const averageFastingDuration = getAverageFastingDurationMinutes(
    state.fasting.completed,
  );
  const averageFastingDurationLabel =
    averageFastingDuration === null
      ? 'Sin ayunos finalizados'
      : formatFastingDuration(averageFastingDuration);

  async function handleSaveSteps() {
    setStepsValidationError(null);
    const parsedSteps = parseNonNegativeInteger(stepsInput);

    if (parsedSteps === null) {
      setStepsValidationError('Escribe un número entero de pasos igual o mayor que cero.');
      return;
    }

    try {
      await updateDailySteps(parsedSteps);
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  async function handleStartFasting() {
    try {
      await startFasting();
    } catch {
      // El contexto conserva el estado anterior y muestra el error de almacenamiento.
    }
  }

  async function handleFinishFasting() {
    try {
      await finishFasting();
    } catch {
      // El contexto conserva el estado anterior y muestra el error de almacenamiento.
    }
  }

  async function handleToggleStrengthSession(session: StrengthSession) {
    try {
      await setStrengthSessionCompleted(session.id, !session.completed);
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  async function handleMarkHiitSession() {
    try {
      await markHiitSessionCompleted();
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  async function handleUndoHiitSession() {
    try {
      await undoHiitSession();
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  function openMuscleGroup(groupId: string) {
    navigation.navigate('Exercises', { groupId });
  }

  return (
    <Screen title="Inicio">
      <Text style={styles.introText}>Tu resumen de hoy y de esta semana.</Text>

      <Card testID="home-card">
        <SectionLabel>Pasos de hoy</SectionLabel>
        <View style={styles.dashboardProgressRow}>
          <CircularProgress
            current={currentSteps}
            goal={stepGoal}
            label="Pasos diarios"
            size={156}
            testID="home-daily-progress"
          />
          <View style={styles.dashboardProgressCopy}>
            <Text style={styles.metricText}>
              {formatNumber(currentSteps)} / {formatNumber(stepGoal)} pasos
            </Text>
            <Text style={styles.supportText}>
              Objetivo: {formatNumber(stepGoal)} pasos
            </Text>
            <Text style={styles.supportText}>
              {remainingSteps > 0
                ? `Faltan ${formatNumber(remainingSteps)} pasos`
                : 'Objetivo completado'}
            </Text>
            {currentDay?.steps === null || currentDay?.steps === undefined ? (
              <Text style={styles.emptyText}>
                Todavía no hay pasos registrados. Introduce el total de hoy.
              </Text>
            ) : null}
          </View>
        </View>
        <TextInput
          accessibilityLabel="Pasos de hoy"
          autoCapitalize="none"
          keyboardType="number-pad"
          onChangeText={(value) => {
            setStepsInput(value);
            setStepsValidationError(null);
          }}
          placeholder="Número de pasos"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="daily-steps-input"
          value={stepsInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar pasos"
          onPress={() => void handleSaveSteps()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Guardar pasos</Text>
        </Pressable>
        {stepsValidationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {stepsValidationError}
          </Text>
        ) : null}
        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
      </Card>

      <Card testID="home-fasting-card">
        <SectionLabel>Ayuno</SectionLabel>
        <FastingWeekSummary days={weeklyFastingSummary} />
        {activeFasting && activeFastingDuration !== null ? (
          <>
            <Text style={[styles.metricText, styles.activeMetricText]}>Ayuno activo</Text>
            <Text style={styles.supportText}>
              Hora de inicio: {formatTimestamp(activeFasting.startedAt)}
            </Text>
            <Text style={styles.supportText}>
              Duración: {formatFastingDuration(activeFastingDuration)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.metricText}>No hay un ayuno activo.</Text>
            <Text style={styles.supportText}>
              Último ayuno:{' '}
              {lastCompletedFasting
                ? formatFastingDuration(lastCompletedFasting.durationMinutes)
                : 'Sin ayunos finalizados'}
            </Text>
          </>
        )}
        {fastingGuidanceStart ? (
          <FastingEatingGuidance
            currentTime={currentTime}
            startedAt={fastingGuidanceStart}
          />
        ) : null}
        <Text style={styles.supportText}>
          Duración media: {averageFastingDurationLabel}
        </Text>
        {activeFasting && activeFastingDuration !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Finalizar ayuno"
            onPress={() => void handleFinishFasting()}
            style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
          >
            <Text style={styles.dangerButtonText}>Finalizar ayuno</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Iniciar ayuno"
            onPress={() => void handleStartFasting()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Iniciar ayuno</Text>
          </Pressable>
        )}
      </Card>

      <Card>
        <SectionLabel>Fuerza semanal</SectionLabel>
        <View style={styles.dashboardProgressRow}>
          <CircularProgress
            current={completedStrength}
            goal={strengthGoal}
            label="Fuerza semanal"
            size={132}
            testID="home-strength-progress"
          />
          <View style={styles.dashboardProgressCopy}>
            <Text style={styles.metricText}>
              {completedStrength} / {strengthGoal} sesiones
            </Text>
            <Text style={styles.supportText}>Estado: {strengthStatus}</Text>
            <Text style={styles.supportText}>
              {completedStrength >= strengthGoal
                ? 'Objetivo completado'
                : `Quedan ${strengthGoal - completedStrength} sesiones`}
            </Text>
          </View>
        </View>
        <View style={styles.nextSessionBlock}>
          <Text style={styles.sectionLabel}>Próxima sesión</Text>
          {nextStrengthSession ? (
            <>
              <Text style={styles.listRowTitle}>{nextStrengthSession.name}</Text>
              <Text style={styles.supportText}>
                Grupos musculares:{' '}
                {nextStrengthGroups.map((group) => group.name).join(', ')}
              </Text>
              <MuscleGroupLinks
                getAccessibilityLabel={(group) =>
                  `Abrir grupo ${group.name} de la próxima sesión`
                }
                groups={nextStrengthGroups}
                keyPrefix={`next-${nextStrengthSession.id}`}
                onOpenGroup={openMuscleGroup}
              />
            </>
          ) : (
            <Text style={styles.supportText}>Todas las sesiones están completadas.</Text>
          )}
        </View>
        <View style={styles.sessionList}>
          {strengthSessions.map((session) => (
            <StrengthSessionRow
              key={session.id}
              muscleGroups={getSessionGroups(session, DEFAULT_MUSCLE_GROUPS)}
              onOpenGroup={openMuscleGroup}
              onToggle={handleToggleStrengthSession}
              session={session}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>HIIT semanal</SectionLabel>
        <View style={styles.dashboardProgressRow}>
          <CircularProgress
            current={hiitCompleted}
            goal={hiitGoal}
            label="HIIT semanal"
            size={132}
            testID="home-hiit-progress"
          />
          <View style={styles.dashboardProgressCopy}>
            <Text style={styles.metricText}>
              {hiitCompleted} / {hiitGoal} sesiones
            </Text>
            <Text style={styles.supportText}>Estado: {hiitStatus}</Text>
            <Text style={styles.supportText}>
              {hiitRemaining > 0
                ? `Quedan ${hiitRemaining} sesiones`
                : 'Objetivo completado'}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marcar sesión HIIT como completada"
          disabled={hiitCompleted >= hiitGoal}
          onPress={() => void handleMarkHiitSession()}
          style={({ pressed }) => [
            styles.primaryButton,
            hiitCompleted >= hiitGoal && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Marcar sesión HIIT</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revertir última marca de HIIT"
          disabled={hiitCompleted <= 0}
          onPress={() => void handleUndoHiitSession()}
          style={({ pressed }) => [
            styles.secondaryButton,
            hiitCompleted <= 0 && styles.disabledSecondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Revertir última marca</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

function getMediaTypeLabel(type: MediaItem['type']): string {
  return type === 'image' ? 'imagen' : 'vídeo';
}

function MissingMediaState() {
  return (
    <View style={styles.missingMediaState}>
      <Text style={styles.missingMediaTitle}>Archivo no disponible</Text>
      <Text style={styles.missingMediaText}>
        Elimina esta referencia y vuelve a seleccionar el archivo.
      </Text>
    </View>
  );
}

function ImageMediaViewer({ media }: { media: MediaItem }) {
  const [isUnavailable, setIsUnavailable] = useState(false);

  if (isUnavailable) {
    return <MissingMediaState />;
  }

  return (
    <Image
      accessibilityLabel="Imagen multimedia abierta"
      onError={() => setIsUnavailable(true)}
      resizeMode="contain"
      source={{ uri: media.uri }}
      style={styles.mediaViewerImage}
    />
  );
}

function VideoMediaViewer({ media }: { media: MediaItem }) {
  const player = useVideoPlayer(media.uri);
  const [isUnavailable, setIsUnavailable] = useState(() => player.status === 'error');

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        setIsUnavailable(true);
      }
    });

    return () => subscription.remove();
  }, [player]);

  if (isUnavailable) {
    return <MissingMediaState />;
  }

  return (
    <VideoView
      contentFit="contain"
      nativeControls
      player={player}
      style={styles.mediaViewerVideo}
    />
  );
}

function ExerciseMediaViewer({
  media,
  onClose,
}: {
  media: MediaItem;
  onClose: () => void;
}) {
  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible
    >
      <View style={styles.mediaViewerBackdrop}>
        <View style={styles.mediaViewerCard}>
          {media.type === 'image' ? (
            <ImageMediaViewer media={media} />
          ) : (
            <VideoMediaViewer media={media} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar visor multimedia"
            onPress={onClose}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseMediaPreview({
  index,
  media,
  onOpen,
  onRemove,
}: {
  index: number;
  media: MediaItem;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [isImageUnavailable, setIsImageUnavailable] = useState(false);
  const mediaLabel = getMediaTypeLabel(media.type);
  const position = index + 1;

  return (
    <View style={styles.mediaPreviewCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          media.type === 'image'
            ? `Abrir imagen ${position}`
            : `Reproducir vídeo ${position}`
        }
        onPress={onOpen}
        style={({ pressed }) => [styles.mediaPreviewButton, pressed && styles.pressed]}
      >
        {media.type === 'image' && !isImageUnavailable ? (
          <Image
            accessibilityLabel={`Miniatura de imagen ${position}`}
            onError={() => setIsImageUnavailable(true)}
            source={{ uri: media.uri }}
            style={styles.mediaThumbnail}
            testID={`exercise-media-image-${position}`}
          />
        ) : media.type === 'image' ? (
          <MissingMediaState />
        ) : (
          <View style={styles.videoThumbnail}>
            <Text style={styles.videoThumbnailIcon}>▶</Text>
            <Text style={styles.videoThumbnailText}>Vídeo</Text>
          </View>
        )}
      </Pressable>
      <Text style={styles.mediaTypeText}>
        {mediaLabel[0].toUpperCase() + mediaLabel.slice(1)} {position}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${mediaLabel} ${position}`}
        onPress={onRemove}
        style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
      >
        <Text style={styles.smallDangerButtonText}>Eliminar</Text>
      </Pressable>
    </View>
  );
}

type ExerciseCoverSource =
  | Pick<ExerciseCover, 'uri'>
  | ExerciseMediaSelection
  | null
  | undefined;

function ExerciseCoverPreview({
  accessibilityLabel,
  cover,
  muscleGroupId,
  testID,
}: {
  accessibilityLabel?: string;
  cover: ExerciseCoverSource;
  muscleGroupId: string;
  testID: string;
}) {
  const [isUnavailable, setIsUnavailable] = useState(false);

  if (cover?.uri && !isUnavailable) {
    return (
      <Image
        accessibilityLabel={accessibilityLabel}
        onError={() => setIsUnavailable(true)}
        resizeMode="cover"
        source={{ uri: cover.uri }}
        style={styles.exerciseCoverImage}
        testID={testID}
      />
    );
  }

  return (
    <View style={styles.exerciseCoverPlaceholder} testID={testID}>
      <Text style={styles.exerciseCoverIcon}>{getMuscleGroupIcon(muscleGroupId)}</Text>
      <Text style={styles.exerciseCoverText}>
        {cover ? 'Portada no disponible' : 'Sin portada'}
      </Text>
    </View>
  );
}

const MUSCLE_GROUP_ICONS: Record<string, string> = {
  pecho: '◉',
  espalda: '▰',
  hombro: '◆',
  biceps: '✦',
  triceps: '✧',
  antebrazos: '◌',
  abdomen: '▦',
  gluteos: '●',
  piernas: '▰',
};

function getMuscleGroupIcon(groupId: string): string {
  return MUSCLE_GROUP_ICONS[groupId] ?? '•';
}

function formatExerciseCount(count: number): string {
  return `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'}`;
}

export function ExercisesScreen() {
  const {
    state,
    addExerciseMedia,
    createExercise,
    deleteExercise,
    errorMessage,
    pickExerciseCover,
    removeExerciseCover,
    removeExerciseMedia,
    setExerciseCover,
    updateExercise,
  } = useAppState();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const route = useRoute<RouteProp<RootTabParamList, 'Exercises'>>();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    route.params?.groupId ?? null,
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [isExerciseFormVisible, setIsExerciseFormVisible] = useState(false);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [exerciseCoverSelection, setExerciseCoverSelection] =
    useState<ExerciseMediaSelection | null>(null);
  const [exerciseValidationError, setExerciseValidationError] = useState<string | null>(null);
  const [exerciseSuccessMessage, setExerciseSuccessMessage] = useState<string | null>(null);
  const [isExerciseEditVisible, setIsExerciseEditVisible] = useState(false);
  const [exerciseEditName, setExerciseEditName] = useState('');
  const [exerciseEditDescription, setExerciseEditDescription] = useState('');
  const [exerciseEditGroupId, setExerciseEditGroupId] = useState<string | null>(null);
  const [exerciseEditCoverSelection, setExerciseEditCoverSelection] = useState<
    ExerciseMediaSelection | null | undefined
  >(undefined);
  const [exerciseEditError, setExerciseEditError] = useState<string | null>(null);
  const [exerciseActionError, setExerciseActionError] = useState<string | null>(null);
  const [coverActionError, setCoverActionError] = useState<string | null>(null);
  const [coverSuccessMessage, setCoverSuccessMessage] = useState<string | null>(null);
  const [mediaActionError, setMediaActionError] = useState<string | null>(null);
  const [mediaSuccessMessage, setMediaSuccessMessage] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [isExerciseDeleteConfirmationVisible, setIsExerciseDeleteConfirmationVisible] = useState(false);

  useEffect(() => {
    // A strength session can open this tab with a preselected muscle group.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroupId(route.params?.groupId ?? null);
    setSelectedExerciseId(null);
    setIsExerciseFormVisible(false);
  }, [route.params?.groupId]);

  if (!state) {
    return null;
  }

  const selectedGroup = DEFAULT_MUSCLE_GROUPS.find(
    (group) => group.id === selectedGroupId,
  );
  const selectedExercise = state.exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );
  const selectedExerciseGroup = selectedExercise
    ? DEFAULT_MUSCLE_GROUPS.find((group) => group.id === selectedExercise.muscleGroupId)
    : null;
  const selectedMedia = selectedExercise?.media.find(
    (mediaItem) => mediaItem.id === selectedMediaId,
  );
  const exerciseCounts = state.exercises.reduce<Record<string, number>>(
    (counts, exercise) => {
      counts[exercise.muscleGroupId] = (counts[exercise.muscleGroupId] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const orderedExercises = sortExercises(state.exercises, DEFAULT_MUSCLE_GROUPS);
  const visibleExercises = selectedGroupId
    ? orderedExercises.filter((exercise) => exercise.muscleGroupId === selectedGroupId)
    : [];

  function resetExerciseForm() {
    setExerciseName('');
    setExerciseDescription('');
    setExerciseCoverSelection(null);
    setExerciseValidationError(null);
    setCoverActionError(null);
    setIsExerciseFormVisible(false);
  }

  function openGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedExerciseId(null);
    setSelectedMediaId(null);
    setIsExerciseFormVisible(false);
    setCoverActionError(null);
    setCoverSuccessMessage(null);
    setExerciseSuccessMessage(null);
  }

  function goToGroupGrid() {
    navigation.setParams({ groupId: undefined });
    setSelectedGroupId(null);
    setSelectedExerciseId(null);
    setSelectedMediaId(null);
    setIsExerciseFormVisible(false);
    setCoverActionError(null);
    setCoverSuccessMessage(null);
    setExerciseSuccessMessage(null);
  }

  function openExerciseForm() {
    setExerciseName('');
    setExerciseDescription('');
    setExerciseCoverSelection(null);
    setExerciseValidationError(null);
    setCoverActionError(null);
    setCoverSuccessMessage(null);
    setExerciseSuccessMessage(null);
    setIsExerciseFormVisible(true);
  }

  async function requestCoverSelection(): Promise<ExerciseMediaSelection | null> {
    setCoverActionError(null);
    setCoverSuccessMessage(null);

    try {
      const selection = await pickExerciseCover();
      if (!selection) {
        setCoverActionError('No se seleccionó ninguna imagen de portada.');
        return null;
      }

      return selection;
    } catch (error) {
      setCoverActionError(
        error instanceof Error ? error.message : 'No se pudo seleccionar la portada.',
      );
      return null;
    }
  }

  async function handleSelectCreateCover() {
    const selection = await requestCoverSelection();
    if (selection) {
      setExerciseCoverSelection(selection);
    }
  }

  async function handleSelectEditCover() {
    const selection = await requestCoverSelection();
    if (selection) {
      setExerciseEditCoverSelection(selection);
    }
  }

  async function handleSelectDetailCover() {
    if (!selectedExercise) {
      return;
    }

    const selection = await requestCoverSelection();
    if (!selection) {
      return;
    }

    try {
      await setExerciseCover(selectedExercise.id, selection);
      setCoverSuccessMessage('Portada guardada');
    } catch (error) {
      setCoverActionError(
        error instanceof Error ? error.message : 'No se pudo guardar la portada.',
      );
    }
  }

  async function handleRemoveDetailCover() {
    if (!selectedExercise) {
      return;
    }

    setCoverActionError(null);
    setCoverSuccessMessage(null);

    try {
      await removeExerciseCover(selectedExercise.id);
      setCoverSuccessMessage('Portada eliminada');
    } catch (error) {
      setCoverActionError(
        error instanceof Error ? error.message : 'No se pudo eliminar la portada.',
      );
    }
  }

  async function handleCreateExercise() {
    setExerciseValidationError(null);
    setExerciseSuccessMessage(null);

    if (!exerciseName.trim()) {
      setExerciseValidationError('Escribe un nombre para el ejercicio.');
      return;
    }

    if (!selectedGroup) {
      setExerciseValidationError('Selecciona un grupo muscular.');
      return;
    }

    try {
      await createExercise(
        {
          name: exerciseName,
          muscleGroupId: selectedGroup.id,
          description: exerciseDescription,
        },
        exerciseCoverSelection ?? undefined,
      );
      resetExerciseForm();
      setExerciseSuccessMessage('Ejercicio guardado');
    } catch (error) {
      setExerciseValidationError(
        error instanceof Error ? error.message : 'No se pudo guardar el ejercicio.',
      );
    }
  }

  function startExerciseEdit() {
    if (!selectedExercise) {
      return;
    }

    setExerciseEditName(selectedExercise.name);
    setExerciseEditDescription(selectedExercise.description);
    setExerciseEditGroupId(selectedExercise.muscleGroupId);
    setExerciseEditCoverSelection(undefined);
    setExerciseEditError(null);
    setExerciseActionError(null);
    setCoverActionError(null);
    setCoverSuccessMessage(null);
    setIsExerciseDeleteConfirmationVisible(false);
    setIsExerciseEditVisible(true);
  }

  async function handleUpdateExercise() {
    if (!selectedExercise) {
      return;
    }

    setExerciseEditError(null);
    setExerciseActionError(null);
    setExerciseSuccessMessage(null);

    if (!exerciseEditName.trim()) {
      setExerciseEditError('Escribe un nombre para el ejercicio.');
      return;
    }

    if (!exerciseEditGroupId) {
      setExerciseEditError('Selecciona un grupo muscular.');
      return;
    }

    try {
      await updateExercise(
        selectedExercise.id,
        {
          name: exerciseEditName,
          muscleGroupId: exerciseEditGroupId,
          description: exerciseEditDescription,
        },
        exerciseEditCoverSelection,
      );
      setSelectedGroupId(exerciseEditGroupId);
      setExerciseEditCoverSelection(undefined);
      setIsExerciseEditVisible(false);
      setExerciseSuccessMessage('Ejercicio actualizado');
    } catch (error) {
      setExerciseEditError(
        error instanceof Error ? error.message : 'No se pudo actualizar el ejercicio.',
      );
    }
  }

  async function handleAddExerciseMedia() {
    if (!selectedExercise) {
      return;
    }

    setMediaActionError(null);
    setMediaSuccessMessage(null);

    try {
      const mediaWasAdded = await addExerciseMedia(selectedExercise.id);
      setMediaSuccessMessage(
        mediaWasAdded
          ? 'Multimedia guardada'
          : 'No se seleccionó ninguna imagen ni vídeo.',
      );
    } catch (error) {
      setMediaActionError(
        error instanceof Error ? error.message : 'No se pudo guardar la multimedia.',
      );
    }
  }

  async function handleRemoveExerciseMedia(mediaId: string) {
    if (!selectedExercise) {
      return;
    }

    setMediaActionError(null);
    setMediaSuccessMessage(null);

    try {
      await removeExerciseMedia(selectedExercise.id, mediaId);
      setSelectedMediaId(null);
      setMediaSuccessMessage('Multimedia eliminada');
    } catch (error) {
      setMediaActionError(
        error instanceof Error ? error.message : 'No se pudo eliminar la multimedia.',
      );
    }
  }

  function requestExerciseDeletion() {
    setExerciseActionError(null);
    setIsExerciseEditVisible(false);
    setIsExerciseDeleteConfirmationVisible(true);
  }

  async function confirmExerciseDeletion() {
    if (!selectedExercise) {
      return;
    }

    setExerciseActionError(null);

    try {
      await deleteExercise(selectedExercise.id);
      setSelectedExerciseId(null);
      setSelectedMediaId(null);
      setIsExerciseDeleteConfirmationVisible(false);
      setExerciseSuccessMessage('Ejercicio eliminado');
    } catch (error) {
      setExerciseActionError(
        error instanceof Error ? error.message : 'No se pudo eliminar el ejercicio.',
      );
    }
  }

  if (selectedExercise) {
    return (
      <Screen title="Ejercicios">
        <Card>
          <Text style={styles.libraryTitle}>Detalle del ejercicio</Text>
          {isExerciseEditVisible ? (
            <View style={styles.formBlock}>
              <TextInput
                accessibilityLabel="Nombre del ejercicio a editar"
                autoCapitalize="words"
                onChangeText={setExerciseEditName}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                testID="exercise-edit-name-input"
                value={exerciseEditName}
              />
              <TextInput
                accessibilityLabel="Descripción del ejercicio a editar"
                multiline
                onChangeText={setExerciseEditDescription}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.multilineInput]}
                testID="exercise-edit-description-input"
                value={exerciseEditDescription}
              />
              <SectionLabel>Portada</SectionLabel>
              <ExerciseCoverPreview
                accessibilityLabel={`Portada de ${selectedExercise.name}`}
                cover={
                  exerciseEditCoverSelection === undefined
                    ? selectedExercise.cover
                    : exerciseEditCoverSelection
                }
                key={
                  exerciseEditCoverSelection === undefined
                    ? selectedExercise.cover?.uri ?? 'no-cover'
                    : exerciseEditCoverSelection?.uri ?? 'no-cover'
                }
                muscleGroupId={selectedExercise.muscleGroupId}
                testID="exercise-edit-cover-preview"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  (exerciseEditCoverSelection === undefined
                    ? selectedExercise.cover
                    : exerciseEditCoverSelection)
                    ? 'Cambiar portada'
                    : 'Seleccionar portada'
                }
                onPress={() => void handleSelectEditCover()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>
                  {(exerciseEditCoverSelection === undefined
                    ? selectedExercise.cover
                    : exerciseEditCoverSelection)
                    ? 'Cambiar portada'
                    : 'Seleccionar portada'}
                </Text>
              </Pressable>
              {(exerciseEditCoverSelection === undefined
                ? selectedExercise.cover
                : exerciseEditCoverSelection) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar portada"
                  onPress={() => {
                    setExerciseEditCoverSelection(null);
                    setCoverActionError(null);
                    setCoverSuccessMessage(null);
                  }}
                  style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
                >
                  <Text style={styles.smallDangerButtonText}>Quitar portada</Text>
                </Pressable>
              ) : null}
              {coverActionError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {coverActionError}
                </Text>
              ) : null}
              <Text style={styles.supportText}>Selecciona un grupo muscular</Text>
              <View style={styles.groupList}>
                {DEFAULT_MUSCLE_GROUPS.map((group) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar grupo para editar ${group.name}`}
                    accessibilityState={{ selected: group.id === exerciseEditGroupId }}
                    key={`exercise-edit-${group.id}`}
                    onPress={() => setExerciseEditGroupId(group.id)}
                    style={[
                      styles.groupChip,
                      group.id === exerciseEditGroupId && styles.groupChipSelected,
                    ]}
                  >
                    <Text style={styles.groupChipText}>{group.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar cambios del ejercicio"
                onPress={() => void handleUpdateExercise()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Guardar cambios</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar edición del ejercicio"
                onPress={() => {
                  setIsExerciseEditVisible(false);
                  setExerciseEditError(null);
                }}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
              {exerciseEditError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {exerciseEditError}
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <SectionLabel>Nombre</SectionLabel>
              <Text style={styles.metricText}>{selectedExercise.name}</Text>
              <SectionLabel>Grupo muscular</SectionLabel>
              <Text style={styles.supportText}>
                {selectedExerciseGroup?.name ?? 'Grupo no disponible'}
              </Text>
              {selectedExercise.description ? (
                <>
                  <SectionLabel>Descripción</SectionLabel>
                  <Text style={styles.supportText}>{selectedExercise.description}</Text>
                </>
              ) : null}
              <SectionLabel>Portada</SectionLabel>
              <ExerciseCoverPreview
                accessibilityLabel={`Portada de ${selectedExercise.name}`}
                cover={selectedExercise.cover}
                key={selectedExercise.cover?.uri ?? 'no-cover'}
                muscleGroupId={selectedExercise.muscleGroupId}
                testID={`exercise-cover-detail-${selectedExercise.id}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedExercise.cover ? 'Cambiar portada' : 'Seleccionar portada'}
                onPress={() => void handleSelectDetailCover()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>
                  {selectedExercise.cover ? 'Cambiar portada' : 'Seleccionar portada'}
                </Text>
              </Pressable>
              {selectedExercise.cover ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar portada"
                  onPress={() => void handleRemoveDetailCover()}
                  style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
                >
                  <Text style={styles.smallDangerButtonText}>Quitar portada</Text>
                </Pressable>
              ) : null}
              {coverActionError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {coverActionError}
                </Text>
              ) : null}
              {coverSuccessMessage ? (
                <Text style={styles.successText}>{coverSuccessMessage}</Text>
              ) : null}
              <SectionLabel>Multimedia</SectionLabel>
              <Text style={styles.supportText}>
                {selectedExercise.media.length === 0
                  ? 'Sin imágenes ni vídeos asociados.'
                  : `${selectedExercise.media.length} elementos multimedia`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Añadir imágenes y vídeos"
                onPress={() => void handleAddExerciseMedia()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Añadir imágenes y vídeos</Text>
              </Pressable>
              {mediaActionError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {mediaActionError}
                </Text>
              ) : null}
              {mediaSuccessMessage ? (
                <Text style={styles.successText}>{mediaSuccessMessage}</Text>
              ) : null}
              {selectedExercise.media.length > 0 ? (
                <View style={styles.mediaPreviewList}>
                  {selectedExercise.media.map((mediaItem, index) => (
                    <ExerciseMediaPreview
                      index={index}
                      key={mediaItem.id}
                      media={mediaItem}
                      onOpen={() => setSelectedMediaId(mediaItem.id)}
                      onRemove={() => void handleRemoveExerciseMedia(mediaItem.id)}
                    />
                  ))}
                </View>
              ) : null}
              {selectedMedia ? (
                <ExerciseMediaViewer
                  key={selectedMedia.id}
                  media={selectedMedia}
                  onClose={() => setSelectedMediaId(null)}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar ejercicio"
                onPress={startExerciseEdit}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Editar ejercicio</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Eliminar ejercicio"
                onPress={requestExerciseDeletion}
                style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
              >
                <Text style={styles.dangerButtonText}>Eliminar ejercicio</Text>
              </Pressable>
              {isExerciseDeleteConfirmationVisible ? (
                <View style={styles.confirmationBlock}>
                  <Text style={styles.confirmationTitle}>¿Eliminar este ejercicio?</Text>
                  <Text style={styles.supportText}>
                    Esta acción no se puede deshacer.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar eliminación"
                    onPress={() => setIsExerciseDeleteConfirmationVisible(false)}
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirmar eliminación"
                    onPress={() => void confirmExerciseDeletion()}
                    style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.dangerButtonText}>Confirmar eliminación</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
          {exerciseActionError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {exerciseActionError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a ejercicios"
            onPress={() => {
              setSelectedExerciseId(null);
              setSelectedMediaId(null);
              setIsExerciseEditVisible(false);
              setIsExerciseDeleteConfirmationVisible(false);
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Volver a ejercicios</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  if (selectedGroup) {
    return (
      <Screen title="Ejercicios">
        <Text style={styles.introText}>
          Explora y completa tu biblioteca de ejercicios por grupo muscular.
        </Text>
        <Card testID="exercise-group-list">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a grupos musculares"
            onPress={goToGroupGrid}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>‹ Grupos musculares</Text>
          </Pressable>
          <View style={styles.groupHeader}>
            <View style={styles.groupHeaderIcon}>
              <Text style={styles.groupIcon}>{getMuscleGroupIcon(selectedGroup.id)}</Text>
            </View>
            <View style={styles.groupHeaderCopy}>
              <Text style={styles.libraryTitle}>{selectedGroup.name}</Text>
              <Text style={styles.supportText}>
                {formatExerciseCount(exerciseCounts[selectedGroup.id] ?? 0)}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir ejercicio"
            onPress={openExerciseForm}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Añadir ejercicio</Text>
          </Pressable>
          {isExerciseFormVisible ? (
            <View style={styles.formBlock} testID="exercise-create-form">
              <SectionLabel>Nuevo ejercicio</SectionLabel>
              <Text style={styles.supportText}>Grupo muscular</Text>
              <View style={styles.selectedGroupField} testID="exercise-selected-group">
                <Text style={styles.selectedGroupName}>
                  {getMuscleGroupIcon(selectedGroup.id)} {selectedGroup.name}
                </Text>
                <Text style={styles.mutedText}>
                  Este grupo queda preseleccionado y no se puede cambiar en este flujo.
                </Text>
              </View>
              <TextInput
                accessibilityLabel="Nombre del ejercicio"
                autoCapitalize="words"
                onChangeText={setExerciseName}
                placeholder="Ej.: Press banca"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                testID="exercise-name-input"
                value={exerciseName}
              />
              <TextInput
                accessibilityLabel="Descripción del ejercicio"
                multiline
                onChangeText={setExerciseDescription}
                placeholder="Descripción opcional"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.multilineInput]}
                testID="exercise-description-input"
                value={exerciseDescription}
              />
              <SectionLabel>Portada</SectionLabel>
              <ExerciseCoverPreview
                accessibilityLabel={exerciseCoverSelection ? 'Portada seleccionada' : undefined}
                cover={exerciseCoverSelection}
                muscleGroupId={selectedGroup.id}
                testID="exercise-cover-create-preview"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={exerciseCoverSelection ? 'Cambiar portada' : 'Seleccionar portada'}
                onPress={() => void handleSelectCreateCover()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>
                  {exerciseCoverSelection ? 'Cambiar portada' : 'Seleccionar portada'}
                </Text>
              </Pressable>
              {exerciseCoverSelection ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar portada"
                  onPress={() => {
                    setExerciseCoverSelection(null);
                    setCoverActionError(null);
                  }}
                  style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
                >
                  <Text style={styles.smallDangerButtonText}>Quitar portada</Text>
                </Pressable>
              ) : null}
              {coverActionError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {coverActionError}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar ejercicio"
                onPress={() => void handleCreateExercise()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Guardar ejercicio</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar creación de ejercicio"
                onPress={resetExerciseForm}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}
          {exerciseValidationError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {exerciseValidationError}
            </Text>
          ) : null}
          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
          {exerciseSuccessMessage ? (
            <Text style={styles.successText}>{exerciseSuccessMessage}</Text>
          ) : null}
          {visibleExercises.length === 0 ? (
            <Text style={styles.emptyText}>
              Todavía no hay ejercicios en este grupo.
            </Text>
          ) : (
            <View style={styles.exerciseList}>
              {visibleExercises.map((exercise: Exercise) => {
                const group = DEFAULT_MUSCLE_GROUPS.find(
                  (muscleGroup) => muscleGroup.id === exercise.muscleGroupId,
                );

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir detalle de ${exercise.name}`}
                    key={exercise.id}
                    onPress={() => {
                      setSelectedExerciseId(exercise.id);
                      setIsExerciseEditVisible(false);
                      setIsExerciseDeleteConfirmationVisible(false);
                      setExerciseEditError(null);
                      setExerciseActionError(null);
                    }}
                    style={({ pressed }) => [styles.exerciseCard, pressed && styles.pressed]}
                  >
                    <ExerciseCoverPreview
                      accessibilityLabel={`Portada de ${exercise.name}`}
                      cover={exercise.cover}
                      key={exercise.cover?.uri ?? 'no-cover'}
                      muscleGroupId={exercise.muscleGroupId}
                      testID={`exercise-cover-${exercise.id}`}
                    />
                    <View style={styles.exerciseCardCopy}>
                      <Text style={styles.listRowTitle}>{exercise.name}</Text>
                      <Text style={styles.mutedText}>
                        {group?.name ?? 'Grupo no disponible'}
                      </Text>
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={3}
                        style={styles.exerciseDescription}
                      >
                        {exercise.description || 'Sin descripción añadida.'}
                      </Text>
                    </View>
                    <Text style={styles.mutedText}>Ver detalle</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Ejercicios">
      <Text style={styles.introText}>
        Tu biblioteca local estará disponible aunque no tengas conexión.
      </Text>
      <Card testID="exercise-library-card">
        <Text style={styles.libraryTitle}>Biblioteca de ejercicios</Text>
        <Text style={styles.supportText}>
          Elige un grupo muscular para consultar sus ejercicios.
        </Text>
        <View style={styles.muscleGroupGrid} testID="muscle-group-grid">
          {DEFAULT_MUSCLE_GROUPS.map((group) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir grupo ${group.name}`}
              key={group.id}
              onPress={() => openGroup(group.id)}
              style={({ pressed }) => [styles.muscleGroupCard, pressed && styles.pressed]}
              testID={`muscle-group-card-${group.id}`}
            >
              <Text style={styles.groupIcon}>{getMuscleGroupIcon(group.id)}</Text>
              <Text style={styles.muscleGroupCardName}>{group.name}</Text>
              <Text style={styles.muscleGroupCardCount}>
                {formatExerciseCount(exerciseCounts[group.id] ?? 0)}
              </Text>
            </Pressable>
          ))}
        </View>
        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}

function hasWeeklyActivity(week: WeeklyRecord): boolean {
  return (
    week.hiitCompleted > 0 ||
    week.strengthSessions.some((session) => session.completed)
  );
}

function WeeklyHistoryCard({
  week,
  currentWeekStart,
  muscleGroups,
}: {
  week: WeeklyRecord;
  currentWeekStart: string;
  muscleGroups: readonly MuscleGroup[];
}) {
  const isCurrentWeek = week.weekStart === currentWeekStart;
  const completedStrength = week.strengthSessions.filter(
    (session) => session.completed,
  ).length;
  const strengthStatus = getStrengthProgressStatus(
    completedStrength,
    week.strengthGoal,
  );
  const hiitStatus = getStrengthProgressStatus(week.hiitCompleted, week.hiitGoal);

  return (
    <View style={styles.historyCard} testID={`history-week-${week.weekStart}`}>
      <Text
        accessibilityRole="header"
        style={styles.historyDate}
        testID={`history-week-header-${week.weekStart}`}
      >
        {isCurrentWeek
          ? `Semana actual · lunes ${formatHistoryDate(week.weekStart)}`
          : `Semana del lunes ${formatHistoryDate(week.weekStart)}`}
      </Text>
      <Text style={styles.weekStatusText}>
        {isCurrentWeek ? 'Semana actual (en curso)' : 'Semana finalizada'}
      </Text>

      <View style={styles.weeklyProgressBlock}>
        <SectionLabel>Fuerza semanal</SectionLabel>
        <Text style={styles.metricText}>
          {completedStrength} / {week.strengthGoal} sesiones
        </Text>
        <Text style={styles.supportText}>Estado: {strengthStatus}</Text>
      </View>

      <View style={styles.weeklySessionList}>
        <SectionLabel>Plan de fuerza aplicado</SectionLabel>
        {week.strengthSessions.map((session) => {
          const groups = getSessionGroups(session, muscleGroups);
          return (
            <View key={`${week.weekStart}-${session.id}`} style={styles.weeklySessionRow}>
              <Text style={styles.listRowTitle}>{session.name}</Text>
              <Text style={styles.supportText}>
                Grupos musculares:{' '}
                {groups.length > 0
                  ? groups.map((group) => group.name).join(', ')
                  : 'Sin grupos disponibles'}
              </Text>
              <Text style={styles.mutedText}>
                {session.completed ? 'Completada' : 'Pendiente'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.weeklyProgressBlock}>
        <SectionLabel>HIIT semanal</SectionLabel>
        <Text style={styles.metricText}>
          {week.hiitCompleted} / {week.hiitGoal} sesiones
        </Text>
        <Text style={styles.supportText}>Estado: {hiitStatus}</Text>
      </View>
    </View>
  );
}

function formatStatisticsPercentage(percentage: number | null): string {
  return percentage === null ? 'Sin datos' : `${percentage}%`;
}

function WeeklyProgressSummary({
  metric,
  statistics,
  title,
}: {
  metric: 'strength' | 'hiit';
  statistics: WeeklyGoalStatistics;
  title: string;
}) {
  const completedWeeksLabel =
    statistics.evaluatedWeeks === 0
      ? 'Sin datos'
      : `${statistics.completedWeeks} de ${statistics.evaluatedWeeks} (${formatStatisticsPercentage(
          statistics.percentage,
        )})`;
  const labels =
    metric === 'strength'
      ? {
          sessions: 'Sesiones de fuerza realizadas',
          weeks: 'Semanas de fuerza cumplidas',
        }
      : {
          sessions: 'Sesiones HIIT realizadas',
          weeks: 'Semanas de HIIT cumplidas',
        };

  return (
    <View style={styles.statisticsBlock}>
      <Text style={styles.libraryTitle}>{title}</Text>
      <Text style={styles.supportText}>
        {labels.sessions}: {formatNumber(statistics.completedSessions)}
      </Text>
      <Text style={styles.supportText}>
        {labels.weeks}: {completedWeeksLabel}
      </Text>
      {statistics.weeklyProgress.length === 0 ? (
        <Text style={styles.emptyText}>Sin semanas registradas.</Text>
      ) : (
        <View style={styles.statisticsList}>
          {statistics.weeklyProgress.map((week) => (
            <Text
              key={`${metric}-${week.weekStart}`}
              style={styles.emptyText}
            >
              Semana del lunes {formatHistoryDate(week.weekStart)}:{' '}
              {formatNumber(week.completedSessions)} sesiones de un objetivo de{' '}
              {formatNumber(week.goalSessions)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ProgressSummary({
  statistics,
}: {
  statistics: ReturnType<typeof getProgressStatistics>;
}) {
  const stepDaysLabel =
    statistics.steps.recordedDays === 0
      ? 'Sin datos'
      : formatNumber(statistics.steps.completedDays);
  const averageStepsLabel =
    statistics.steps.averageSteps === null
      ? 'Sin datos'
      : `${formatNumber(statistics.steps.averageSteps)} pasos`;
  const lastFastingLabel =
    statistics.fasting.lastDurationMinutes === null
      ? 'Sin ayunos finalizados'
      : formatFastingDuration(statistics.fasting.lastDurationMinutes);
  const averageFastingLabel =
    statistics.fasting.averageDurationMinutes === null
      ? 'Sin ayunos finalizados'
      : formatFastingDuration(statistics.fasting.averageDurationMinutes);
  const complianceUnitsLabel =
    statistics.compliance.evaluableUnits === 0
      ? 'Sin unidades evaluables'
      : `${formatNumber(statistics.compliance.completedUnits)} de ${formatNumber(
          statistics.compliance.evaluableUnits,
        )}`;

  return (
    <Card>
      <Text style={styles.libraryTitle}>Progreso</Text>
      <View style={styles.statisticsBlock}>
        <SectionLabel>Pasos</SectionLabel>
        <Text style={styles.supportText}>
          Días con objetivo cumplido: {stepDaysLabel}
        </Text>
        <Text style={styles.supportText}>
          Días con pasos registrados: {formatNumber(statistics.steps.recordedDays)}
        </Text>
        <Text style={styles.supportText}>Media de pasos: {averageStepsLabel}</Text>
      </View>

      <WeeklyProgressSummary
        metric="strength"
        statistics={statistics.strength}
        title="Entrenamientos de fuerza por semana"
      />
      <WeeklyProgressSummary
        metric="hiit"
        statistics={statistics.hiit}
        title="Sesiones HIIT por semana"
      />

      <View style={styles.statisticsBlock}>
        <SectionLabel>Ayunos</SectionLabel>
        <Text style={styles.supportText}>Último ayuno: {lastFastingLabel}</Text>
        <Text style={styles.supportText}>Media de ayunos: {averageFastingLabel}</Text>
        <Text style={styles.emptyText}>
          El ayuno no participa en el cumplimiento general porque no hay un objetivo
          de duración configurado.
        </Text>
      </View>

      <View style={styles.statisticsBlock}>
        <SectionLabel>Cumplimiento general</SectionLabel>
        <Text style={styles.metricText}>
          Cumplimiento general: {formatStatisticsPercentage(statistics.compliance.percentage)}
        </Text>
        <Text style={styles.supportText}>Unidades cumplidas: {complianceUnitsLabel}</Text>
      </View>
    </Card>
  );
}

export function HistoryScreen() {
  const { state, currentTime } = useAppState();

  if (!state) {
    return null;
  }

  const historyDays = getHistoryDays(state.dailyRecords);
  const historyWeeks = getHistoryWeeks(state.weeklyRecords);
  const completedFastings = getHistoryFastings(state.fasting.completed);
  const activeFasting = state.fasting.active;
  const currentWeekStart = getMondayDateKey(currentTime);
  const hasWeeklyHistory = historyWeeks.some(
    (week) => week.weekStart !== currentWeekStart || hasWeeklyActivity(week),
  );
  const hasHistory =
    historyDays.some((day) => day.steps !== null) ||
    activeFasting !== null ||
    completedFastings.length > 0 ||
    hasWeeklyHistory;
  const showWeeklyHistory = historyWeeks.length > 0 && hasHistory;
  const statistics = getProgressStatistics(
    hasHistory ? historyDays : [],
    hasHistory ? historyWeeks : [],
    hasHistory ? completedFastings : [],
  );

  if (!hasHistory) {
    return (
      <Screen title="Historial">
        <ProgressSummary statistics={statistics} />
        <Card>
          <Text style={styles.emptyTitle}>Aún no hay historial</Text>
          <Text style={styles.emptyText}>
            Cuando registres pasos, entrenamientos o ayunos, aparecerán aquí sin
            borrar los periodos anteriores.
          </Text>
        </Card>
      </Screen>
    );
  }

  const activeFastingDuration = activeFasting
    ? calculateFastingDurationMinutes(
        activeFasting.startedAt,
        currentTime.toISOString(),
      )
    : null;

  return (
    <Screen title="Historial">
      <ProgressSummary statistics={statistics} />
      {showWeeklyHistory ? (
        <Card>
          <Text style={styles.libraryTitle}>Historial de semanas</Text>
          <Text style={styles.emptyText}>
            Las semanas aparecen del lunes más reciente al más antiguo. La semana
            actual se marca como en curso y conserva el plan aplicado al empezar.
          </Text>
          <View style={styles.historyList}>
            {historyWeeks.map((week) => (
              <WeeklyHistoryCard
                currentWeekStart={currentWeekStart}
                key={week.weekStart}
                muscleGroups={DEFAULT_MUSCLE_GROUPS}
                week={week}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.libraryTitle}>Historial de días</Text>
        <Text style={styles.emptyText}>
          Los registros aparecen del más reciente al más antiguo. Un día sin pasos
          conserva su objetivo, pero no cuenta como cero.
        </Text>
        <View style={styles.historyList}>
          {historyDays.map((day) => (
            <View key={day.date} style={styles.historyCard}>
              <Text
                accessibilityRole="header"
                style={styles.historyDate}
                testID={`history-day-header-${day.date}`}
              >
                {formatHistoryDate(day.date)}
              </Text>
              {day.steps === null ? (
                <>
                  <Text style={styles.metricText}>Sin pasos registrados</Text>
                  <Text style={styles.supportText}>
                    Objetivo guardado: {formatNumber(day.stepGoal)} pasos
                  </Text>
                  <Text style={styles.mutedText}>Estado: Sin datos</Text>
                </>
              ) : (
                <>
                  <Text style={styles.metricText}>
                    {formatNumber(day.steps)} pasos
                  </Text>
                  <Text style={styles.supportText}>
                    Objetivo guardado: {formatNumber(day.stepGoal)} pasos
                  </Text>
                  <Text style={styles.supportText}>
                    {day.steps >= day.stepGoal
                      ? 'Objetivo alcanzado'
                      : 'Objetivo no alcanzado'}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>Ayunos</SectionLabel>
        {activeFasting && activeFastingDuration !== null ? (
          <View style={styles.historyCard}>
            <Text style={[styles.metricText, styles.activeMetricText]}>Ayuno activo</Text>
            <Text style={styles.supportText}>
              Inicio: {formatTimestamp(activeFasting.startedAt)}
            </Text>
            <Text style={styles.supportText}>
              Duración actual: {formatFastingDuration(activeFastingDuration)}
            </Text>
          </View>
        ) : null}

        <SectionLabel>Ayunos finalizados</SectionLabel>
        {completedFastings.length === 0 ? (
          <Text style={styles.emptyText}>Aún no hay ayunos finalizados</Text>
        ) : (
          <View style={styles.historyList}>
            {completedFastings.map((fasting) => (
              <View key={fasting.id} style={styles.historyCard}>
                <Text style={styles.listRowTitle}>Ayuno finalizado</Text>
                <Text style={styles.supportText}>
                  Inicio: {formatTimestamp(fasting.startedAt)}
                </Text>
                <Text style={styles.supportText}>
                  Fin: {formatTimestamp(fasting.endedAt)}
                </Text>
                <Text style={styles.supportText}>
                  Duración: {formatFastingDuration(fasting.durationMinutes)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

export function SettingsScreen() {
  const {
    state,
    currentDay,
    errorMessage,
    updateDailyStepGoal,
    updateHiitWeeklyGoal,
    updateStrengthConfiguration,
    updateWaterSettings,
    waterPermissionStatus,
    waterScheduleStatus,
  } = useAppState();
  const currentGoal = currentDay?.stepGoal ?? state?.settings.dailyStepGoal ?? 0;
  const configuredHiitGoal = state?.settings.hiitWeeklyGoal ?? 0;
  const configuredWaterSettings = state?.settings.water ?? DEFAULT_WATER_SETTINGS;
  const strengthSessions = useMemo(
    () => state?.settings.strengthSessions ?? [],
    [state?.settings.strengthSessions],
  );
  const [goal, setGoal] = useState(String(currentGoal));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hiitGoal, setHiitGoal] = useState(String(configuredHiitGoal));
  const [hiitValidationError, setHiitValidationError] = useState<string | null>(null);
  const [hiitSuccessMessage, setHiitSuccessMessage] = useState<string | null>(null);
  const [strengthSessionCount, setStrengthSessionCount] = useState(
    String(strengthSessions.length),
  );
  const [strengthDraft, setStrengthDraft] = useState<StrengthSessionInput[]>(
    strengthSessions.map(toStrengthSessionInput),
  );
  const [strengthValidationError, setStrengthValidationError] = useState<string | null>(null);
  const [strengthSuccessMessage, setStrengthSuccessMessage] = useState<string | null>(null);
  const [waterStartTime, setWaterStartTime] = useState(configuredWaterSettings.startTime);
  const [waterEndTime, setWaterEndTime] = useState(configuredWaterSettings.endTime);
  const [waterInterval, setWaterInterval] = useState(
    String(configuredWaterSettings.intervalHours),
  );
  const [waterValidationError, setWaterValidationError] = useState<string | null>(null);
  const [waterSuccessMessage, setWaterSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Refresh the form when a new local day becomes current.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoal(String(currentGoal));
    setValidationError(null);
  }, [currentGoal]);

  useEffect(() => {
    // Refresh the HIIT form when the persisted configuration changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiitGoal(String(configuredHiitGoal));
    setHiitValidationError(null);
  }, [configuredHiitGoal]);

  useEffect(() => {
    // Keep the plan editor aligned with a persisted configuration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStrengthSessionCount(String(strengthSessions.length));
    setStrengthDraft(strengthSessions.map(toStrengthSessionInput));
    setStrengthValidationError(null);
  }, [strengthSessions]);

  useEffect(() => {
    // Keep the notification editor aligned with the persisted configuration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaterStartTime(configuredWaterSettings.startTime);
    setWaterEndTime(configuredWaterSettings.endTime);
    setWaterInterval(String(configuredWaterSettings.intervalHours));
  }, [
    configuredWaterSettings.endTime,
    configuredWaterSettings.intervalHours,
    configuredWaterSettings.startTime,
  ]);

  if (!state) {
    return null;
  }

  const waterRemindersActive =
    state.settings.water.enabled &&
    waterPermissionStatus === 'granted' &&
    waterScheduleStatus === 'scheduled';

  function handleStrengthSessionCountChange(value: string) {
    setStrengthSessionCount(value);
    setStrengthValidationError(null);

    const parsedCount = parseNonNegativeInteger(value);
    if (parsedCount === null || parsedCount < 1 || parsedCount > 7) {
      return;
    }

    setStrengthDraft((currentDraft) =>
      Array.from({ length: parsedCount }, (_, index) => {
        const draftSession = currentDraft[index];
        const configuredSession = strengthSessions[index];

        return (
          draftSession ??
          (configuredSession
            ? toStrengthSessionInput(configuredSession)
            : {
                name: `Sesión ${index + 1}`,
                muscleGroupIds: [],
              })
        );
      }),
    );
  }

  function toggleStrengthGroup(sessionIndex: number, groupId: string) {
    setStrengthDraft((currentDraft) =>
      currentDraft.map((session, index) => {
        if (index !== sessionIndex) {
          return session;
        }

        const hasGroup = session.muscleGroupIds.includes(groupId);
        return {
          ...session,
          muscleGroupIds: hasGroup
            ? session.muscleGroupIds.filter((id) => id !== groupId)
            : [...session.muscleGroupIds, groupId],
        };
      }),
    );
    setStrengthValidationError(null);
    setStrengthSuccessMessage(null);
  }

  async function handleSaveStrengthConfiguration() {
    setStrengthValidationError(null);
    setStrengthSuccessMessage(null);
    const parsedCount = parseNonNegativeInteger(strengthSessionCount);

    if (parsedCount === null || parsedCount < 1 || parsedCount > 7) {
      setStrengthValidationError('El plan semanal debe tener entre 1 y 7 sesiones.');
      return;
    }

    if (strengthDraft.length !== parsedCount) {
      setStrengthValidationError('Configura el número de sesiones antes de guardar.');
      return;
    }

    if (strengthDraft.some((session) => session.muscleGroupIds.length === 0)) {
      setStrengthValidationError('Asigna al menos un grupo muscular a cada sesión.');
      return;
    }

    try {
      await updateStrengthConfiguration(strengthDraft);
      setStrengthSuccessMessage('Plan semanal guardado para la próxima semana');
    } catch (error) {
      setStrengthValidationError(
        error instanceof Error ? error.message : 'No se pudo guardar el plan semanal.',
      );
    }
  }

  async function handleSaveGoal() {
    setValidationError(null);
    setSuccessMessage(null);
    const parsedGoal = parseNonNegativeInteger(goal);

    if (parsedGoal === null) {
      setValidationError('Escribe un número entero de pasos igual o mayor que cero.');
      return;
    }

    try {
      await updateDailyStepGoal(parsedGoal);
      setSuccessMessage('Objetivo guardado');
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  async function handleSaveHiitGoal() {
    setHiitValidationError(null);
    setHiitSuccessMessage(null);
    const parsedGoal = parseNonNegativeInteger(hiitGoal);

    if (parsedGoal === null) {
      setHiitValidationError(
        'Escribe un número entero de sesiones HIIT igual o mayor que cero.',
      );
      return;
    }

    try {
      await updateHiitWeeklyGoal(parsedGoal);
      setHiitSuccessMessage('Objetivo HIIT guardado para la próxima semana');
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  async function handleWaterToggle(enabled: boolean) {
    if (enabled) {
      await handleSaveWaterSettings(true);
      return;
    }

    setWaterValidationError(null);
    setWaterSuccessMessage(null);

    try {
      await updateWaterSettings({
        ...configuredWaterSettings,
        enabled: false,
      });
      setWaterSuccessMessage('Recordatorios de agua desactivados');
    } catch (error) {
      setWaterValidationError(
        error instanceof Error
          ? error.message
          : 'No se pudieron desactivar los recordatorios de agua.',
      );
    }
  }

  async function handleSaveWaterSettings(enabled = configuredWaterSettings.enabled) {
    setWaterValidationError(null);
    setWaterSuccessMessage(null);
    const parsedInterval = parsePositiveNumber(waterInterval);
    const settings: WaterSettings = {
      enabled,
      startTime: waterStartTime.trim(),
      endTime: waterEndTime.trim(),
      intervalHours: parsedInterval ?? Number.NaN,
    };

    try {
      await updateWaterSettings(settings);
      setWaterSuccessMessage(
        enabled
          ? 'Recordatorios de agua activados'
          : 'Configuración de recordatorios de agua guardada',
      );
    } catch (error) {
      setWaterValidationError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la configuración de agua.',
      );
    }
  }

  return (
    <Screen title="Ajustes">
      <Text style={styles.introText}>
        Configura los valores locales de tu seguimiento. Ningún dato sale del teléfono.
      </Text>

      <Card>
        <SectionLabel>Objetivo diario de pasos</SectionLabel>
        <Text style={styles.supportText}>
          Objetivo diario: {formatNumber(currentGoal)} pasos
        </Text>
        <TextInput
          accessibilityLabel="Objetivo diario"
          autoCapitalize="none"
          keyboardType="number-pad"
          onChangeText={setGoal}
          placeholder="Número de pasos"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="daily-step-goal-input"
          value={goal}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar objetivo"
          onPress={() => void handleSaveGoal()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Guardar objetivo</Text>
        </Pressable>
        {validationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {validationError}
          </Text>
        ) : null}
        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
        {successMessage ? (
          <Text style={styles.successText}>
            {successMessage}
          </Text>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>Plan semanal de fuerza</SectionLabel>
        <Text style={styles.metricText}>
          {state.settings.strengthSessions.length} sesiones
        </Text>
        <Text style={styles.supportText}>
          Los cambios se aplicarán el próximo lunes y no modifican la semana actual.
        </Text>
        <TextInput
          accessibilityLabel="Número de sesiones semanales de fuerza"
          autoCapitalize="none"
          keyboardType="number-pad"
          onChangeText={handleStrengthSessionCountChange}
          placeholder="Número de sesiones"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="strength-session-count-input"
          value={strengthSessionCount}
        />
        {strengthDraft.map((session, sessionIndex) => (
          <View key={`strength-draft-${sessionIndex}`} style={styles.strengthDraftBlock}>
            <Text style={styles.listRowTitle}>
              Sesión {sessionIndex + 1}: {session.name}
            </Text>
            <Text style={styles.supportText}>Grupos musculares asignados</Text>
            <View style={styles.groupList}>
              {DEFAULT_MUSCLE_GROUPS.map((group) => {
                const isSelected = session.muscleGroupIds.includes(group.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar ${group.name} para sesión ${sessionIndex + 1}`}
                    accessibilityState={{ selected: isSelected }}
                    key={`strength-draft-${sessionIndex}-${group.id}`}
                    onPress={() => toggleStrengthGroup(sessionIndex, group.id)}
                    style={[
                      styles.groupChip,
                      isSelected && styles.groupChipSelected,
                    ]}
                  >
                    <Text style={styles.groupChipText}>{group.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar plan semanal de fuerza"
          onPress={() => void handleSaveStrengthConfiguration()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Guardar plan semanal</Text>
        </Pressable>
        {strengthValidationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {strengthValidationError}
          </Text>
        ) : null}
        {strengthSuccessMessage ? (
          <Text style={styles.successText}>{strengthSuccessMessage}</Text>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>HIIT semanal</SectionLabel>
        <Text style={styles.supportText}>
          Objetivo semanal: {formatNumber(configuredHiitGoal)}{' '}
          {configuredHiitGoal === 1 ? 'sesión' : 'sesiones'}
        </Text>
        <TextInput
          accessibilityLabel="Objetivo semanal de HIIT"
          autoCapitalize="none"
          keyboardType="number-pad"
          onChangeText={(value) => {
            setHiitGoal(value);
            setHiitValidationError(null);
            setHiitSuccessMessage(null);
          }}
          placeholder="Número de sesiones HIIT"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="hiit-weekly-goal-input"
          value={hiitGoal}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar objetivo semanal de HIIT"
          onPress={() => void handleSaveHiitGoal()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Guardar objetivo HIIT</Text>
        </Pressable>
        <Text style={styles.supportText}>
          Los cambios se aplicarán el próximo lunes y no modifican la semana actual.
        </Text>
        {hiitValidationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {hiitValidationError}
          </Text>
        ) : null}
        {hiitSuccessMessage ? (
          <Text style={styles.successText}>{hiitSuccessMessage}</Text>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>Recordatorios de agua</SectionLabel>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.metricText}>
              {waterRemindersActive ? 'Activos' : 'Inactivos'}
            </Text>
            <Text style={styles.supportText}>
              {waterPermissionStatus === 'denied'
                ? 'Permiso de notificaciones denegado. Actívalo en Ajustes de Android para recibir avisos.'
                : waterScheduleStatus === 'error'
                  ? 'No se pudieron actualizar los avisos. Revisa los permisos e inténtalo de nuevo.'
                  : 'Activa los avisos para solicitar el permiso y programar recordatorios locales.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Activar recordatorios de agua"
            accessibilityRole="switch"
            onValueChange={(enabled) => void handleWaterToggle(enabled)}
            thumbColor={colors.text}
            trackColor={{ false: colors.neutralSurface, true: colors.accent }}
            testID="water-enabled-switch"
            value={state.settings.water.enabled}
          />
        </View>
        <Text style={styles.supportText}>
          Configurados de {waterStartTime} a {waterEndTime} cada {waterInterval} horas.
        </Text>
        <TextInput
          accessibilityLabel="Hora inicial de recordatorios de agua"
          autoCapitalize="none"
          onChangeText={(value) => {
            setWaterStartTime(value);
            setWaterValidationError(null);
            setWaterSuccessMessage(null);
          }}
          placeholder="08:00"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="water-start-time-input"
          value={waterStartTime}
        />
        <TextInput
          accessibilityLabel="Hora final de recordatorios de agua"
          autoCapitalize="none"
          onChangeText={(value) => {
            setWaterEndTime(value);
            setWaterValidationError(null);
            setWaterSuccessMessage(null);
          }}
          placeholder="22:00"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="water-end-time-input"
          value={waterEndTime}
        />
        <TextInput
          accessibilityLabel="Intervalo de recordatorios de agua"
          autoCapitalize="none"
          keyboardType="decimal-pad"
          onChangeText={(value) => {
            setWaterInterval(value);
            setWaterValidationError(null);
            setWaterSuccessMessage(null);
          }}
          placeholder="Intervalo en horas"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="water-interval-input"
          value={waterInterval}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar recordatorios de agua"
          onPress={() => void handleSaveWaterSettings()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Guardar recordatorios de agua</Text>
        </Pressable>
        {waterValidationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {waterValidationError}
          </Text>
        ) : null}
        {waterSuccessMessage ? (
          <Text style={styles.successText}>{waterSuccessMessage}</Text>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>Grupos musculares iniciales</SectionLabel>
        <Text style={styles.supportText}>
          {DEFAULT_MUSCLE_GROUPS.map((group) => group.name).join(' · ')}
        </Text>
      </Card>

      <Text style={styles.storageNote}>
        Datos guardados localmente · {currentDay?.date ?? formatDateKey(new Date())}
      </Text>
    </Screen>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.centeredScreen} testID="loading-screen">
      <Text style={styles.appName}>GYM TRACKER</Text>
      <Text style={styles.screenTitle}>Cargando tus datos…</Text>
      <Text style={styles.supportText}>La primera carga puede tardar un momento.</Text>
    </View>
  );
}

export function StorageErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centeredScreen} testID="storage-error-screen">
      <Text style={styles.appName}>GYM TRACKER</Text>
      <Text style={styles.screenTitle}>No se pudieron cargar tus datos</Text>
      <Text style={styles.errorText}>
        Comprueba el almacenamiento de la aplicación e inténtalo de nuevo.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reintentar carga"
        onPress={onRetry}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryButtonText}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 32,
  },
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  appName: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  introText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
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
  dashboardProgressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  dashboardProgressCopy: {
    flex: 1,
    gap: 6,
  },
  circularProgress: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: 'center',
    position: 'relative',
  },
  progressSegment: {
    borderRadius: 99,
    position: 'absolute',
  },
  circularProgressCenter: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    height: '62%',
    justifyContent: 'center',
    position: 'absolute',
    width: '62%',
  },
  circularProgressCurrent: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 25,
    textAlign: 'center',
  },
  circularProgressGoal: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  circularProgressPercentage: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  libraryTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
  },
  metricText: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
  },
  activeMetricText: {
    color: colors.warning,
  },
  fastingWeekSummary: {
    gap: 8,
  },
  fastingSummaryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  fastingDayList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fastingDayItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  fastingDayLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  fastingDayCircle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  fastingDayCircleNeutral: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
  },
  fastingDayCircleSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.accent,
  },
  fastingDayCircleDanger: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
  },
  fastingDayCircleActive: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.warning,
  },
  fastingDayHours: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 17,
  },
  fastingDayHoursUnit: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 11,
  },
  fastingGuidance: {
    gap: 4,
  },
  supportText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  sessionList: {
    gap: 8,
    marginTop: 4,
  },
  historyList: {
    gap: 10,
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  weekStatusText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  weeklyProgressBlock: {
    gap: 6,
  },
  statisticsBlock: {
    gap: 6,
  },
  statisticsList: {
    gap: 4,
  },
  weeklySessionList: {
    gap: 8,
  },
  weeklySessionRow: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    gap: 4,
    padding: 10,
  },
  historyDate: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  strengthSessionRow: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  nextSessionBlock: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  sessionGroupList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sessionGroupChip: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionGroupChipText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  strengthDraftBlock: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  muscleGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  muscleGroupCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 132,
    padding: 10,
    width: '31%',
  },
  groupIcon: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  muscleGroupCardName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  muscleGroupCardCount: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  groupHeaderIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 14,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  groupHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  selectedGroupField: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  selectedGroupName: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '800',
  },
  exerciseList: {
    gap: 10,
    marginTop: 4,
  },
  mediaPreviewList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mediaPreviewCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 8,
    width: 148,
  },
  mediaPreviewButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 112,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 128,
  },
  mediaThumbnail: {
    height: 112,
    width: 128,
  },
  videoThumbnail: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  videoThumbnailIcon: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  videoThumbnailText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  mediaTypeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  missingMediaState: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    padding: 8,
    width: '100%',
  },
  missingMediaTitle: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  missingMediaText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  mediaViewerBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  mediaViewerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    maxHeight: '90%',
    padding: 14,
    width: '100%',
  },
  mediaViewerImage: {
    height: 360,
    width: '100%',
  },
  mediaViewerVideo: {
    height: 260,
    width: '100%',
  },
  exerciseCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  exerciseCoverPlaceholder: {
    alignItems: 'center',
    aspectRatio: 2.2,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  exerciseCoverImage: {
    aspectRatio: 2.2,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },
  exerciseCoverIcon: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: '800',
  },
  exerciseCoverText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseCardCopy: {
    gap: 4,
  },
  exerciseDescription: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  listRowCopy: {
    flex: 1,
    gap: 2,
  },
  listRowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  mutedText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: 99,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  statusPillDone: {
    backgroundColor: colors.successSurface,
  },
  statusPillPending: {
    backgroundColor: colors.neutralSurface,
  },
  statusPillText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '800',
  },
  formBlock: {
    gap: 10,
  },
  groupList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.accentBorder,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupChipSelected: {
    backgroundColor: colors.accentSoft,
  },
  groupChipText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '800',
  },
  disabledButton: {
    backgroundColor: colors.neutralSurface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  disabledSecondaryButton: {
    backgroundColor: colors.surfaceSunken,
    borderColor: colors.border,
  },
  smallDangerButton: {
    borderColor: colors.dangerSurface,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  smallDangerButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.accentText,
    fontSize: 17,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerButton,
    borderColor: colors.dangerButton,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  dangerButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  confirmationBlock: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  confirmationTitle: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  successText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  storageNote: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
