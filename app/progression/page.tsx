'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import Container from '@/components/ui/Container';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { getTodayISO, getWeekStart } from '@/lib/dateUtils';
import { ProgressiveOverloadAnalysis, analyzeExerciseProgress } from '@/lib/progressive-overload';
import { getMuscleGroupLabel } from '@/lib/program-generator';
import { getUser, supabase } from '@/lib/supabase';
import { Exercise, ExerciseLog, UserSettings, WorkoutSession } from '@/types';

interface ProgressState {
  exercises: Exercise[];
  logs: ExerciseLog[];
  recentLogs: ExerciseLog[];
  settings: UserSettings | null;
  sessions: WorkoutSession[];
}

const MUSCLE_CHART_CONFIG = [
  { key: 'chest', label: 'Pecs', color: '#ef4444' },
  { key: 'back', label: 'Dos', color: '#3b82f6' },
  { key: 'shoulders', label: 'Épaules', color: '#a855f7' },
  { key: 'biceps', label: 'Biceps', color: '#f59e0b' },
  { key: 'triceps', label: 'Triceps', color: '#f97316' },
  { key: 'abs', label: 'Abdos', color: '#d97706' },
] as const;

function normalizeMuscleKey(exercise: Exercise | undefined): (typeof MUSCLE_CHART_CONFIG)[number]['key'] | null {
  if (!exercise) {
    return null;
  }

  if (exercise.muscle_group === 'arms') {
    return getMuscleGroupLabel(exercise.muscle_group, exercise.name) === 'Triceps' ? 'triceps' : 'biceps';
  }

  if (exercise.muscle_group === 'chest' || exercise.muscle_group === 'back' || exercise.muscle_group === 'shoulders' || exercise.muscle_group === 'biceps' || exercise.muscle_group === 'triceps' || exercise.muscle_group === 'abs') {
    return exercise.muscle_group;
  }

  return null;
}

export default function ProgressionPage(): JSX.Element {
  const [state, setState] = useState<ProgressState>({ exercises: [], logs: [], recentLogs: [], settings: null, sessions: [] });
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [analysis, setAnalysis] = useState<ProgressiveOverloadAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const todayIso = getTodayISO();

  useEffect(() => {
    let active = true;

    async function loadProgression(): Promise<void> {
      const { data: userData } = await getUser();
      const user = userData.user;

      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const fourWeeksAgo = new Date(`${todayIso}T12:00:00`);
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 27);
      const fourWeeksAgoIso = fourWeeksAgo.toISOString();

      const [{ data: exerciseRows }, { data: logRows }, { data: recentLogRows }, { data: settingsRow }, { data: sessionRows }] = await Promise.all([
        supabase.from('exercises').select('*').eq('user_id', user.id).eq('is_active', true).order('name', { ascending: true }),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: true }),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).gte('logged_at', fourWeeksAgoIso).order('logged_at', { ascending: true }),
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('scheduled_date', { ascending: true }),
      ]);

      const exercises = (exerciseRows ?? []) as Exercise[];
      const logs = (logRows ?? []) as ExerciseLog[];
      const defaultExerciseId = exercises.find((exercise: Exercise) => logs.some((log: ExerciseLog) => log.exercise_id === exercise.id))?.id ?? '';

      if (active) {
        setState({
          exercises,
          logs,
          recentLogs: (recentLogRows ?? []) as ExerciseLog[],
          settings: (settingsRow ?? null) as UserSettings | null,
          sessions: (sessionRows ?? []) as WorkoutSession[],
        });
        setSelectedExerciseId(defaultExerciseId);
        setIsLoading(false);
      }
    }

    void loadProgression();
    return () => {
      active = false;
    };
  }, [todayIso]);

  useEffect(() => {
    let active = true;

    async function loadAnalysis(): Promise<void> {
      if (!selectedExerciseId) {
        if (active) {
          setAnalysis(null);
        }
        return;
      }

      const { data: userData } = await getUser();
      const user = userData.user;

      if (!user) {
        if (active) {
          setAnalysis(null);
        }
        return;
      }

      const nextAnalysis = await analyzeExerciseProgress(selectedExerciseId, user.id);
      if (active) {
        setAnalysis(nextAnalysis);
      }
    }

    void loadAnalysis();
    return () => {
      active = false;
    };
  }, [selectedExerciseId]);

  const selectedLogs = useMemo(
    () => state.logs.filter((log: ExerciseLog) => log.exercise_id === selectedExerciseId),
    [selectedExerciseId, state.logs],
  );
  const chartData = useMemo(
    () =>
      selectedLogs.map((log: ExerciseLog) => ({
        date: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(log.logged_at)),
        value: Number(log.e1rm.toFixed(1)),
      })),
    [selectedLogs],
  );
  const bestSet = useMemo(
    () =>
      selectedLogs.reduce<ExerciseLog | null>((best, current) => {
        if (!best || current.e1rm > best.e1rm) {
          return current;
        }
        return best;
      }, null),
    [selectedLogs],
  );
  const weekStart = getWeekStart(new Date(`${todayIso}T12:00:00`)).toISOString().slice(0, 10);
  const weeklyVolume = useMemo(() => {
    const weekSessionIds = state.sessions
      .filter((session: WorkoutSession) => session.scheduled_date >= weekStart && session.scheduled_date <= todayIso)
      .map((session: WorkoutSession) => session.id);

    return state.logs
      .filter((log: ExerciseLog) => weekSessionIds.includes(log.session_id))
      .reduce((sum: number, log: ExerciseLog) => sum + log.performed_weight * log.performed_reps * log.sets, 0);
  }, [state.logs, state.sessions, todayIso, weekStart]);
  const totalSessions = useMemo(
    () => new Set(state.logs.map((log: ExerciseLog) => log.session_id)).size,
    [state.logs],
  );
  const selectedExercise = state.exercises.find((exercise: Exercise) => exercise.id === selectedExerciseId) ?? null;
  const exerciseMap = useMemo(
    () => new Map(state.exercises.map((exercise: Exercise) => [exercise.id, exercise])),
    [state.exercises],
  );
  const muscleVolumeData = useMemo(() => {
    return MUSCLE_CHART_CONFIG.map((muscle) => ({
      muscle: muscle.label,
      totalSets: state.recentLogs.reduce((sum: number, log: ExerciseLog) => {
        const exercise = exerciseMap.get(log.exercise_id);
        return normalizeMuscleKey(exercise) === muscle.key ? sum + log.sets : sum;
      }, 0),
      color: muscle.color,
    }));
  }, [exerciseMap, state.recentLogs]);

  const analysisArrow = analysis?.trend === 'up' ? '↑' : analysis?.trend === 'down' ? '↓' : '→';
  const analysisLabel = analysis?.rule === 'A' ? 'Augmentation de poids' : analysis?.rule === 'B' ? 'Maintien' : analysis?.rule === 'C' ? 'Stagnation détectée' : "Pas d'historique";

  if (isLoading) {
    return (
      <Container className="space-y-4 pt-4">
        <div className="space-y-3">
          <SkeletonText width="38%" height={18} />
          <SkeletonText width="52%" />
        </div>
        <SkeletonCard height={280} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index: number) => (
            <SkeletonCard key={index} height={120} />
          ))}
        </div>
      </Container>
    );
  }

  if (state.logs.length === 0) {
    return (
      <Container className="pt-8">
        <EmptyState
          icon="📈"
          title="Aucune progression disponible"
          description="Termine quelques séances pour débloquer les graphiques et les statistiques."
        />
      </Container>
    );
  }

  return (
    <Container className="space-y-4 pt-6">
      <header className="space-y-1">
        <p className="text-3xl font-bold text-white">Progression</p>
        <p className="text-sm text-[#a1a1a1]">Suis l'évolution de tes performances exercice par exercice.</p>
      </header>

      <section className="flex gap-2 overflow-x-auto pb-1">
        {state.exercises.map((exercise: Exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => setSelectedExerciseId(exercise.id)}
            className={[
              'whitespace-nowrap rounded-full border px-4 py-2 text-sm',
              selectedExerciseId === exercise.id ? 'border-white bg-white text-black' : 'border-[#2a2a2a] bg-[#141414] text-[#a1a1a1]',
            ].join(' ')}
          >
            {exercise.name}
          </button>
        ))}
      </section>

      <section className="surface-card space-y-4 p-4">
        <div>
          <p className="text-lg font-bold text-white">{selectedExercise?.name ?? 'Exercice'}</p>
          <p className="text-sm text-[#a1a1a1]">Courbe e1RM</p>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#a1a1a1" />
              <YAxis tickLine={false} axisLine={false} stroke="#a1a1a1" width={40} />
              <Tooltip
                contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', color: '#ffffff', borderRadius: 16 }}
                labelStyle={{ color: '#a1a1a1' }}
              />
              <Line type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={3} dot={{ r: 3, fill: '#ffffff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {bestSet ? (
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-4">
            <p className="text-sm text-[#a1a1a1]">Meilleure série</p>
            <p className="text-xl font-bold text-white">
              {bestSet.performed_weight} kg × {bestSet.performed_reps}
            </p>
            <p className="text-sm text-[#a1a1a1]">
              Le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(bestSet.logged_at))}
            </p>
          </div>
        ) : null}
        {analysis ? (
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-4">
            <p className="text-sm font-medium text-white">Analyse</p>
            <p className="mt-2 text-lg font-bold text-white">
              {analysisArrow} {analysisLabel}
            </p>
            <p className="mt-2 text-sm text-[#a1a1a1]">{analysis.message}</p>
            <p className="mt-3 text-sm text-[#a1a1a1]">Depuis {analysis.weeksAtWeight} semaine(s) à ce poids</p>
          </div>
        ) : null}
      </section>

      <section className="surface-card space-y-4 p-4">
        <div>
          <p className="text-lg font-bold text-white">Volume par muscle (4 dernières semaines)</p>
          <p className="text-sm text-[#a1a1a1]">Nombre total de séries par groupe musculaire.</p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={muscleVolumeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="muscle" tickLine={false} axisLine={false} stroke="#a1a1a1" />
              <YAxis tickLine={false} axisLine={false} stroke="#a1a1a1" width={36} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: '#141414' }}
                contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', color: '#ffffff', borderRadius: 16 }}
                labelStyle={{ color: '#a1a1a1' }}
              />
              <Bar dataKey="totalSets" radius={[10, 10, 0, 0]}>
                {muscleVolumeData.map((entry) => (
                  <Cell key={entry.muscle} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="surface-card p-4">
          <p className="text-sm text-[#a1a1a1]">Total séances</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalSessions}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm text-[#a1a1a1]">Volume cette semaine</p>
          <p className="mt-2 text-2xl font-bold text-white">{Math.round(weeklyVolume)} kg</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm text-[#a1a1a1]">Streak actuel</p>
          <p className="mt-2 text-2xl font-bold text-white">{state.settings?.current_streak ?? 0} semaines</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-sm text-[#a1a1a1]">Meilleur e1RM</p>
          <p className="mt-2 text-2xl font-bold text-white">{bestSet ? `${bestSet.e1rm.toFixed(1)} kg` : '0 kg'}</p>
        </div>
      </section>
    </Container>
  );
}
