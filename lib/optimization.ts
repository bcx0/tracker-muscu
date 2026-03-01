import { Exercise, ExerciseLog } from '@/types';

export interface OptimizationResult {
  exercise_id: string;
  suggested_weight: number;
  suggested_reps: number;
  label: string;
  is_plateau: boolean;
  plateau_note?: string;
}

export function roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function computeOptimization(exercise: Exercise, recent_logs: ExerciseLog[]): OptimizationResult {
  if (recent_logs.length === 0) {
    return {
      exercise_id: exercise.id,
      suggested_weight: exercise.last_weight,
      suggested_reps: exercise.rep_range_min,
      label: 'Première séance - base établie',
      is_plateau: false,
    };
  }

  const lastLog = recent_logs[recent_logs.length - 1];
  const hasPlateau =
    recent_logs.length === 3 &&
    recent_logs.every((log: ExerciseLog) => log.performed_weight === lastLog.performed_weight) &&
    recent_logs.every((log: ExerciseLog) => log.performed_reps < exercise.rep_range_max);

  if (hasPlateau) {
    const suggestedWeight = roundToNearestHalf(lastLog.performed_weight * 0.95);
    return {
      exercise_id: exercise.id,
      suggested_weight: suggestedWeight,
      suggested_reps: lastLog.performed_reps,
      label: 'Plateau - déload -5% suggéré',
      is_plateau: true,
      plateau_note: 'Déload conseillé avant de repartir sur une progression propre.',
    };
  }

  if (lastLog.performed_reps >= exercise.rep_range_max && lastLog.rir >= 1) {
    const suggestedWeight = lastLog.performed_weight + 2.5;
    return {
      exercise_id: exercise.id,
      suggested_weight: suggestedWeight,
      suggested_reps: exercise.rep_range_min,
      label: `Augmenter à ${suggestedWeight}kg`,
      is_plateau: false,
    };
  }

  if (lastLog.performed_reps >= exercise.rep_range_min) {
    const suggestedReps = lastLog.performed_reps + 1;
    return {
      exercise_id: exercise.id,
      suggested_weight: lastLog.performed_weight,
      suggested_reps: suggestedReps,
      label: `Ajouter 1 rep (${suggestedReps} reps)`,
      is_plateau: false,
    };
  }

  return {
    exercise_id: exercise.id,
    suggested_weight: lastLog.performed_weight,
    suggested_reps: lastLog.performed_reps,
    label: `Maintenir ${lastLog.performed_weight}kg`,
    is_plateau: false,
  };
}
