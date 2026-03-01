import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getWeekId, getWeekStart, getTodayISO } from '@/lib/dateUtils';
import { buildExerciseRowsForUser, buildWeeklySessions, buildWorkoutTemplates, normalizeTrainingDays } from '@/lib/program-generator';
import { Exercise, UserSettings, WeeklyPlan } from '@/types';

function createAuthedClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-placeholder';
  const authorization = request.headers.get('authorization') ?? '';

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createAuthedClient(request);
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
  }

  const userId = authData.user.id;
  const { data: settingsRow, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError || !settingsRow) {
    return NextResponse.json({ error: settingsError?.message ?? 'Paramètres introuvables' }, { status: 400 });
  }

  const settings = settingsRow as UserSettings;
  const rawTrainingDays = (settings.training_days as string[]) ?? [];
  const normalizedDays = normalizeTrainingDays(rawTrainingDays);
  const sessionsPerWeek = settings.sessions_per_week;

  console.info('[generate-program] training_days', {
    userId,
    rawTrainingDays,
    normalizedDays,
    sessionsPerWeek,
  });

  if (normalizedDays.length !== sessionsPerWeek) {
    return NextResponse.json({ error: 'Le nombre de jours ne correspond pas au nombre de séances.' }, { status: 400 });
  }

  const today = getTodayISO();
  const weekStartDate = getWeekStart(new Date());
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const weekId = getWeekId(weekStartDate);

  const { data: existingPlans, error: plansError } = await supabase.from('weekly_plans').select('id').eq('user_id', userId);
  if (plansError) {
    return NextResponse.json({ error: plansError.message }, { status: 400 });
  }

  const existingPlanIds = ((existingPlans ?? []) as WeeklyPlan[]).map((plan: WeeklyPlan) => plan.id);
  if (existingPlanIds.length > 0) {
    const { error: deleteSessionsError } = await supabase.from('workout_sessions').delete().in('weekly_plan_id', existingPlanIds);
    if (deleteSessionsError) {
      return NextResponse.json({ error: deleteSessionsError.message }, { status: 400 });
    }
  }

  const { error: deleteTemplatesError } = await supabase.from('workout_templates').delete().eq('user_id', userId);
  if (deleteTemplatesError) {
    return NextResponse.json({ error: deleteTemplatesError.message }, { status: 400 });
  }

  const { error: deletePlansError } = await supabase.from('weekly_plans').delete().eq('user_id', userId);
  if (deletePlansError) {
    return NextResponse.json({ error: deletePlansError.message }, { status: 400 });
  }

  const { error: deleteExercisesError } = await supabase.from('exercises').delete().eq('user_id', userId);
  if (deleteExercisesError) {
    return NextResponse.json({ error: deleteExercisesError.message }, { status: 400 });
  }

  const { data: insertedExercises, error: insertExercisesError } = await supabase.from('exercises').insert(buildExerciseRowsForUser(userId)).select();
  if (insertExercisesError) {
    return NextResponse.json({ error: insertExercisesError.message }, { status: 400 });
  }

  const exercises = (insertedExercises ?? []) as Exercise[];
  const freshTemplates = buildWorkoutTemplates(userId, normalizedDays, sessionsPerWeek, exercises);
  const { data: insertedTemplates, error: insertTemplatesError } = await supabase.from('workout_templates').insert(freshTemplates).select();
  if (insertTemplatesError) {
    return NextResponse.json({ error: insertTemplatesError.message }, { status: 400 });
  }

  const { data: insertedPlan, error: insertPlanError } = await supabase
    .from('weekly_plans')
    .insert({ user_id: userId, week_start: weekStart, week_id: weekId, created_at: new Date().toISOString() })
    .select()
    .single();

  if (insertPlanError) {
    return NextResponse.json({ error: insertPlanError.message }, { status: 400 });
  }

  const weeklyPlanId = (insertedPlan as { id: string }).id;
  const workoutTemplates = (insertedTemplates ?? []) as typeof freshTemplates;
  const sessions = buildWeeklySessions(userId, weeklyPlanId, weekStart, normalizedDays, sessionsPerWeek, workoutTemplates);

  const { error: insertSessionsError } = await supabase.from('workout_sessions').insert(sessions);
  if (insertSessionsError) {
    return NextResponse.json({ error: insertSessionsError.message }, { status: 400 });
  }

  const { error: updateSettingsError } = await supabase
    .from('user_settings')
    .update({ training_days: normalizedDays, sessions_per_week: sessionsPerWeek, setup_complete: true })
    .eq('user_id', userId);

  if (updateSettingsError) {
    return NextResponse.json({ error: updateSettingsError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, week_id: weekId, sessions_created: sessions.length, exercises_count: exercises.length });
}
