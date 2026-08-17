import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppState } from './state/AppStateContext';
import {
  formatDateKey,
  sortExercises,
  type Exercise,
  type StrengthSession,
} from './storage/schema';

export function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

function StrengthSessionRow({ session }: { session: StrengthSession }) {
  return (
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
  );
}

export function HomeScreen() {
  const { state, currentDay, currentWeek } = useAppState();

  if (!state) {
    return null;
  }

  const stepGoal = currentDay?.stepGoal ?? state.settings.dailyStepGoal;
  const stepsText = currentDay?.steps === null || currentDay?.steps === undefined
    ? 'Sin registrar'
    : `${formatNumber(currentDay.steps)} pasos`;
  const strengthSessions = currentWeek?.strengthSessions ?? state.settings.strengthSessions;
  const completedStrength = strengthSessions.filter((session) => session.completed).length;
  const strengthGoal = currentWeek?.strengthGoal ?? strengthSessions.length;
  const heatCompleted = currentWeek?.heatCompleted ?? 0;
  const heatGoal = currentWeek?.heatGoal ?? state.settings.heatWeeklyGoal;

  return (
    <Screen title="Inicio">
      <Text style={styles.introText}>Tu resumen de hoy y de esta semana.</Text>

      <Card>
        <SectionLabel>Pasos de hoy</SectionLabel>
        <Text style={styles.metricText}>{stepsText}</Text>
        <Text style={styles.supportText}>
          Objetivo: {formatNumber(stepGoal)} pasos
        </Text>
        <Text style={styles.emptyText}>
          Todavía no hay pasos registrados. Podrás añadirlos desde Inicio.
        </Text>
      </Card>

      <Card>
        <SectionLabel>Fuerza semanal</SectionLabel>
        <Text style={styles.metricText}>
          {completedStrength} / {strengthGoal} sesiones
        </Text>
        <Text style={styles.supportText}>
          {completedStrength === strengthGoal
            ? 'Objetivo completado'
            : `Quedan ${strengthGoal - completedStrength} sesiones`}
        </Text>
        <View style={styles.sessionList}>
          {strengthSessions.map((session) => (
            <StrengthSessionRow key={session.id} session={session} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionLabel>HEAT semanal</SectionLabel>
        <Text style={styles.metricText}>
          {heatCompleted} / {heatGoal} sesiones
        </Text>
        <Text style={styles.supportText}>
          {heatCompleted === heatGoal ? 'Objetivo completado' : 'Aún pendiente'}
        </Text>
      </Card>

      <Card>
        <SectionLabel>Recordatorios de agua</SectionLabel>
        <Text style={styles.metricText}>
          {state.settings.water.enabled ? 'Activos' : 'Inactivos'}
        </Text>
        <Text style={styles.supportText}>
          {state.settings.water.startTime}–{state.settings.water.endTime} cada{' '}
          {state.settings.water.intervalHours} horas
        </Text>
        <Text style={styles.emptyText}>
          Los avisos no se programan todavía. Se activarán en una próxima entrega.
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
    errorMessage,
  } = useAppState();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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

  if (selectedExercise) {
    return (
      <Screen title="Ejercicios">
        <Card>
          <Text style={styles.libraryTitle}>Detalle del ejercicio</Text>
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
            accessibilityLabel="Volver a ejercicios"
            onPress={() => setSelectedExerciseId(null)}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por ${group.name}`}
              accessibilityState={{ selected: group.id === selectedGroupId }}
              key={group.id}
              onPress={() => setSelectedGroupId(group.id)}
              style={[
                styles.groupChip,
                group.id === selectedGroupId && styles.groupChipSelected,
              ]}
            >
              <Text style={styles.groupChipText}>{group.name}</Text>
            </Pressable>
          ))}
        </View>
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
                  onPress={() => setSelectedExerciseId(exercise.id)}
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
  } = useAppState();
  const currentGoal = currentDay?.stepGoal ?? state?.settings.dailyStepGoal ?? 0;
  const [goal, setGoal] = useState(String(currentGoal));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!state) {
    return null;
  }

  async function handleSaveGoal() {
    setValidationError(null);
    setSuccessMessage(null);
    const parsedGoal = Number(goal);

    if (!Number.isInteger(parsedGoal) || parsedGoal < 0) {
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
          La configuración inicial ya está lista para la primera semana.
        </Text>
      </Card>

      <Card>
        <SectionLabel>HEAT semanal</SectionLabel>
        <Text style={styles.metricText}>{state.settings.heatWeeklyGoal} sesión</Text>
        <Text style={styles.supportText}>
          El objetivo inicial se guarda junto a cada semana.
        </Text>
      </Card>

      <Card>
        <SectionLabel>Recordatorios de agua</SectionLabel>
        <Text style={styles.metricText}>Inactivos</Text>
        <Text style={styles.supportText}>
          Configurados de {state.settings.water.startTime} a {state.settings.water.endTime}{' '}
          cada {state.settings.water.intervalHours} horas.
        </Text>
        <Text style={styles.emptyText}>
          No se han solicitado permisos ni programado notificaciones.
        </Text>
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
