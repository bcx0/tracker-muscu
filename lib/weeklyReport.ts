import { getWeekId, getWeekStart } from '@/lib/dateUtils';
import { getMuscleGroupLabel } from '@/lib/program-generator';
import { supabase } from '@/lib/supabase';
import { Exercise, ExerciseLog, MuscleGroup, SetLog, WorkoutSession } from '@/types';

export interface WeeklyReportData {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  sessions: WorkoutSession[];
  exerciseLogs: ExerciseLog[];
  setLogs: SetLog[];
  exercises: Exercise[];
  setsByMuscle: Record<MuscleGroup, number>;
  pushSets: number;
  pullSets: number;
  completedSessions: number;
  plannedSessions: number;
  missedSessions: number;
  totalVolume: number;
  totalSets: number;
  totalEstimatedMinutes: number;
  neglectedMuscles: string[];
}

const EMPTY_SETS: Record<MuscleGroup, number> = {
  chest: 0,
  back: 0,
  legs: 0,
  shoulders: 0,
  biceps: 0,
  triceps: 0,
  arms: 0,
  abs: 0,
  other: 0,
};

export function getWeekWindowFromOffset(offset: number): { weekId: string; weekStart: string; weekEnd: string } {
  const today = new Date();
  const weekStartDate = getWeekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset * 7));
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return {
    weekId: getWeekId(weekStartDate),
    weekStart: weekStartDate.toISOString().slice(0, 10),
    weekEnd: weekEndDate.toISOString().slice(0, 10),
  };
}

export async function loadWeeklyReport(userId: string, offset = 0): Promise<WeeklyReportData> {
  const { weekId, weekStart, weekEnd } = getWeekWindowFromOffset(offset);

  const { data: planRow } = await supabase.from('weekly_plans').select('*').eq('user_id', userId).eq('week_id', weekId).maybeSingle();
  const weeklyPlanId = (planRow as { id?: string } | null)?.id;

  const { data: sessionRows } = weeklyPlanId
    ? await supabase.from('workout_sessions').select('*').eq('weekly_plan_id', weeklyPlanId).order('scheduled_date', { ascending: true })
    : { data: [] as WorkoutSession[] };

  const sessions = (sessionRows ?? []) as WorkoutSession[];
  const sessionIds = sessions.map((session: WorkoutSession) => session.id);
  const { data: exerciseLogRows } = sessionIds.length > 0
    ? await supabase.from('exercise_logs').select('*').in('session_id', sessionIds)
    : { data: [] as ExerciseLog[] };
  const exerciseLogs = (exerciseLogRows ?? []) as ExerciseLog[];

  const exerciseLogIds = exerciseLogs.map((log: ExerciseLog) => log.id);
  const { data: setLogRows } = exerciseLogIds.length > 0
    ? await supabase.from('set_logs').select('*').in('exercise_log_id', exerciseLogIds)
    : { data: [] as SetLog[] };
  const setLogs = (setLogRows ?? []) as SetLog[];

  const exerciseIds = Array.from(new Set(exerciseLogs.map((log: ExerciseLog) => log.exercise_id)));
  const { data: exerciseRows } = exerciseIds.length > 0
    ? await supabase.from('exercises').select('*').in('id', exerciseIds)
    : { data: [] as Exercise[] };
  const exercises = (exerciseRows ?? []) as Exercise[];
  const exerciseMap = new Map(exercises.map((exercise: Exercise) => [exercise.id, exercise]));
  const exerciseLogMap = new Map(exerciseLogs.map((log: ExerciseLog) => [log.id, log]));

  const setsByMuscle = { ...EMPTY_SETS };
  let pushSets = 0;
  let pullSets = 0;
  let totalVolume = 0;
  let totalSets = 0;

  setLogs.forEach((setLog: SetLog) => {
    if (!setLog.completed) {
      return;
    }

    const exerciseLog = exerciseLogMap.get(setLog.exercise_log_id);
    const exercise = exerciseLog ? exerciseMap.get(exerciseLog.exercise_id) : null;
    if (!exercise) {
      return;
    }

    setsByMuscle[exercise.muscle_group] += 1;
    totalSets += 1;
    totalVolume += Number(setLog.weight) * setLog.reps;

    if (exercise.muscle_group === 'chest' || exercise.muscle_group === 'shoulders' || exercise.muscle_group === 'triceps' || exercise.name.toLowerCase().includes('triceps')) {
      pushSets += 1;
    }

    if (
      exercise.muscle_group === 'back' ||
      exercise.muscle_group === 'biceps' ||
      exercise.name.toLowerCase().includes('rowing') ||
      exercise.name.toLowerCase().includes('traction') ||
      exercise.name.toLowerCase().includes('biceps') ||
      exercise.name.toLowerCase().includes('curl')
    ) {
      pullSets += 1;
    }
  });

  const completedSessions = sessions.filter((session: WorkoutSession) => session.status === 'done' || session.status === 'partial').length;
  const plannedSessions = sessions.filter((session: WorkoutSession) => session.status !== 'rest').length;
  const missedSessions = sessions.filter((session: WorkoutSession) => session.status === 'abandoned').length;
  const totalEstimatedMinutes = totalSets * 3;
  const neglectedMuscles = (Object.keys(setsByMuscle) as MuscleGroup[])
    .filter((muscle: MuscleGroup) => !['other', 'legs', 'arms'].includes(muscle) && setsByMuscle[muscle] === 0)
    .map((muscle: MuscleGroup) => getMuscleGroupLabel(muscle));

  return {
    weekId,
    weekStart,
    weekEnd,
    sessions,
    exerciseLogs,
    setLogs,
    exercises,
    setsByMuscle,
    pushSets,
    pullSets,
    completedSessions,
    plannedSessions,
    missedSessions,
    totalVolume,
    totalSets,
    totalEstimatedMinutes,
    neglectedMuscles,
  };
}
