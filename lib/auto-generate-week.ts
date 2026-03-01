import { SupabaseClient } from '@supabase/supabase-js';

import { getWeekStart } from '@/lib/dateUtils';
import { buildWeeklySessions, normalizeTrainingDays } from '@/lib/program-generator';
import { UserSettings, WorkoutSession, WorkoutTemplate } from '@/types';

export async function ensureWeekExists(
  supabase: SupabaseClient,
  userId: string,
  weekStart: string,
  weekId: string,
): Promise<WorkoutSession[]> {
  const { data: existingPlan } = await supabase.from('weekly_plans').select('id').eq('user_id', userId).eq('week_id', weekId).maybeSingle();

  if (existingPlan?.id) {
    const { data: sessionRows } = await supabase.from('workout_sessions').select('*').eq('weekly_plan_id', existingPlan.id).order('scheduled_date', { ascending: true });
    return (sessionRows ?? []) as WorkoutSession[];
  }

  const currentMondayIso = getWeekStart(new Date()).toISOString().slice(0, 10);
  if (weekStart < currentMondayIso) {
    return [];
  }

  const [{ data: settingsRow }, { data: templateRows }] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('workout_templates').select('*').eq('user_id', userId).order('day_position', { ascending: true }),
  ]);

  const settings = (settingsRow ?? null) as UserSettings | null;
  const templates = (templateRows ?? []) as WorkoutTemplate[];

  if (!settings || templates.length === 0) {
    return [];
  }

  const normalizedDays = normalizeTrainingDays((settings.training_days as string[]) ?? []);
  if (normalizedDays.length === 0) {
    return [];
  }

  const { data: insertedPlan, error: planError } = await supabase
    .from('weekly_plans')
    .insert({
      user_id: userId,
      week_start: weekStart,
      week_id: weekId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (planError || !insertedPlan) {
    throw new Error(planError?.message ?? 'Impossible de créer la semaine.');
  }

  const sessions = buildWeeklySessions(userId, (insertedPlan as { id: string }).id, weekStart, normalizedDays, settings.sessions_per_week, templates);
  const { data: insertedSessions, error: sessionError } = await supabase.from('workout_sessions').insert(sessions).select();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  return (insertedSessions ?? sessions) as WorkoutSession[];
}
