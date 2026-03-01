'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Minus } from 'lucide-react';
import toast from 'react-hot-toast';

import { ensureWeekExists } from '@/lib/auto-generate-week';
import Container from '@/components/ui/Container';
import EmptyState from '@/components/ui/EmptyState';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { getTodayISO, getWeekId, getWeekStart } from '@/lib/dateUtils';
import { getFrenchDayLabel, normalizeTrainingDay, SESSION_LABELS } from '@/lib/program-generator';
import { getUser, supabase } from '@/lib/supabase';
import { DayOfWeek, Exercise, ExerciseLog, WorkoutSession } from '@/types';

interface WeekPageState {
  sessions: WorkoutSession[];
  exercises: Exercise[];
  logs: ExerciseLog[];
  hasTemplates: boolean;
  isPastWeekWithoutData: boolean;
}

interface DayCardData {
  session: WorkoutSession;
  dayLabel: string;
  dayNumber: string;
  isToday: boolean;
  isPast: boolean;
}

const DAY_RANGE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function formatRangeDay(date: string): string {
  return DAY_RANGE_FORMATTER.format(new Date(`${date}T12:00:00`)).replace('.', '');
}

function getWeekNavigationLabel(offset: number): string {
  if (offset === 0) {
    return 'Semaine en cours';
  }
  if (offset < 0) {
    return `Il y a ${Math.abs(offset)} semaine(s)`;
  }
  return `Dans ${offset} semaine(s)`;
}

function getCurrentMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function getInitialWeekStart(): string {
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('muscu_selected_week');
    if (saved) {
      return saved;
    }
  }

  return getCurrentMonday();
}

function shiftWeekStart(currentWeekStart: string, weeks: number): string {
  const monday = new Date(`${currentWeekStart}T12:00:00`);
  monday.setDate(monday.getDate() + weeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function getSessionPillClasses(sessionType: WorkoutSession['session_type'], isRest: boolean): string {
  if (isRest) {
    return 'bg-neutral-800 text-neutral-500';
  }

  switch (sessionType) {
    case 'Push':
    case 'Push_A':
      return 'bg-red-600 text-white';
    case 'Pull':
    case 'Pull_B':
      return 'bg-blue-600 text-white';
    case 'UpperChest_Shoulders':
      return 'bg-purple-600 text-white';
    case 'Full_Upper':
      return 'bg-orange-600 text-white';
    case 'Abs_Arms':
    case 'Abs':
      return 'bg-amber-600 text-white';
    default:
      return 'bg-neutral-800 text-neutral-400';
  }
}

function getSafeFrenchDayLabel(day: string): string {
  const normalized = normalizeTrainingDay(day);
  return normalized ? getFrenchDayLabel(normalized as DayOfWeek) ?? day : day;
}

function getStatusMarker(session: WorkoutSession): JSX.Element {
  switch (session.status) {
    case 'done':
      return (
        <div className="flex items-center gap-2 text-emerald-300">
          <Check size={14} />
          <span>Terminée</span>
        </div>
      );
    case 'partial':
      return (
        <div className="flex items-center gap-2 text-amber-300">
          <span className="text-sm leading-none">◐</span>
          <span>Partielle</span>
        </div>
      );
    case 'rest':
      return (
        <div className="flex items-center gap-2 text-[#555555]">
          <Minus size={14} />
          <span>Repos</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2 text-[#a1a1a1]">
          <span className="h-2 w-2 rounded-full bg-[#555555]" />
          <span>Prévue</span>
        </div>
      );
  }
}

export default function WeekPage(): JSX.Element {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<string>(getInitialWeekStart);
  const [state, setState] = useState<WeekPageState>({
    sessions: [],
    exercises: [],
    logs: [],
    hasTemplates: false,
    isPastWeekWithoutData: false,
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const todayIso = getTodayISO();

  const changeWeek = (newWeekStart: string): void => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('muscu_selected_week', newWeekStart);
    }
    setWeekStart(newWeekStart);
  };

  useEffect(() => {
    let active = true;

    async function loadWeek(): Promise<void> {
      const { data } = await getUser();
      const user = data.user;
      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const monday = new Date(`${weekStart}T12:00:00`);
      const weekId = getWeekId(monday);
      const currentMondayIso = getWeekStart(new Date()).toISOString().slice(0, 10);

      const [{ data: templateRows }, { data: existingPlan }] = await Promise.all([
        supabase.from('workout_templates').select('id').eq('user_id', user.id).order('day_position', { ascending: true }),
        supabase.from('weekly_plans').select('id').eq('user_id', user.id).eq('week_id', weekId).maybeSingle(),
      ]);

      const hasTemplates = (templateRows ?? []).length > 0;
      if (!hasTemplates) {
        if (active) {
          setState({ sessions: [], exercises: [], logs: [], hasTemplates: false, isPastWeekWithoutData: false });
          setSelectedSessionId('');
          setIsLoading(false);
        }
        return;
      }

      const shouldGenerate = !existingPlan?.id && weekStart >= currentMondayIso;
      const sessions = await ensureWeekExists(supabase, user.id, weekStart, weekId);
      const sessionIds = sessions.map((session: WorkoutSession) => session.id);
      const exerciseIds = Array.from(new Set(sessions.flatMap((session: WorkoutSession) => session.planned_exercise_ids)));

      const [{ data: exerciseRows }, { data: logRows }] = await Promise.all([
        exerciseIds.length > 0 ? supabase.from('exercises').select('*').in('id', exerciseIds) : Promise.resolve({ data: [] as Exercise[] }),
        sessionIds.length > 0 ? supabase.from('exercise_logs').select('*').in('session_id', sessionIds) : Promise.resolve({ data: [] as ExerciseLog[] }),
      ]);

      if (!active) {
        return;
      }

      if (shouldGenerate && sessions.length > 0) {
        toast.success('Nouvelle semaine générée ✅');
      }

      setState({
        sessions,
        exercises: (exerciseRows ?? []) as Exercise[],
        logs: (logRows ?? []) as ExerciseLog[],
        hasTemplates: true,
        isPastWeekWithoutData: sessions.length === 0 && weekStart < currentMondayIso,
      });

      const todaySession = sessions.find((session: WorkoutSession) => session.scheduled_date === todayIso);
      setSelectedSessionId(todaySession?.id ?? sessions[0]?.id ?? '');
      setIsLoading(false);
    }

    setIsLoading(true);
    void loadWeek();
    return () => {
      active = false;
    };
  }, [todayIso, weekStart]);

  const selectedSession = useMemo(
    () => state.sessions.find((session: WorkoutSession) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, state.sessions],
  );

  const exerciseMap = useMemo(
    () => new Map(state.exercises.map((exercise: Exercise) => [exercise.id, exercise])),
    [state.exercises],
  );

  const selectedExercises = useMemo(
    () => selectedSession?.planned_exercise_ids.map((exerciseId: string) => exerciseMap.get(exerciseId)).filter((exercise: Exercise | undefined): exercise is Exercise => Boolean(exercise)) ?? [],
    [exerciseMap, selectedSession],
  );

  const selectedSessionLogs = useMemo(
    () => state.logs.filter((log: ExerciseLog) => log.session_id === selectedSession?.id),
    [selectedSession, state.logs],
  );

  const selectedSummary = useMemo(() => {
    const volume = selectedSessionLogs.reduce((sum: number, log: ExerciseLog) => sum + log.performed_weight * log.performed_reps * log.sets, 0);
    const totalSets = selectedSessionLogs.reduce((sum: number, log: ExerciseLog) => sum + log.sets, 0);
    return {
      volume,
      durationMinutes: totalSets * 3,
    };
  }, [selectedSessionLogs]);

  const currentWeekOffset = useMemo(() => {
    const currentMonday = new Date(`${getCurrentMonday()}T12:00:00`);
    const selectedMonday = new Date(`${weekStart}T12:00:00`);
    return Math.round((selectedMonday.getTime() - currentMonday.getTime()) / 604800000);
  }, [weekStart]);

  const weekRangeLabel = useMemo(() => {
    if (state.sessions.length === 7) {
      return `${formatRangeDay(state.sessions[0].scheduled_date)} — ${formatRangeDay(state.sessions[6].scheduled_date)}`;
    }

    const monday = new Date(`${weekStart}T12:00:00`);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${formatRangeDay(monday.toISOString().slice(0, 10))} — ${formatRangeDay(sunday.toISOString().slice(0, 10))}`;
  }, [state.sessions, weekStart]);

  const dayCards = useMemo<DayCardData[]>(() => {
    return state.sessions.map((session: WorkoutSession) => ({
      session,
      dayLabel: getSafeFrenchDayLabel(session.day_of_week),
      dayNumber: new Date(`${session.scheduled_date}T12:00:00`).getDate().toString(),
      isToday: session.scheduled_date === todayIso,
      isPast: session.scheduled_date < todayIso,
    }));
  }, [state.sessions, todayIso]);

  if (isLoading) {
    return (
      <Container className="space-y-4 pt-6">
        <div className="space-y-2">
          <SkeletonText width="38%" height={20} />
          <SkeletonText width="48%" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: 7 }).map((_, index: number) => (
            <SkeletonCard key={index} className="min-w-[92px] flex-1" height={180} />
          ))}
        </div>
        <SkeletonCard height={240} />
      </Container>
    );
  }

  if (!state.hasTemplates) {
    return (
      <Container className="space-y-4 pt-6">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white">Cette semaine</h1>
              <p className="text-sm text-[#a1a1a1]">{weekRangeLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => changeWeek(shiftWeekStart(weekStart, -1))} className="rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-colors duration-200 hover:border-[#3a3a3a] hover:text-white">
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs text-[#555555]">{getWeekNavigationLabel(currentWeekOffset)}</span>
              <button type="button" onClick={() => changeWeek(shiftWeekStart(weekStart, 1))} className="rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-colors duration-200 hover:border-[#3a3a3a] hover:text-white">
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </header>
        <EmptyState icon="📅" title="Aucun programme" description="Configure ton programme dans les réglages" action={{ label: 'Ouvrir les réglages', onClick: () => router.push('/settings') }} />
      </Container>
    );
  }

  if (state.sessions.length === 0 && state.isPastWeekWithoutData) {
    return (
      <Container className="space-y-4 pt-6">
        <header className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white">Cette semaine</h1>
              <p className="text-sm text-[#a1a1a1]">{weekRangeLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => changeWeek(shiftWeekStart(weekStart, -1))} className="rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-colors duration-200 hover:border-[#3a3a3a] hover:text-white">
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs text-[#555555]">{getWeekNavigationLabel(currentWeekOffset)}</span>
              <button type="button" onClick={() => changeWeek(shiftWeekStart(weekStart, 1))} className="rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-colors duration-200 hover:border-[#3a3a3a] hover:text-white">
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </header>
        <EmptyState icon="🗓️" title="Aucune séance enregistrée" description="Cette semaine passée n'a pas été générée automatiquement." />
      </Container>
    );
  }

  return (
    <Container className="space-y-4 pt-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">Cette semaine</h1>
            <p className="text-sm text-[#a1a1a1]">{weekRangeLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changeWeek(shiftWeekStart(weekStart, -1))} className="rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-colors duration-200 hover:border-[#3a3a3a] hover:text-white">
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs text-[#555555]">{getWeekNavigationLabel(currentWeekOffset)}</span>
            <button type="button" onClick={() => changeWeek(shiftWeekStart(weekStart, 1))} className="rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-colors duration-200 hover:border-[#3a3a3a] hover:text-white">
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <section className="overflow-x-auto pb-1">
        <div className="flex min-w-[688px] gap-1.5">
          {dayCards.map(({ session, dayLabel, dayNumber, isToday, isPast }) => {
            const isRest = session.status === 'rest';
            const isSelected = session.id === selectedSessionId;

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={[
                  'flex min-h-[180px] min-w-[92px] flex-1 flex-col rounded-xl border p-3 text-left transition-all duration-200',
                  isToday ? 'border-white/20 bg-[#1c1c1c]' : 'border-[#2a2a2a] bg-[#141414]',
                  isPast && !isToday ? 'opacity-60' : '',
                  isSelected ? 'ring-1 ring-white/15' : '',
                ].join(' ')}
              >
                <div>
                  <p className="text-sm font-bold text-white">{dayLabel}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#555555]">{dayNumber}</p>
                </div>

                <div className="mt-4">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getSessionPillClasses(session.session_type, isRest)}`}>
                    {isRest ? 'Repos' : SESSION_LABELS[session.session_type]}
                  </span>
                </div>

                <div className="mt-auto pt-6 text-xs">{getStatusMarker(session)}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className={[
          'overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#141414] transition-all duration-200 ease-out',
          selectedSession ? 'max-h-[640px] p-4 opacity-100' : 'max-h-0 p-0 opacity-0',
        ].join(' ')}
      >
        {selectedSession ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getSessionPillClasses(selectedSession.session_type, selectedSession.status === 'rest')}`}>
                  {selectedSession.status === 'rest' ? 'Repos' : SESSION_LABELS[selectedSession.session_type]}
                </p>
                <h2 className="mt-3 text-2xl font-bold text-white">
                  {selectedSession.status === 'rest' ? 'Jour de repos' : SESSION_LABELS[selectedSession.session_type]}
                </h2>
                <p className="text-sm text-[#a1a1a1]">{formatRangeDay(selectedSession.scheduled_date)}</p>
              </div>
            </div>

            {selectedSession.status === 'rest' ? (
              <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-4 text-sm text-[#a1a1a1]">Repos — Récupère bien 😴</div>
            ) : (
              <>
                <div className="space-y-2">
                  {selectedExercises.map((exercise: Exercise) => (
                    <div key={exercise.id} className="flex items-center justify-between rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-3">
                      <span className="text-sm text-white">{exercise.name}</span>
                      <span className="text-xs text-[#a1a1a1]">
                        {exercise.sets} × {exercise.rep_range_min}-{exercise.rep_range_max}
                      </span>
                    </div>
                  ))}
                </div>

                {selectedSession.status === 'done' ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <p className="text-sm font-medium text-emerald-300">Séance terminée ✓</p>
                    <p className="mt-2 text-sm text-[#d1fae5]">Volume : {Math.round(selectedSummary.volume)} kg</p>
                    <p className="text-sm text-[#d1fae5]">Durée : {selectedSummary.durationMinutes} min</p>
                  </div>
                ) : selectedSession.status === 'partial' ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="text-sm font-medium text-amber-300">Séance partielle</p>
                    <p className="mt-2 text-sm text-[#fde68a]">Volume : {Math.round(selectedSummary.volume)} kg</p>
                    <p className="text-sm text-[#fde68a]">Durée estimée : {selectedSummary.durationMinutes} min</p>
                    <PrimaryButton fullWidth className="mt-4 bg-amber-500 text-black" onClick={() => router.push(`/session/${selectedSession.id}`)}>
                      Reprendre la séance →
                    </PrimaryButton>
                  </div>
                ) : (
                  <PrimaryButton fullWidth className="bg-white text-black" onClick={() => router.push(`/session/${selectedSession.id}`)}>
                    Commencer la séance →
                  </PrimaryButton>
                )}
              </>
            )}
          </div>
        ) : null}
      </section>
    </Container>
  );
}
