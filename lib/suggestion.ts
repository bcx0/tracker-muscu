import { ExerciseLog, SetLog } from '@/types';

export function suggestWeightFromHistory(lastWeight: number, recentExerciseLogs: ExerciseLog[], recentSetLogs: SetLog[], repMax?: number): number {
  if (recentExerciseLogs.length === 0) {
    return 0;
  }

  const sortedLogs = [...recentExerciseLogs].sort((a: ExerciseLog, b: ExerciseLog) => a.logged_at.localeCompare(b.logged_at));
  const lastExerciseLog = sortedLogs[sortedLogs.length - 1];
  const targetRepMax = repMax ?? lastExerciseLog.performed_reps;
  const lastSessionSets = recentSetLogs
    .filter((setLog: SetLog) => setLog.exercise_log_id === lastExerciseLog.id)
    .sort((a: SetLog, b: SetLog) => a.set_number - b.set_number);

  if (lastSessionSets.length === 0) {
    return lastWeight;
  }

  const allSetsCompletedAtRepMax = lastSessionSets.every((setLog: SetLog) => setLog.completed && setLog.reps >= targetRepMax);
  const failedAnySet = lastSessionSets.some((setLog: SetLog) => !setLog.completed);

  if (allSetsCompletedAtRepMax) {
    return Number((lastWeight + 2.5).toFixed(2));
  }

  if (failedAnySet) {
    return lastWeight;
  }

  return lastWeight;
}
