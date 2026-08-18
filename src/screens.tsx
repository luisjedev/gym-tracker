import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateFastingDurationMinutes, getAverageFastingDurationMinutes } from './storage/fasting';
import { useAppState } from './state/AppStateContext';
import {
  DEFAULT_WATER_SETTINGS,
  formatDateKey,
  sortExercises,
  type Exercise,
  type MuscleGroup,
  type StrengthSession,
  type StrengthSessionInput,
  type WaterSettings,
} from './storage/schema';
import type { RootTabParamList } from './navigation/types';

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

function formatFastingStart(startedAt: string): string {
  const date = new Date(startedAt);
  const datePart = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart}, ${timePart}`;
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.appName}>GYM TRACKER</Text>
        <Text style={styles.screenTitle}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
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

export function HomeScreen() {
  const {
    state,
    currentDay,
    currentTime,
    currentWeek,
    errorMessage,
    finishFasting,
    markHeatSessionCompleted,
    setStrengthSessionCompleted,
    startFasting,
    undoHeatSession,
    updateDailySteps,
    waterPermissionStatus,
    waterScheduleStatus,
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
    ? getSessionGroups(nextStrengthSession, state.muscleGroups)
    : [];
  const heatCompleted = currentWeek?.heatCompleted ?? 0;
  const heatGoal = currentWeek?.heatGoal ?? state.settings.heatWeeklyGoal;
  const heatStatus = getStrengthProgressStatus(heatCompleted, heatGoal);
  const heatRemaining = Math.max(heatGoal - heatCompleted, 0);
  const waterRemindersActive =
    state.settings.water.enabled &&
    waterPermissionStatus === 'granted' &&
    waterScheduleStatus === 'scheduled';
  const activeFasting = state.fasting.active;
  const activeFastingDuration = activeFasting
    ? calculateFastingDurationMinutes(
        activeFasting.startedAt,
        currentTime.toISOString(),
      )
    : null;
  const lastCompletedFasting = state.fasting.completed[0] ?? null;
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

  async function handleMarkHeatSession() {
    try {
      await markHeatSessionCompleted();
    } catch {
      // El contexto conserva el valor anterior y muestra el error de almacenamiento.
    }
  }

  async function handleUndoHeatSession() {
    try {
      await undoHeatSession();
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

      <Card>
        <SectionLabel>Pasos de hoy</SectionLabel>
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
        <TextInput
          accessibilityLabel="Pasos de hoy"
          autoCapitalize="none"
          keyboardType="number-pad"
          onChangeText={(value) => {
            setStepsInput(value);
            setStepsValidationError(null);
          }}
          placeholder="Número de pasos"
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

      <Card>
        <SectionLabel>Ayuno</SectionLabel>
        {activeFasting && activeFastingDuration !== null ? (
          <>
            <Text style={styles.metricText}>Ayuno activo</Text>
            <Text style={styles.supportText}>
              Hora de inicio: {formatFastingStart(activeFasting.startedAt)}
            </Text>
            <Text style={styles.supportText}>
              Duración: {formatFastingDuration(activeFastingDuration)}
            </Text>
            <Text style={styles.supportText}>
              Duración media: {averageFastingDurationLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finalizar ayuno"
              onPress={() => void handleFinishFasting()}
              style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
            >
              <Text style={styles.dangerButtonText}>Finalizar ayuno</Text>
            </Pressable>
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
            <Text style={styles.supportText}>
              Duración media: {averageFastingDurationLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Iniciar ayuno"
              onPress={() => void handleStartFasting()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Iniciar ayuno</Text>
            </Pressable>
          </>
        )}
      </Card>

      <Card>
        <SectionLabel>Fuerza semanal</SectionLabel>
        <Text style={styles.metricText}>
          {completedStrength} / {strengthGoal} sesiones
        </Text>
        <Text style={styles.supportText}>Estado: {strengthStatus}</Text>
        <Text style={styles.supportText}>
          {completedStrength >= strengthGoal
            ? 'Objetivo completado'
            : `Quedan ${strengthGoal - completedStrength} sesiones`}
        </Text>
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
              muscleGroups={getSessionGroups(session, state.muscleGroups)}
              onOpenGroup={openMuscleGroup}
              onToggle={handleToggleStrengthSession}
              session={session}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>HEAT semanal</SectionLabel>
        <Text style={styles.metricText}>
          {heatCompleted} / {heatGoal} sesiones
        </Text>
        <Text style={styles.supportText}>Estado: {heatStatus}</Text>
        <Text style={styles.supportText}>
          {heatRemaining > 0
            ? `Quedan ${heatRemaining} sesiones`
            : 'Objetivo completado'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marcar sesión HEAT como completada"
          disabled={heatCompleted >= heatGoal}
          onPress={() => void handleMarkHeatSession()}
          style={({ pressed }) => [
            styles.primaryButton,
            heatCompleted >= heatGoal && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Marcar sesión HEAT</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revertir última marca de HEAT"
          disabled={heatCompleted <= 0}
          onPress={() => void handleUndoHeatSession()}
          style={({ pressed }) => [
            styles.secondaryButton,
            heatCompleted <= 0 && styles.disabledSecondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Revertir última marca</Text>
        </Pressable>
      </Card>

      <Card>
        <SectionLabel>Recordatorios de agua</SectionLabel>
        <Text style={styles.metricText}>
          {waterRemindersActive ? 'Activos' : 'Inactivos'}
        </Text>
        <Text style={styles.supportText}>
          {state.settings.water.startTime}–{state.settings.water.endTime} cada{' '}
          {state.settings.water.intervalHours} horas
        </Text>
        <Text style={styles.emptyText}>
          {waterRemindersActive
            ? 'Los avisos se repiten cada día dentro de la ventana configurada.'
            : waterPermissionStatus === 'denied'
              ? 'El permiso de notificaciones está denegado. Revísalo desde Ajustes.'
              : waterScheduleStatus === 'error'
                ? 'No se pudieron actualizar los avisos. Revisa los permisos e inténtalo de nuevo.'
                : 'Activa los avisos desde Ajustes cuando quieras recibirlos.'}
        </Text>
      </Card>
    </Screen>
  );
}

export function ExercisesScreen() {
  const {
    state,
    createExercise,
    createMuscleGroup,
    deleteExercise,
    deleteMuscleGroup,
    errorMessage,
    updateExercise,
    updateMuscleGroup,
  } = useAppState();
  const route = useRoute<RouteProp<RootTabParamList, 'Exercises'>>();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    route.params?.groupId ?? null,
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [isGroupFormVisible, setIsGroupFormVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupValidationError, setGroupValidationError] = useState<string | null>(null);
  const [groupSuccessMessage, setGroupSuccessMessage] = useState<string | null>(null);
  const [isExerciseFormVisible, setIsExerciseFormVisible] = useState(false);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [exerciseGroupId, setExerciseGroupId] = useState<string | null>(null);
  const [exerciseValidationError, setExerciseValidationError] = useState<string | null>(null);
  const [exerciseSuccessMessage, setExerciseSuccessMessage] = useState<string | null>(null);
  const [isExerciseEditVisible, setIsExerciseEditVisible] = useState(false);
  const [exerciseEditName, setExerciseEditName] = useState('');
  const [exerciseEditDescription, setExerciseEditDescription] = useState('');
  const [exerciseEditGroupId, setExerciseEditGroupId] = useState<string | null>(null);
  const [exerciseEditError, setExerciseEditError] = useState<string | null>(null);
  const [exerciseActionError, setExerciseActionError] = useState<string | null>(null);
  const [isExerciseDeleteConfirmationVisible, setIsExerciseDeleteConfirmationVisible] = useState(false);
  const [groupEditId, setGroupEditId] = useState<string | null>(null);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditError, setGroupEditError] = useState<string | null>(null);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);

  useEffect(() => {
    // A strength session can open this tab with a preselected muscle group.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroupId(route.params?.groupId ?? null);
  }, [route.params?.groupId]);

  if (!state) {
    return null;
  }

  const selectedGroup = state.muscleGroups.find(
    (group) => group.id === selectedGroupId,
  );
  const selectedExercise = state.exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );
  const selectedExerciseGroup = selectedExercise
    ? state.muscleGroups.find((group) => group.id === selectedExercise.muscleGroupId)
    : null;

  async function handleCreateGroup() {
    setGroupValidationError(null);
    setGroupSuccessMessage(null);

    if (!groupName.trim()) {
      setGroupValidationError('Escribe un nombre para el grupo muscular.');
      return;
    }

    try {
      await createMuscleGroup(groupName);
      setGroupName('');
      setIsGroupFormVisible(false);
      setGroupSuccessMessage('Grupo muscular guardado');
    } catch (error) {
      setGroupValidationError(
        error instanceof Error ? error.message : 'No se pudo guardar el grupo muscular.',
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

    if (!exerciseGroupId) {
      setExerciseValidationError('Selecciona un grupo muscular.');
      return;
    }

    try {
      await createExercise({
        name: exerciseName,
        muscleGroupId: exerciseGroupId,
        description: exerciseDescription,
      });
      setExerciseName('');
      setExerciseDescription('');
      setExerciseGroupId(null);
      setIsExerciseFormVisible(false);
      setExerciseSuccessMessage('Ejercicio guardado');
    } catch (error) {
      setExerciseValidationError(
        error instanceof Error ? error.message : 'No se pudo guardar el ejercicio.',
      );
    }
  }

  function startGroupEdit(groupId: string) {
    const currentState = state;
    if (!currentState) {
      return;
    }

    const group = currentState.muscleGroups.find((item) => item.id === groupId);
    if (!group) {
      return;
    }

    setGroupEditId(group.id);
    setGroupEditName(group.name);
    setGroupEditError(null);
    setGroupActionError(null);
  }

  async function handleUpdateGroup() {
    if (!groupEditId) {
      return;
    }

    setGroupEditError(null);
    setGroupSuccessMessage(null);

    if (!groupEditName.trim()) {
      setGroupEditError('Escribe un nombre para el grupo muscular.');
      return;
    }

    try {
      await updateMuscleGroup(groupEditId, groupEditName);
      setGroupEditId(null);
      setGroupEditName('');
      setGroupSuccessMessage('Grupo muscular actualizado');
    } catch (error) {
      setGroupEditError(
        error instanceof Error ? error.message : 'No se pudo actualizar el grupo muscular.',
      );
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setGroupActionError(null);
    setGroupSuccessMessage(null);

    try {
      await deleteMuscleGroup(groupId);
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
      }
      if (exerciseGroupId === groupId) {
        setExerciseGroupId(null);
      }
      if (groupEditId === groupId) {
        setGroupEditId(null);
        setGroupEditName('');
      }
      setGroupSuccessMessage('Grupo muscular eliminado');
    } catch (error) {
      setGroupActionError(
        error instanceof Error ? error.message : 'No se pudo eliminar el grupo muscular.',
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
    setExerciseEditError(null);
    setExerciseActionError(null);
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
      await updateExercise(selectedExercise.id, {
        name: exerciseEditName,
        muscleGroupId: exerciseEditGroupId,
        description: exerciseEditDescription,
      });
      setIsExerciseEditVisible(false);
      setExerciseSuccessMessage('Ejercicio actualizado');
    } catch (error) {
      setExerciseEditError(
        error instanceof Error ? error.message : 'No se pudo actualizar el ejercicio.',
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
                style={styles.input}
                testID="exercise-edit-name-input"
                value={exerciseEditName}
              />
              <TextInput
                accessibilityLabel="Descripción del ejercicio a editar"
                multiline
                onChangeText={setExerciseEditDescription}
                style={[styles.input, styles.multilineInput]}
                testID="exercise-edit-description-input"
                value={exerciseEditDescription}
              />
              <Text style={styles.supportText}>Selecciona un grupo muscular</Text>
              <View style={styles.groupList}>
                {state.muscleGroups.map((group) => (
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

  const orderedExercises = sortExercises(state.exercises, state.muscleGroups);
  const visibleExercises = selectedGroupId
    ? orderedExercises.filter((exercise) => exercise.muscleGroupId === selectedGroupId)
    : orderedExercises;

  return (
    <Screen title="Ejercicios">
      <Text style={styles.introText}>
        Tu biblioteca local estará disponible aunque no tengas conexión.
      </Text>
      <Card>
        <Text style={styles.libraryTitle}>Biblioteca de ejercicios</Text>
        <SectionLabel>Grupos musculares</SectionLabel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear grupo muscular"
          onPress={() => {
            setGroupValidationError(null);
            setGroupActionError(null);
            setGroupSuccessMessage(null);
            setIsGroupFormVisible(true);
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>Crear grupo muscular</Text>
        </Pressable>
        {isGroupFormVisible ? (
          <View style={styles.formBlock}>
            <TextInput
              accessibilityLabel="Nombre del grupo muscular"
              autoCapitalize="words"
              onChangeText={setGroupName}
              placeholder="Ej.: Core"
              style={styles.input}
              testID="muscle-group-name-input"
              value={groupName}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guardar grupo muscular"
              onPress={() => void handleCreateGroup()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Guardar grupo muscular</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar creación de grupo"
              onPress={() => {
                setGroupName('');
                setGroupValidationError(null);
                setIsGroupFormVisible(false);
              }}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        ) : null}
        {groupValidationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {groupValidationError}
          </Text>
        ) : null}
        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
        {groupSuccessMessage ? (
          <Text style={styles.successText}>{groupSuccessMessage}</Text>
        ) : null}
        <View style={styles.groupList}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mostrar todos los ejercicios"
            accessibilityState={{ selected: selectedGroupId === null }}
            onPress={() => setSelectedGroupId(null)}
            style={[
              styles.groupChip,
              selectedGroupId === null && styles.groupChipSelected,
            ]}
          >
            <Text style={styles.groupChipText}>Todos</Text>
          </Pressable>
          {state.muscleGroups.map((group) => (
            <View key={group.id} style={styles.groupManagementRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por ${group.name}`}
                accessibilityState={{ selected: group.id === selectedGroupId }}
                onPress={() => setSelectedGroupId(group.id)}
                style={[
                  styles.groupChip,
                  group.id === selectedGroupId && styles.groupChipSelected,
                ]}
              >
                <Text style={styles.groupChipText}>{group.name}</Text>
              </Pressable>
              <View style={styles.groupActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Renombrar grupo ${group.name}`}
                  onPress={() => startGroupEdit(group.id)}
                  style={({ pressed }) => [styles.smallActionButton, pressed && styles.pressed]}
                >
                  <Text style={styles.smallActionButtonText}>Renombrar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar grupo ${group.name}`}
                  onPress={() => void handleDeleteGroup(group.id)}
                  style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
                >
                  <Text style={styles.smallDangerButtonText}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        {groupEditId ? (
          <View style={styles.formBlock}>
            <TextInput
              accessibilityLabel="Nombre del grupo muscular a editar"
              autoCapitalize="words"
              onChangeText={setGroupEditName}
              style={styles.input}
              testID="muscle-group-edit-name-input"
              value={groupEditName}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guardar cambios del grupo muscular"
              onPress={() => void handleUpdateGroup()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Guardar cambios del grupo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar edición del grupo muscular"
              onPress={() => {
                setGroupEditId(null);
                setGroupEditName('');
                setGroupEditError(null);
              }}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        ) : null}
        {groupEditError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {groupEditError}
          </Text>
        ) : null}
        {groupActionError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {groupActionError}
          </Text>
        ) : null}
        {selectedGroup ? (
          <Text style={styles.supportText}>Filtro: {selectedGroup.name}</Text>
        ) : null}

        <SectionLabel>Ejercicios</SectionLabel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear ejercicio"
          onPress={() => {
            setExerciseValidationError(null);
            setExerciseSuccessMessage(null);
            setIsExerciseFormVisible(true);
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonText}>Crear ejercicio</Text>
        </Pressable>
        {isExerciseFormVisible ? (
          <View style={styles.formBlock}>
            <TextInput
              accessibilityLabel="Nombre del ejercicio"
              autoCapitalize="words"
              onChangeText={setExerciseName}
              placeholder="Ej.: Press banca"
              style={styles.input}
              testID="exercise-name-input"
              value={exerciseName}
            />
            <TextInput
              accessibilityLabel="Descripción del ejercicio"
              multiline
              onChangeText={setExerciseDescription}
              placeholder="Descripción opcional"
              style={[styles.input, styles.multilineInput]}
              testID="exercise-description-input"
              value={exerciseDescription}
            />
            <Text style={styles.supportText}>Selecciona un grupo muscular</Text>
            <View style={styles.groupList}>
              {state.muscleGroups.map((group) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar grupo ${group.name}`}
                  accessibilityState={{ selected: group.id === exerciseGroupId }}
                  key={`exercise-${group.id}`}
                  onPress={() => setExerciseGroupId(group.id)}
                  style={[
                    styles.groupChip,
                    group.id === exerciseGroupId && styles.groupChipSelected,
                  ]}
                >
                  <Text style={styles.groupChipText}>{group.name}</Text>
                </Pressable>
              ))}
            </View>
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
              onPress={() => {
                setExerciseName('');
                setExerciseDescription('');
                setExerciseGroupId(null);
                setExerciseValidationError(null);
                setIsExerciseFormVisible(false);
              }}
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
        {exerciseSuccessMessage ? (
          <Text style={styles.successText}>{exerciseSuccessMessage}</Text>
        ) : null}

        {visibleExercises.length === 0 ? (
          <Text style={styles.emptyText}>
            {selectedGroup
              ? 'No hay ejercicios en este grupo todavía.'
              : 'Aún no hay ejercicios guardados.'}
          </Text>
        ) : (
          <View style={styles.exerciseList}>
            {visibleExercises.map((exercise: Exercise) => {
              const group = state.muscleGroups.find(
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
                  style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}
                >
                  <View style={styles.listRowCopy}>
                    <Text style={styles.listRowTitle}>{exercise.name}</Text>
                    <Text style={styles.mutedText}>
                      {group?.name ?? 'Grupo no disponible'}
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

export function HistoryScreen() {
  return (
    <Screen title="Historial">
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

export function SettingsScreen() {
  const {
    state,
    currentDay,
    errorMessage,
    updateDailyStepGoal,
    updateHeatWeeklyGoal,
    updateStrengthConfiguration,
    updateWaterSettings,
    waterPermissionStatus,
    waterScheduleStatus,
  } = useAppState();
  const currentGoal = currentDay?.stepGoal ?? state?.settings.dailyStepGoal ?? 0;
  const configuredHeatGoal = state?.settings.heatWeeklyGoal ?? 0;
  const configuredWaterSettings = state?.settings.water ?? DEFAULT_WATER_SETTINGS;
  const strengthSessions = useMemo(
    () => state?.settings.strengthSessions ?? [],
    [state?.settings.strengthSessions],
  );
  const [goal, setGoal] = useState(String(currentGoal));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [heatGoal, setHeatGoal] = useState(String(configuredHeatGoal));
  const [heatValidationError, setHeatValidationError] = useState<string | null>(null);
  const [heatSuccessMessage, setHeatSuccessMessage] = useState<string | null>(null);
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
    // Refresh the HEAT form when the persisted configuration changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeatGoal(String(configuredHeatGoal));
    setHeatValidationError(null);
  }, [configuredHeatGoal]);

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

  async function handleSaveHeatGoal() {
    setHeatValidationError(null);
    setHeatSuccessMessage(null);
    const parsedGoal = parseNonNegativeInteger(heatGoal);

    if (parsedGoal === null) {
      setHeatValidationError(
        'Escribe un número entero de sesiones HEAT igual o mayor que cero.',
      );
      return;
    }

    try {
      await updateHeatWeeklyGoal(parsedGoal);
      setHeatSuccessMessage('Objetivo HEAT guardado para la próxima semana');
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
              {state.muscleGroups.map((group) => {
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
        <SectionLabel>HEAT semanal</SectionLabel>
        <Text style={styles.supportText}>
          Objetivo semanal: {formatNumber(configuredHeatGoal)}{' '}
          {configuredHeatGoal === 1 ? 'sesión' : 'sesiones'}
        </Text>
        <TextInput
          accessibilityLabel="Objetivo semanal de HEAT"
          autoCapitalize="none"
          keyboardType="number-pad"
          onChangeText={(value) => {
            setHeatGoal(value);
            setHeatValidationError(null);
            setHeatSuccessMessage(null);
          }}
          placeholder="Número de sesiones HEAT"
          style={styles.input}
          testID="heat-weekly-goal-input"
          value={heatGoal}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Guardar objetivo semanal de HEAT"
          onPress={() => void handleSaveHeatGoal()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Guardar objetivo HEAT</Text>
        </Pressable>
        <Text style={styles.supportText}>
          Los cambios se aplicarán el próximo lunes y no modifican la semana actual.
        </Text>
        {heatValidationError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {heatValidationError}
          </Text>
        ) : null}
        {heatSuccessMessage ? (
          <Text style={styles.successText}>{heatSuccessMessage}</Text>
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
          {state.muscleGroups.map((group) => group.name).join(' · ')}
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
    <View style={styles.centeredScreen}>
      <Text style={styles.appName}>GYM TRACKER</Text>
      <Text style={styles.screenTitle}>Cargando tus datos…</Text>
      <Text style={styles.supportText}>La primera carga puede tardar un momento.</Text>
    </View>
  );
}

export function StorageErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centeredScreen}>
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
    backgroundColor: '#F4F7F5',
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
    backgroundColor: '#F4F7F5',
  },
  appName: {
    color: '#287A4D',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  screenTitle: {
    color: '#14251B',
    fontSize: 30,
    fontWeight: '800',
  },
  introText: {
    color: '#526158',
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: {
    color: '#287A4D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  libraryTitle: {
    color: '#14251B',
    fontSize: 21,
    fontWeight: '700',
  },
  metricText: {
    color: '#14251B',
    fontSize: 25,
    fontWeight: '800',
  },
  supportText: {
    color: '#526158',
    fontSize: 16,
    lineHeight: 23,
  },
  emptyTitle: {
    color: '#14251B',
    fontSize: 21,
    fontWeight: '700',
  },
  emptyText: {
    color: '#526158',
    fontSize: 15,
    lineHeight: 22,
  },
  sessionList: {
    gap: 8,
    marginTop: 4,
  },
  strengthSessionRow: {
    borderColor: '#DCE8DF',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  nextSessionBlock: {
    backgroundColor: '#F4F7F5',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  sessionGroupList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sessionGroupChip: {
    backgroundColor: '#E9F4EC',
    borderColor: '#CDE3D4',
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sessionGroupChipText: {
    color: '#287A4D',
    fontSize: 14,
    fontWeight: '700',
  },
  strengthDraftBlock: {
    borderColor: '#DCE8DF',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  exerciseList: {
    gap: 8,
    marginTop: 4,
  },
  exerciseRow: {
    alignItems: 'center',
    borderColor: '#DCE8DF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
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
    color: '#14251B',
    fontSize: 16,
    fontWeight: '700',
  },
  mutedText: {
    color: '#718078',
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
    backgroundColor: '#D9F3E2',
  },
  statusPillPending: {
    backgroundColor: '#E9EFEB',
  },
  statusPillText: {
    color: '#287A4D',
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
  groupManagementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 4,
  },
  groupChip: {
    borderColor: '#CDE3D4',
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupChipSelected: {
    backgroundColor: '#D9F3E2',
  },
  groupChipText: {
    color: '#287A4D',
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderColor: '#B8C9BD',
    borderRadius: 12,
    borderWidth: 1,
    color: '#14251B',
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
    backgroundColor: '#E9F4EC',
    borderColor: '#CDE3D4',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#287A4D',
    fontSize: 17,
    fontWeight: '800',
  },
  disabledButton: {
    backgroundColor: '#A7B8AD',
  },
  disabledSecondaryButton: {
    backgroundColor: '#F0F3F1',
    borderColor: '#DCE8DF',
  },
  smallActionButton: {
    borderColor: '#CDE3D4',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  smallActionButtonText: {
    color: '#287A4D',
    fontSize: 13,
    fontWeight: '700',
  },
  smallDangerButton: {
    borderColor: '#F3C4C0',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  smallDangerButtonText: {
    color: '#B42318',
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
    color: '#526158',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#287A4D',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#B42318',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  confirmationBlock: {
    borderColor: '#F3C4C0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  confirmationTitle: {
    color: '#7A271A',
    fontSize: 17,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  successText: {
    color: '#287A4D',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#B42318',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  storageNote: {
    color: '#718078',
    fontSize: 13,
    textAlign: 'center',
  },
});
