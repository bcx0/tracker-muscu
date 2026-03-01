import { v4 as uuidv4 } from 'uuid';

import { getDayOfWeek } from '@/lib/dateUtils';
import { DayOfWeek, Exercise, ExerciseType, MuscleGroup, SessionType, WorkoutSession, WorkoutTemplate } from '@/types';

export interface ProgramExerciseDefinition {
  name: string;
  muscleLabel: string;
  muscle_group: MuscleGroup;
  type: ExerciseType;
  sets: number;
  repMin: number;
  repMax: number;
}

export const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const FRENCH_DAY_TO_DAY: Record<string, DayOfWeek> = {
  Lun: 'monday',
  Mar: 'tuesday',
  Mer: 'wednesday',
  Jeu: 'thursday',
  Ven: 'friday',
  Sam: 'saturday',
  Dim: 'sunday',
};

export const DAY_TO_FRENCH_LABEL: Record<DayOfWeek, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mer',
  thursday: 'Jeu',
  friday: 'Ven',
  saturday: 'Sam',
  sunday: 'Dim',
};

export const LEGACY_DAY_MAP: Record<string, DayOfWeek> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
  Lun: 'monday',
  Mar: 'tuesday',
  Mer: 'wednesday',
  Jeu: 'thursday',
  Ven: 'friday',
  Sam: 'saturday',
  Dim: 'sunday',
};

export const SESSION_LABELS: Record<SessionType, string> = {
  Push: 'PUSH',
  Pull: 'PULL',
  Abs: 'ABS',
  Rest: 'REPOS',
  Legs: 'LEGS',
  UpperChest_Shoulders: 'PECS & ÉPAULES',
  Abs_Arms: 'ÉPAULES & ABDOS',
  Full_Upper: 'PECS & BICEPS',
  Push_A: 'PUSH A',
  Pull_B: 'PULL B',
};

export const SESSION_GRADIENTS: Record<SessionType | 'rest', string> = {
  Push: 'from-[#ef4444] to-[#dc2626]',
  Pull: 'from-[#3b82f6] to-[#2563eb]',
  Abs: 'from-[#f59e0b] to-[#d97706]',
  Rest: 'from-[#1c1c1c] to-[#1c1c1c]',
  Legs: 'from-[#22c55e] to-[#16a34a]',
  UpperChest_Shoulders: 'from-[#a855f7] to-[#9333ea]',
  Abs_Arms: 'from-[#f59e0b] to-[#d97706]',
  Full_Upper: 'from-[#f97316] to-[#ea580c]',
  Push_A: 'from-[#ef4444] to-[#dc2626]',
  Pull_B: 'from-[#3b82f6] to-[#2563eb]',
  rest: 'from-[#1c1c1c] to-[#1c1c1c]',
};

export const EXERCISE_LIBRARY: ProgramExerciseDefinition[] = [
  { name: 'Développé couché haltères', muscleLabel: 'Pectoraux', muscle_group: 'chest', type: 'compound', sets: 4, repMin: 8, repMax: 12 },
  { name: 'Développé incliné haltères', muscleLabel: 'Pectoraux', muscle_group: 'chest', type: 'compound', sets: 3, repMin: 8, repMax: 12 },
  { name: 'Écarté élastique', muscleLabel: 'Pectoraux', muscle_group: 'chest', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Dips', muscleLabel: 'Pectoraux', muscle_group: 'chest', type: 'compound', sets: 3, repMin: 8, repMax: 12 },
  { name: 'Élévations latérales', muscleLabel: 'Épaules', muscle_group: 'shoulders', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Oiseau haltères', muscleLabel: 'Épaules', muscle_group: 'shoulders', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Rotation externe élastique', muscleLabel: 'Épaules', muscle_group: 'shoulders', type: 'isolation', sets: 3, repMin: 15, repMax: 20 },
  { name: 'Tirage poulie haute triceps élastique', muscleLabel: 'Triceps', muscle_group: 'triceps', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Extension triceps haltère overhead', muscleLabel: 'Triceps', muscle_group: 'triceps', type: 'isolation', sets: 3, repMin: 10, repMax: 15 },
  { name: 'Rowing haltère', muscleLabel: 'Dos', muscle_group: 'back', type: 'compound', sets: 4, repMin: 8, repMax: 12 },
  { name: 'Tirage vertical élastique', muscleLabel: 'Dos', muscle_group: 'back', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Tirage horizontal élastique', muscleLabel: 'Dos', muscle_group: 'back', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Curl marteau', muscleLabel: 'Biceps', muscle_group: 'biceps', type: 'isolation', sets: 3, repMin: 10, repMax: 15 },
  { name: 'Curl incliné haltère', muscleLabel: 'Biceps', muscle_group: 'biceps', type: 'isolation', sets: 3, repMin: 10, repMax: 15 },
  { name: 'Relevé de jambes banc incliné', muscleLabel: 'Abdominaux', muscle_group: 'abs', type: 'isolation', sets: 3, repMin: 12, repMax: 15 },
  { name: 'Crunch élastique', muscleLabel: 'Abdominaux', muscle_group: 'abs', type: 'isolation', sets: 3, repMin: 15, repMax: 20 },
  { name: 'Planche', muscleLabel: 'Abdominaux', muscle_group: 'abs', type: 'isolation', sets: 3, repMin: 30, repMax: 60 },
];

const EXERCISE_BY_NAME = new Map(EXERCISE_LIBRARY.map((exercise: ProgramExerciseDefinition) => [exercise.name, exercise]));

function getExerciseDefinition(name: string): ProgramExerciseDefinition {
  const exercise = EXERCISE_BY_NAME.get(name);
  if (!exercise) {
    throw new Error(`Exercice introuvable dans la bibliothèque: ${name}`);
  }
  return exercise;
}

function getPushExerciseNames(): string[] {
  return [
    'Développé couché haltères',
    'Développé incliné haltères',
    'Dips',
    'Écarté élastique',
    'Extension triceps haltère overhead',
  ];
}

function getPullExerciseNames(): string[] {
  return ['Rowing haltère', 'Tirage vertical élastique', 'Tirage horizontal élastique', 'Curl marteau', 'Curl incliné haltère'];
}

function getUpperChestShouldersExerciseNames(): string[] {
  return [
    'Développé incliné haltères',
    'Élévations latérales',
    'Oiseau haltères',
    'Rotation externe élastique',
    'Tirage poulie haute triceps élastique',
  ];
}

function getFullUpperExerciseNames(): string[] {
  return [
    'Développé couché haltères',
    'Rowing haltère',
    'Écarté élastique',
    'Curl marteau',
    'Curl incliné haltère',
  ];
}

function getAbsArmsExerciseNames(): string[] {
  return [
    'Relevé de jambes banc incliné',
    'Crunch élastique',
    'Planche',
    'Curl marteau',
    'Extension triceps haltère overhead',
  ];
}

function getAbsExerciseNames(): string[] {
  return ['Relevé de jambes banc incliné', 'Crunch élastique', 'Planche'];
}

export function normalizeTrainingDay(value: string): DayOfWeek | null {
  const trimmedValue = value.trim();
  return LEGACY_DAY_MAP[trimmedValue] ?? LEGACY_DAY_MAP[trimmedValue.toLowerCase()] ?? null;
}

export function normalizeTrainingDays(values: string[]): DayOfWeek[] {
  return values
    .map((value: string) => normalizeTrainingDay(value))
    .filter((value: DayOfWeek | null): value is DayOfWeek => value !== null)
    .sort((a: DayOfWeek, b: DayOfWeek) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

export function getFrenchDayLabel(day: DayOfWeek): string {
  return DAY_TO_FRENCH_LABEL[day];
}

export function getSessionTypeSequence(sessionsPerWeek: number): SessionType[] {
  switch (sessionsPerWeek) {
    case 2:
      return ['Push', 'Pull'];
    case 3:
      return ['Push', 'Pull', 'Abs'];
    case 4:
      return ['Push', 'Pull', 'UpperChest_Shoulders', 'Full_Upper'];
    case 5:
      return ['Push', 'Pull', 'UpperChest_Shoulders', 'Full_Upper', 'Abs'];
    case 6:
      return ['Push', 'Pull', 'UpperChest_Shoulders', 'Full_Upper', 'Abs_Arms', 'Abs'];
    default:
      throw new Error('Le nombre de séances doit être compris entre 2 et 6.');
  }
}

export function assignSessionTypesToTrainingDays(trainingDays: DayOfWeek[], sessionsPerWeek: number): Array<{ day: DayOfWeek; sessionType: SessionType }> {
  const orderedDays = normalizeTrainingDays(trainingDays);
  const sequence = getSessionTypeSequence(sessionsPerWeek);

  if (orderedDays.length !== sessionsPerWeek) {
    throw new Error('Le nombre de jours sélectionnés doit correspondre au nombre de séances.');
  }

  return orderedDays.map((day: DayOfWeek, index: number) => ({
    day,
    sessionType: sequence[index],
  }));
}

export function getMuscleGroupLabel(muscleGroup: MuscleGroup, exerciseName?: string): string {
  if (muscleGroup === 'arms' && exerciseName) {
    const normalized = exerciseName.toLowerCase();
    if (normalized.includes('triceps')) {
      return 'Triceps';
    }
    if (normalized.includes('curl') || normalized.includes('biceps')) {
      return 'Biceps';
    }
  }

  switch (muscleGroup) {
    case 'chest':
      return 'Pectoraux';
    case 'back':
      return 'Dos';
    case 'shoulders':
      return 'Épaules';
    case 'biceps':
      return 'Biceps';
    case 'triceps':
      return 'Triceps';
    case 'abs':
      return 'Abdominaux';
    case 'legs':
      return 'Jambes';
    case 'arms':
      return 'Bras';
    default:
      return 'Autres';
  }
}

export function getLibraryExerciseDefinitions(): ProgramExerciseDefinition[] {
  return EXERCISE_LIBRARY.map((exercise: ProgramExerciseDefinition) => ({ ...exercise }));
}

export function buildExerciseRowsForUser(userId: string): Omit<Exercise, 'id'>[] {
  return getLibraryExerciseDefinitions().map((exercise: ProgramExerciseDefinition) => ({
    user_id: userId,
    name: exercise.name,
    muscle_group: exercise.muscle_group,
    type: exercise.type,
    sets: exercise.sets,
    rep_range_min: exercise.repMin,
    rep_range_max: exercise.repMax,
    last_weight: 0,
    last_reps: exercise.repMin,
    suggested_weight: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  }));
}

export function buildWorkoutTemplates(userId: string, trainingDays: DayOfWeek[], sessionsPerWeek: number, exercises: Exercise[]): WorkoutTemplate[] {
  const exerciseByName = new Map(exercises.map((exercise: Exercise) => [exercise.name, exercise.id]));
  let pushIndex = 0;

  return assignSessionTypesToTrainingDays(trainingDays, sessionsPerWeek).map(({ sessionType }, index: number) => {
    let exerciseNames: string[] = [];

    if (sessionType === 'Push') {
      exerciseNames = getPushExerciseNames();
    } else if (sessionType === 'Pull') {
      exerciseNames = getPullExerciseNames();
    } else if (sessionType === 'UpperChest_Shoulders') {
      exerciseNames = getUpperChestShouldersExerciseNames();
    } else if (sessionType === 'Full_Upper') {
      exerciseNames = getFullUpperExerciseNames();
    } else if (sessionType === 'Abs_Arms') {
      exerciseNames = getAbsArmsExerciseNames();
    } else if (sessionType === 'Abs') {
      exerciseNames = getAbsExerciseNames();
    }

    return {
      id: uuidv4(),
      user_id: userId,
      session_type: sessionType,
      exercise_ids: exerciseNames.map((name: string) => exerciseByName.get(name)).filter((value: string | undefined): value is string => Boolean(value)),
      day_position: index + 1,
    };
  });
}

export function buildWeeklySessions(userId: string, weeklyPlanId: string, weekStart: string, trainingDays: DayOfWeek[], sessionsPerWeek: number, templates: WorkoutTemplate[]): WorkoutSession[] {
  const assignments = assignSessionTypesToTrainingDays(trainingDays, sessionsPerWeek);
  const assignmentByDay = new Map(assignments.map((assignment) => [assignment.day, assignment]));
  const templateByPosition = new Map(templates.map((template: WorkoutTemplate) => [template.day_position, template]));

  return DAY_ORDER.map((day: DayOfWeek, index: number) => {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + index);
    const scheduledDate = date.toISOString().slice(0, 10);
    const assignment = assignmentByDay.get(day);

    if (!assignment) {
      return {
        id: uuidv4(),
        user_id: userId,
        weekly_plan_id: weeklyPlanId,
        session_type: 'Rest',
        scheduled_date: scheduledDate,
        day_of_week: getDayOfWeek(scheduledDate),
        status: 'rest',
        planned_exercise_ids: [],
        points_earned: 0,
        created_at: new Date().toISOString(),
      };
    }

    const template = templateByPosition.get(assignments.findIndex((item) => item.day === day) + 1);

    return {
      id: uuidv4(),
      user_id: userId,
      weekly_plan_id: weeklyPlanId,
      session_type: assignment.sessionType,
      scheduled_date: scheduledDate,
      day_of_week: getDayOfWeek(scheduledDate),
      status: 'upcoming',
      planned_exercise_ids: template?.exercise_ids ?? [],
      points_earned: 0,
      created_at: new Date().toISOString(),
    };
  });
}

export function getExercisesForSessionType(sessionType: SessionType, pushIndex = 0, previousTrainingSession: SessionType | null = null): ProgramExerciseDefinition[] {
  if (sessionType === 'Push') {
    return getPushExerciseNames().map(getExerciseDefinition);
  }
  if (sessionType === 'Pull') {
    return getPullExerciseNames().map(getExerciseDefinition);
  }
  if (sessionType === 'UpperChest_Shoulders') {
    return getUpperChestShouldersExerciseNames().map(getExerciseDefinition);
  }
  if (sessionType === 'Full_Upper') {
    return getFullUpperExerciseNames().map(getExerciseDefinition);
  }
  if (sessionType === 'Abs_Arms') {
    return getAbsArmsExerciseNames().map(getExerciseDefinition);
  }
  if (sessionType === 'Abs') {
    return getAbsExerciseNames().map(getExerciseDefinition);
  }
  void pushIndex;
  void previousTrainingSession;
  return [];
}
