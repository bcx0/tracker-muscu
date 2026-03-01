import { supabase } from '@/lib/supabase';
import { Exercise, ExerciseLog, SetLog } from '@/types';

export type ProgressiveOverloadRule = 'A' | 'B' | 'C' | 'D';
export type ProgressiveOverloadTrend = 'up' | 'flat' | 'down';

interface SessionSetSummary {
  log: ExerciseLog;
  sets: SetLog[];
  allAtRepMax: boolean;
  failedAtRepMin: boolean;
  reachedRepMax: boolean;
}

export interface ProgressiveOverloadAnalysis {
  rule: ProgressiveOverloadRule;
  trend: ProgressiveOverloadTrend;
  suggestedWeight: number;
  message: string;
  chipLabel: string;
  chipTone: 'green' | 'blue' | 'orange' | 'gray';
  currentWeight: number;
  weeksAtWeight: number;
}

function roundWeight(value: number): number {
  return Math.max(0, Number(value.toFixed(2)));
}

function buildSessionSummary(log: ExerciseLog, sets: SetLog[], exercise: Exercise): SessionSetSummary {
  const orderedSets = [...sets].sort((a: SetLog, b: SetLog) => a.set_number - b.set_number);
  const relevantSets = orderedSets.length > 0 ? orderedSets : [];

  const allAtRepMax = relevantSets.length > 0
    ? relevantSets.every((setLog: SetLog) => setLog.completed && setLog.reps >= exercise.rep_range_max)
    : log.performed_reps >= exercise.rep_range_max;

  const failedAtRepMin = relevantSets.length > 0
    ? relevantSets.some((setLog: SetLog) => !setLog.completed || setLog.reps < exercise.rep_range_min)
    : log.performed_reps < exercise.rep_range_min;

  const reachedRepMax = relevantSets.length > 0
    ? relevantSets.some((setLog: SetLog) => setLog.completed && setLog.reps >= exercise.rep_range_max)
    : log.performed_reps >= exercise.rep_range_max;

  return {
    log,
    sets: relevantSets,
    allAtRepMax,
    failedAtRepMin,
    reachedRepMax,
  };
}

function computeWeeksAtWeight(logs: ExerciseLog[], currentWeight: number): number {
  if (currentWeight <= 0) {
    return 0;
  }

  let streak = 0;

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    if (Number(logs[index].performed_weight) !== currentWeight) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export async function analyzeExerciseProgress(exerciseId: string, userId: string): Promise<ProgressiveOverloadAnalysis> {
  const { data: exerciseRow } = await supabase.from('exercises').select('*').eq('id', exerciseId).eq('user_id', userId).maybeSingle();
  const exercise = (exerciseRow ?? null) as Exercise | null;

  if (!exercise) {
    return {
      rule: 'D',
      trend: 'flat',
      suggestedWeight: 0,
      message: 'Première fois — choisis un poids avec lequel tu peux faire des répétitions propres.',
      chipLabel: 'Nouveau — commence léger',
      chipTone: 'gray',
      currentWeight: 0,
      weeksAtWeight: 0,
    };
  }

  const { data: logRows } = await supabase
    .from('exercise_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('logged_at', { ascending: false })
    .limit(3);

  const logs = ((logRows ?? []) as ExerciseLog[]).reverse();
  if (logs.length === 0) {
    return {
      rule: 'D',
      trend: 'flat',
      suggestedWeight: 0,
      message: `Première fois — choisis un poids avec lequel tu peux faire ${exercise.rep_range_min} reps proprement.`,
      chipLabel: 'Nouveau — commence léger',
      chipTone: 'gray',
      currentWeight: 0,
      weeksAtWeight: 0,
    };
  }

  const logIds = logs.map((log: ExerciseLog) => log.id);
  const { data: setLogRows } = await supabase.from('set_logs').select('*').in('exercise_log_id', logIds);
  const setLogs = (setLogRows ?? []) as SetLog[];

  const sessionSummaries = logs.map((log: ExerciseLog) =>
    buildSessionSummary(
      log,
      setLogs.filter((setLog: SetLog) => setLog.exercise_log_id === log.id),
      exercise,
    ),
  );

  const latestSession = sessionSummaries[sessionSummaries.length - 1];
  const currentWeight = roundWeight(Number(latestSession.log.performed_weight));
  const weeksAtWeight = computeWeeksAtWeight(logs, currentWeight);

  if (sessionSummaries.length >= 2 && sessionSummaries.slice(-2).every((summary: SessionSetSummary) => summary.allAtRepMax)) {
    const suggestedWeight = roundWeight(currentWeight + 2.5);
    return {
      rule: 'A',
      trend: 'up',
      suggestedWeight,
      message: `Tu es prêt à augmenter ! Essaie ${suggestedWeight} kg cette séance.`,
      chipLabel: `↑ Augmente à ${suggestedWeight}kg`,
      chipTone: 'green',
      currentWeight,
      weeksAtWeight,
    };
  }

  if (latestSession.failedAtRepMin) {
    return {
      rule: 'B',
      trend: 'flat',
      suggestedWeight: currentWeight,
      message: "Continue à ce poids jusqu'à maîtriser toutes les séries.",
      chipLabel: `= Maintiens ${currentWeight}kg`,
      chipTone: 'blue',
      currentWeight,
      weeksAtWeight,
    };
  }

  const sameWeightThreeSessions =
    sessionSummaries.length >= 3 &&
    sessionSummaries.every((summary: SessionSetSummary) => roundWeight(Number(summary.log.performed_weight)) === currentWeight);
  const neverReachedRepMax =
    sessionSummaries.length >= 3 &&
    sessionSummaries.every((summary: SessionSetSummary) => !summary.reachedRepMax);

  if (sameWeightThreeSessions && neverReachedRepMax) {
    const suggestedWeight = roundWeight(currentWeight * 0.9);
    return {
      rule: 'C',
      trend: 'down',
      suggestedWeight,
      message: `Stagnation détectée. Essaie un deload à ${suggestedWeight} kg pour relancer la progression.`,
      chipLabel: `↓ Deload à ${suggestedWeight}kg`,
      chipTone: 'orange',
      currentWeight,
      weeksAtWeight,
    };
  }

  return {
    rule: 'B',
    trend: 'flat',
    suggestedWeight: currentWeight,
    message: "Continue à ce poids jusqu'à maîtriser toutes les séries.",
    chipLabel: `= Maintiens ${currentWeight}kg`,
    chipTone: 'blue',
    currentWeight,
    weeksAtWeight,
  };
}
