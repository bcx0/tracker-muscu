'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Play, Trophy } from 'lucide-react';

import Container from '@/components/ui/Container';
import EmptyState from '@/components/ui/EmptyState';
import PrimaryButton from '@/components/ui/PrimaryButton';
import Skeleton, { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { formatDayLabel, formatLongDate, getTodayISO, getWeekStart } from '@/lib/dateUtils';
import { getMuscleGroupLabel, SESSION_LABELS } from '@/lib/program-generator';
import { getUser, supabase } from '@/lib/supabase';
import { loadWeeklyReport } from '@/lib/weeklyReport';
import { Exercise, ExerciseLog, PersonalRecord, UserSettings, WorkoutSession } from '@/types';

interface DashboardState {
  settings: UserSettings | null;
  todaySession: WorkoutSession | null;
  weekSessions: WorkoutSession[];
  weekLogs: ExerciseLog[];
  exercises: Exercise[];
  lastRecord: PersonalRecord | null;
  pushSets: number;
  pullSets: number;
}

const MUSCLE_GROUPS = [
  { key: 'chest', label: 'Pectoraux', color: '#ef4444' },
  { key: 'back', label: 'Dos', color: '#3b82f6' },
  { key: 'shoulders', label: 'Épaules', color: '#a855f7' },
  { key: 'biceps', label: 'Biceps', color: '#f59e0b' },
  { key: 'triceps', label: 'Triceps', color: '#f97316' },
  { key: 'abs', label: 'Abdominaux', color: '#d97706' },
] as const;

function getAccent(sessionType?: WorkoutSession['session_type'] | 'rest'): string {
  switch (sessionType) {
    case 'Push':
    case 'Push_A':
      return 'from-[#ef4444] to-[#dc2626]';
    case 'Pull':
    case 'Pull_B':
      return 'from-[#3b82f6] to-[#2563eb]';
    case 'Abs':
    case 'Abs_Arms':
      return 'from-[#f59e0b] to-[#d97706]';
    case 'UpperChest_Shoulders':
    case 'Full_Upper':
      return 'from-[#a855f7] to-[#9333ea]';
    default:
      return 'from-[#1c1c1c] to-[#1c1c1c]';
  }
}

function normalizeMuscleKey(exercise: Exercise | undefined): (typeof MUSCLE_GROUPS)[number]['key'] | null {
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

function getWeekDotStyle(session: WorkoutSession | null, todayIso: string, iso: string): string {
  const isToday = iso === todayIso;
  const highlight = isToday ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-[#141414]' : '';

  if (!session) {
    return `border border-white/50 bg-transparent ${highlight}`.trim();
  }

  if (session.status === 'rest') {
    return `bg-[#555555] ${highlight}`.trim();
  }

  if (session.status === 'done' || session.status === 'partial') {
    return `bg-emerald-500 ${highlight}`.trim();
  }

  if (session.scheduled_date < todayIso) {
    return `bg-red-500 ${highlight}`.trim();
  }

  return `border border-white/50 bg-transparent ${highlight}`.trim();
}

export default function TodayPage(): JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    settings: null,
    todaySession: null,
    weekSessions: [],
    weekLogs: [],
    exercises: [],
    lastRecord: null,
    pushSets: 0,
    pullSets: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [warningDismissed, setWarningDismissed] = useState<boolean>(false);
  const todayIso = getTodayISO();

  useEffect(() => {
    let active = true;

    async function loadDashboard(): Promise<void> {
      const { data: userData } = await getUser();
      const user = userData.user;

      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const weekStart = getWeekStart(new Date(`${todayIso}T12:00:00`));
      const weekDates = Array.from({ length: 7 }).map((_, index: number) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + index);
        return date.toISOString().slice(0, 10);
      });

      const [{ data: settingsRow }, { data: sessionRows }, { data: exerciseRows }, { data: recordRows }, weeklyReport] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('workout_sessions').select('*').eq('user_id', user.id).in('scheduled_date', weekDates).order('scheduled_date', { ascending: true }),
        supabase.from('exercises').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }).limit(1),
        loadWeeklyReport(user.id, 0),
      ]);

      const sessions = (sessionRows ?? []) as WorkoutSession[];
      const todaySession = sessions.find((session: WorkoutSession) => session.scheduled_date === todayIso) ?? null;
      const sessionIds = sessions.map((session: WorkoutSession) => session.id);
      const { data: logRows } = sessionIds.length > 0 ? await supabase.from('exercise_logs').select('*').in('session_id', sessionIds) : { data: [] as ExerciseLog[] };

      if (active) {
        setState({
          settings: (settingsRow ?? null) as UserSettings | null,
          todaySession,
          weekSessions: sessions,
          weekLogs: (logRows ?? []) as ExerciseLog[],
          exercises: (exerciseRows ?? []) as Exercise[],
          lastRecord: (((recordRows ?? []) as PersonalRecord[])[0] ?? null) as PersonalRecord | null,
          pushSets: weeklyReport.pushSets,
          pullSets: weeklyReport.pullSets,
        });
        setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [todayIso]);

  const exerciseMap = useMemo(() => new Map(state.exercises.map((exercise: Exercise) => [exercise.id, exercise])), [state.exercises]);
  const weeklyBars = useMemo(() => {
    const weekStart = getWeekStart(new Date(`${todayIso}T12:00:00`));
    return Array.from({ length: 7 }).map((_, index: number) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const iso = date.toISOString().slice(0, 10);
      const sessionIds = state.weekSessions.filter((session: WorkoutSession) => session.scheduled_date === iso).map((session: WorkoutSession) => session.id);
      const setCount = state.weekLogs.filter((log: ExerciseLog) => sessionIds.includes(log.session_id)).reduce((sum: number, log: ExerciseLog) => sum + log.sets, 0);

      return {
        iso,
        label: formatDayLabel(iso),
        setCount,
        isToday: iso === todayIso,
      };
    });
  }, [state.weekLogs, state.weekSessions, todayIso]);

  const maxBarValue = Math.max(1, ...weeklyBars.map((item) => item.setCount));
  const weekDots = useMemo(() => {
    const weekStart = getWeekStart(new Date(`${todayIso}T12:00:00`));
    return Array.from({ length: 7 }).map((_, index: number) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      const iso = date.toISOString().slice(0, 10);

      return {
        iso,
        label: formatDayLabel(iso),
        session: state.weekSessions.find((session: WorkoutSession) => session.scheduled_date === iso) ?? null,
      };
    });
  }, [state.weekSessions, todayIso]);
  const heatmapValues = useMemo(() => {
    return MUSCLE_GROUPS.map((group) => {
      const sets = state.weekLogs.reduce((sum: number, log: ExerciseLog) => {
        const exercise = exerciseMap.get(log.exercise_id);
        return normalizeMuscleKey(exercise) === group.key ? sum + log.sets : sum;
      }, 0);

      let backgroundColor = '#1c1c1c';
      if (sets >= 7) backgroundColor = group.color;
      else if (sets >= 4) backgroundColor = `${group.color}b3`;
      else if (sets >= 1) backgroundColor = `${group.color}4d`;

      return { ...group, sets, backgroundColor };
    });
  }, [exerciseMap, state.weekLogs]);

  const lastRecordExercise = state.lastRecord ? exerciseMap.get(state.lastRecord.exercise_id) : null;
  const showBalanceWarning = !warningDismissed && state.pushSets > state.pullSets * 1.3 && state.pushSets > 0;

  if (isLoading) {
    return (
      <Container className="space-y-4 pt-4">
        <SkeletonCard height={104} />
        <SkeletonCard height={168} />
        <div className="surface-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <SkeletonText width="30%" />
            <SkeletonText width="24%" />
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, index: number) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton height={96} borderRadius="16px" />
                <SkeletonText width={20} />
              </div>
            ))}
          </div>
        </div>
      </Container>
    );
  }

  if (!state.settings?.setup_complete && !state.todaySession) {
    return (
      <Container className="pt-8">
        <EmptyState
          icon="🏁"
          title="Programme non configuré"
          description="Configure tes jours d'entraînement et génère ton programme pour démarrer."
          action={{ label: 'Ouvrir les réglages', onClick: () => router.push('/settings') }}
        />
      </Container>
    );
  }

  return (
    <Container className="space-y-4 pt-6">
      <header className="space-y-1">
        <p className="text-3xl font-bold text-white">Bonjour 👋</p>
        <p className="text-sm text-[#a1a1a1]">{formatLongDate(todayIso)}</p>
      </header>

      <section className="rounded-[24px] border border-[#2a2a2a] bg-gradient-to-r from-[#ef4444] to-[#dc2626] p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/15 p-3">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-white/80">Streak</p>
            <p className="text-2xl font-bold">{state.settings?.current_streak ?? 0} semaines consécutives</p>
          </div>
        </div>
      </section>

      <section className={`rounded-[24px] border border-[#2a2a2a] bg-gradient-to-r p-5 ${getAccent(state.todaySession?.status === 'rest' ? 'rest' : state.todaySession?.session_type)}`}>
        {state.todaySession && state.todaySession.status !== 'rest' ? (
          <div className="space-y-4 text-white">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">Aujourd'hui</p>
              <p className="session-tracking text-3xl font-bold">{SESSION_LABELS[state.todaySession.session_type]}</p>
            </div>
            <PrimaryButton fullWidth className="bg-white text-black" onClick={() => router.push(`/session/${state.todaySession?.id ?? ''}`)}>
              <span className="inline-flex items-center gap-2">
                <Play size={16} />
                Commencer la séance
              </span>
            </PrimaryButton>
          </div>
        ) : (
          <div className="space-y-2 text-white">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">Aujourd'hui</p>
            <p className="text-2xl font-bold">Repos aujourd'hui 😴</p>
            <p className="text-sm text-white/75">Récupère bien et reviens plus fort demain.</p>
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Cette semaine</p>
          <p className="text-xs text-[#a1a1a1]">Vue rapide</p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDots.map((item) => (
            <div key={item.iso} className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#141414]">
                <span className={`h-3.5 w-3.5 rounded-full ${getWeekDotStyle(item.session, todayIso, item.iso)}`} />
              </div>
              <span className={`text-[11px] ${item.iso === todayIso ? 'text-white' : 'text-[#a1a1a1]'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Séries cette semaine</p>
          <p className="text-xs text-[#a1a1a1]">Séries réalisées</p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weeklyBars.map((item) => (
            <div key={item.iso} className="flex flex-col items-center gap-2">
              <div className={`flex h-24 w-full items-end rounded-2xl border ${item.isToday ? 'border-white' : 'border-[#2a2a2a]'} bg-[#1c1c1c] p-1`}>
                <div
                  className={`w-full rounded-xl bg-gradient-to-t ${item.isToday ? 'from-white to-[#a1a1a1]' : 'from-[#3b82f6] to-[#2563eb]'}`}
                  style={{ height: `${Math.max(8, (item.setCount / maxBarValue) * 100)}%` }}
                />
              </div>
              <span className={`text-[11px] ${item.isToday ? 'text-white' : 'text-[#a1a1a1]'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
            <Trophy size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Dernier PR 🏆</p>
            {state.lastRecord && lastRecordExercise ? (
              <p className="text-sm text-[#a1a1a1]">
                {lastRecordExercise.name} : {state.lastRecord.best_weight}kg × {state.lastRecord.best_reps}
              </p>
            ) : (
              <p className="text-sm text-[#a1a1a1]">Aucun record enregistré pour le moment.</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface-card space-y-4 p-4">
        <p className="text-sm font-medium text-white">Heatmap musculaire</p>
        <div className="grid grid-cols-2 gap-3">
          {heatmapValues.map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3">
              <div className="mb-3 rounded-full px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: item.backgroundColor }}>
                {item.label}
              </div>
              <p className="text-xs text-[#a1a1a1]">{item.sets} séries</p>
            </div>
          ))}
        </div>
      </section>

      {showBalanceWarning ? (
        <section className="relative rounded-[24px] border border-[#f59e0b] bg-[#1a1200] p-4">
          <button type="button" onClick={() => setWarningDismissed(true)} className="absolute right-3 top-3 text-sm text-[#a1a1a1]">
            Fermer
          </button>
          <p className="mb-2 text-sm font-bold text-amber-300">⚠️ Balance musculaire</p>
          <p className="pr-12 text-sm text-[#f6d28b]">
            Tu as fait {state.pushSets} séries Push pour {state.pullSets} séries Pull cette semaine. Pense à ajouter du rowing ou des tractions.
          </p>
        </section>
      ) : null}
    </Container>
  );
}
