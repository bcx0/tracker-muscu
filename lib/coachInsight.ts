import { computeOptimization } from '@/lib/optimization';
import { VOLUME_TARGETS } from '@/lib/volumeTargets';
import { Exercise, ExerciseLog, MuscleGroup, MuscleVolumeCache } from '@/types';

export interface CoachInsight {
  message: string;
  type: 'plateau' | 'increase' | 'volume' | 'default';
  exercise_name?: string;
  muscle_group?: MuscleGroup;
}

const PRIORITY_MUSCLES: MuscleGroup[] = ['chest', 'shoulders', 'abs'];
const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pectoraux',
  shoulders: 'Épaules',
  abs: 'Abdominaux',
  back: 'Dos',
  biceps: 'Biceps',
  triceps: 'Triceps',
  arms: 'Bras',
  legs: 'Jambes',
  other: 'Autres',
};

export function getTopCoachInsight(
  exercises: Exercise[],
  recent_logs: ExerciseLog[],
  volume_cache: MuscleVolumeCache[],
): CoachInsight {
  for (const exercise of exercises) {
    const logs = recent_logs
      .filter((log: ExerciseLog) => log.exercise_id === exercise.id)
      .sort((a: ExerciseLog, b: ExerciseLog) => a.logged_at.localeCompare(b.logged_at))
      .slice(-3);

    if (logs.length === 0) {
      continue;
    }

    const optimization = computeOptimization(exercise, logs);
    if (optimization.is_plateau) {
      return {
        message: `⚠️ ${exercise.name} - Déload -5% suggéré`,
        type: 'plateau',
        exercise_name: exercise.name,
      };
    }
  }

  for (const exercise of exercises) {
    if (!PRIORITY_MUSCLES.includes(exercise.muscle_group)) {
      continue;
    }

    const logs = recent_logs
      .filter((log: ExerciseLog) => log.exercise_id === exercise.id)
      .sort((a: ExerciseLog, b: ExerciseLog) => a.logged_at.localeCompare(b.logged_at))
      .slice(-3);

    if (logs.length === 0) {
      continue;
    }

    const optimization = computeOptimization(exercise, logs);
    if (optimization.suggested_weight > exercise.last_weight) {
      return {
        message: `🚀 ${exercise.name} - Passe à ${optimization.suggested_weight}kg la prochaine fois`,
        type: 'increase',
        exercise_name: exercise.name,
      };
    }
  }

  for (const muscle of PRIORITY_MUSCLES) {
    const cache = volume_cache.find((entry: MuscleVolumeCache) => entry.muscle_group === muscle);
    const current = cache?.total_sets ?? 0;
    if (current < VOLUME_TARGETS[muscle].min) {
      return {
        message: `📊 ${MUSCLE_LABELS[muscle]} sous la cible cette semaine`,
        type: 'volume',
        muscle_group: muscle,
      };
    }
  }

  return {
    message: 'Continue comme ça 💪',
    type: 'default',
  };
}
