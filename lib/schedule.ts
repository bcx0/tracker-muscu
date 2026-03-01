import { getWeekId } from '@/lib/dateUtils';
import { assignSessionTypesToTrainingDays, buildWeeklySessions, DAY_ORDER } from '@/lib/program-generator';
import { DayOfWeek, WorkoutSession, WorkoutTemplate } from '@/types';

export function assignSessionTypes(training_days: DayOfWeek[], sessions_per_week: number): Map<DayOfWeek, WorkoutTemplate['session_type']> {
  return new Map(assignSessionTypesToTrainingDays(training_days, sessions_per_week).map((item) => [item.day, item.sessionType]));
}

export function generateWeeklyPlan(
  user_id: string,
  training_days: DayOfWeek[],
  week_start: string,
  templates: WorkoutTemplate[],
  sessions_per_week: number,
): WorkoutSession[] {
  return buildWeeklySessions(user_id, '', week_start, training_days, sessions_per_week, templates).map((session: WorkoutSession) => ({
    ...session,
    weekly_plan_id: '',
  }));
}

export function getCurrentWeekIdFromStart(week_start: string): string {
  return getWeekId(new Date(`${week_start}T12:00:00`));
}

export { DAY_ORDER };