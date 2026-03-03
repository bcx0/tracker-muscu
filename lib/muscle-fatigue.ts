const SECONDARY_MUSCLES: Record<string, string[]> = {
  'Rowing haltère': ['biceps'],
  'Tirage vertical élastique': ['biceps'],
  'Tirage horizontal élastique': ['biceps'],
  'Développé couché haltères': ['triceps', 'shoulders'],
  'Développé incliné haltères': ['triceps', 'shoulders'],
  Dips: ['triceps'],
};

const PRIMARY_MUSCLES: Record<string, string> = {
  'Développé couché haltères': 'chest',
  'Développé incliné haltères': 'chest',
  Dips: 'chest',
  'Écarté élastique': 'chest',
  'Extension triceps haltère overhead': 'triceps',
  'Rowing haltère': 'back',
  'Tirage vertical élastique': 'back',
  'Tirage horizontal élastique': 'back',
  'Curl marteau': 'biceps',
  'Curl incliné haltère': 'biceps',
  'Élévations latérales': 'shoulders',
  'Oiseau haltères': 'shoulders',
  'Rotation externe élastique': 'shoulders',
  'Tirage poulie haute triceps élastique': 'triceps',
  'Relevé de jambes banc incliné': 'abs',
  'Crunch élastique': 'abs',
  Planche: 'abs',
};

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  triceps: 'Triceps',
  biceps: 'Biceps',
  abs: 'Abdos',
};

export function getFatigueWarning(exerciseName: string, previousExercisesInSession: string[]): string | null {
  const primaryMuscle = PRIMARY_MUSCLES[exerciseName];

  if (!primaryMuscle) {
    return null;
  }

  const triggeringExercise = previousExercisesInSession.find((previousExerciseName: string) =>
    (SECONDARY_MUSCLES[previousExerciseName] ?? []).includes(primaryMuscle),
  );

  if (!triggeringExercise) {
    return null;
  }

  const muscleLabel = MUSCLE_LABELS[primaryMuscle] ?? primaryMuscle;
  const shortExerciseName = triggeringExercise.replace(' haltères', '').replace(' élastique', '');

  return `⚠️ ${muscleLabel} déjà sollicités par le ${shortExerciseName} — réduis de 10-15%`;
}
