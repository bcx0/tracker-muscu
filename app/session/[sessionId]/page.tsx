'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, ChevronLeft, Maximize2, Trophy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

import Container from '@/components/ui/Container';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ProgressBar from '@/components/ui/ProgressBar';
import SecondaryButton from '@/components/ui/SecondaryButton';
import Skeleton, { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { calculateE1RM } from '@/lib/calculations';
import { formatDate, getWeekId } from '@/lib/dateUtils';
import { getFatigueWarning } from '@/lib/muscle-fatigue';
import { ProgressiveOverloadAnalysis, analyzeExerciseProgress } from '@/lib/progressive-overload';
import { getMuscleGroupLabel, SESSION_LABELS } from '@/lib/program-generator';
import { getUser, supabase } from '@/lib/supabase';
import { Exercise, ExerciseLog, PersonalRecord, SessionStatus, SetLog, UserSettings, WorkoutSession } from '@/types';

interface DraftSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  rir: number;
  completed: boolean;
  locked: boolean;
}

interface ExerciseDraft {
  exercise: Exercise;
  muscleLabel: string;
  sets: DraftSet[];
  suggestion: number;
  prMessage: string | null;
  overload: ProgressiveOverloadAnalysis;
}

interface SessionPageState {
  session: WorkoutSession | null;
  settings: UserSettings | null;
  exercises: ExerciseDraft[];
  personalRecords: Record<string, PersonalRecord>;
}

interface SummaryPreview {
  isOpen: boolean;
  mode: 'done' | 'partial';
  volume: number;
  durationMinutes: number;
  prMessages: string[];
  points: number;
}

interface RestTimerState {
  visible: boolean;
  duration: number;
  remaining: number;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

const INITIAL_SUMMARY: SummaryPreview = {
  isOpen: false,
  mode: 'done',
  volume: 0,
  durationMinutes: 0,
  prMessages: [],
  points: 0,
};

const INITIAL_TIMER: RestTimerState = {
  visible: false,
  duration: 90,
  remaining: 90,
};

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  legs: 'Jambes',
  shoulders: 'Épaules',
  arms: 'Bras',
  abs: 'Abdominaux',
  other: 'Autres',
};

function getSessionAccent(sessionType: WorkoutSession['session_type'] | 'rest'): string {
  switch (sessionType) {
    case 'Push':
    case 'Push_A':
      return 'from-[#ef4444] to-[#dc2626]';
    case 'Pull':
    case 'Pull_B':
      return 'from-[#3b82f6] to-[#2563eb]';
    case 'Abs':
      return 'from-[#f59e0b] to-[#d97706]';
    case 'UpperChest_Shoulders':
    case 'Full_Upper':
      return 'from-[#a855f7] to-[#9333ea]';
    case 'Abs_Arms':
      return 'from-[#f59e0b] to-[#d97706]';
    default:
      return 'from-[#1c1c1c] to-[#1c1c1c]';
  }
}

function buildDefaultSets(exercise: Exercise, baseWeight: number, existingSets?: SetLog[]): DraftSet[] {
  if (existingSets && existingSets.length > 0) {
    return existingSets
      .sort((a: SetLog, b: SetLog) => a.set_number - b.set_number)
      .map((setLog: SetLog) => ({
        id: setLog.id,
        setNumber: setLog.set_number,
        weight: String(Number(setLog.weight)),
        reps: String(setLog.reps),
        rir: setLog.rir,
        completed: setLog.completed,
        locked: setLog.completed,
      }));
  }

  return Array.from({ length: exercise.sets }).map((_, index: number) => ({
    id: uuidv4(),
    setNumber: index + 1,
    weight: baseWeight > 0 ? String(baseWeight) : '',
    reps: String(exercise.rep_range_max),
    rir: 2,
    completed: false,
    locked: false,
  }));
}

function computeWeekStreak(sessions: WorkoutSession[]): { current: number; longest: number } {
  const completedWeekIds = Array.from(
    new Set(
      sessions
        .filter((session: WorkoutSession) => session.status === 'done' || session.status === 'partial')
        .map((session: WorkoutSession) => getWeekId(new Date(`${session.scheduled_date}T12:00:00`))),
    ),
  ).sort();

  if (completedWeekIds.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 1;
  let running = 1;

  for (let index = 1; index < completedWeekIds.length; index += 1) {
    const [previousYear, previousWeek] = completedWeekIds[index - 1].split('-W').map(Number);
    const [currentYear, currentWeek] = completedWeekIds[index].split('-W').map(Number);
    const sequential =
      (currentYear === previousYear && currentWeek - previousWeek === 1) ||
      (currentYear - previousYear === 1 && previousWeek >= 52 && currentWeek === 1);

    if (sequential) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 1;
    }
  }

  let current = 1;
  for (let index = completedWeekIds.length - 1; index > 0; index -= 1) {
    const [previousYear, previousWeek] = completedWeekIds[index - 1].split('-W').map(Number);
    const [currentYear, currentWeek] = completedWeekIds[index].split('-W').map(Number);
    const sequential =
      (currentYear === previousYear && currentWeek - previousWeek === 1) ||
      (currentYear - previousYear === 1 && previousWeek >= 52 && currentWeek === 1);

    if (!sequential) {
      break;
    }

    current += 1;
  }

  return { current, longest };
}

function isExerciseComplete(exercise: ExerciseDraft): boolean {
  return exercise.sets.length > 0 && exercise.sets.every((setItem: DraftSet) => setItem.completed);
}

function getSuggestionChipClasses(tone: ProgressiveOverloadAnalysis['chipTone']): string {
  switch (tone) {
    case 'green':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case 'blue':
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case 'orange':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    default:
      return 'border-[#2a2a2a] bg-[#1c1c1c] text-[#a1a1a1]';
  }
}

async function requestWakeLock(ref: { current: WakeLockSentinelLike | null }): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return;
  }

  try {
    const wakeLock = await (navigator as Navigator & {
      wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }).wakeLock.request('screen');
    ref.current = wakeLock;
  } catch {
    ref.current = null;
  }
}

export default function SessionPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const STORAGE_KEY = `muscu_session_${sessionId}`;
  const [state, setState] = useState<SessionPageState>({ session: null, settings: null, exercises: [], personalRecords: {} });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<SummaryPreview>(INITIAL_SUMMARY);
  const [restTimer, setRestTimer] = useState<RestTimerState>(INITIAL_TIMER);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [animatedSetId, setAnimatedSetId] = useState<string | null>(null);
  const [visiblePrExerciseId, setVisiblePrExerciseId] = useState<string | null>(null);
  const [isGymMode, setIsGymMode] = useState<boolean>(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState<boolean>(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number>(0);
  const [startedAt] = useState<number>(Date.now());
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const hasCompletedSetsRef = useRef<boolean>(false);
  const bypassPopStateRef = useRef<boolean>(false);

  useEffect(() => {
    let active = true;

    async function loadSession(): Promise<void> {
      const { data: userData } = await getUser();
      const user = userData.user;

      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const { data: sessionRow } = await supabase.from('workout_sessions').select('*').eq('id', sessionId).maybeSingle();
      const currentSession = (sessionRow ?? null) as WorkoutSession | null;

      if (!currentSession) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const [{ data: settingsRow }, { data: exerciseRows }, { data: historicalLogs }, { data: sessionLogs }, { data: recordRows }] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('exercises').select('*').eq('user_id', user.id).in('id', currentSession.planned_exercise_ids),
        supabase.from('exercise_logs').select('*').eq('user_id', user.id).in('exercise_id', currentSession.planned_exercise_ids).order('logged_at', { ascending: true }),
        supabase.from('exercise_logs').select('*').eq('session_id', currentSession.id),
        supabase.from('personal_records').select('*').eq('user_id', user.id).in('exercise_id', currentSession.planned_exercise_ids),
      ]);

      const allLogs = (historicalLogs ?? []) as ExerciseLog[];
      const currentSessionLogs = (sessionLogs ?? []) as ExerciseLog[];
      const logIds = Array.from(new Set([...allLogs, ...currentSessionLogs].map((log: ExerciseLog) => log.id)));
      const { data: setLogRows } = logIds.length > 0 ? await supabase.from('set_logs').select('*').in('exercise_log_id', logIds) : { data: [] as SetLog[] };
      const allSetLogs = (setLogRows ?? []) as SetLog[];
      const recordMap = Object.fromEntries(((recordRows ?? []) as PersonalRecord[]).map((record: PersonalRecord) => [record.exercise_id, record]));

      const orderedExercises = ((exerciseRows ?? []) as Exercise[])
        .sort((a: Exercise, b: Exercise) => currentSession.planned_exercise_ids.indexOf(a.id) - currentSession.planned_exercise_ids.indexOf(b.id));
      const overloadAnalyses = await Promise.all(orderedExercises.map((exercise: Exercise) => analyzeExerciseProgress(exercise.id, user.id)));

      const exerciseDrafts: ExerciseDraft[] = orderedExercises
        .map((exercise: Exercise, index: number) => {
          const currentExerciseLog = currentSessionLogs.find((log: ExerciseLog) => log.exercise_id === exercise.id);
          const currentExerciseSetLogs = currentExerciseLog ? allSetLogs.filter((setLog: SetLog) => setLog.exercise_log_id === currentExerciseLog.id) : [];
          const overload = overloadAnalyses[index];
          const suggestion = overload.suggestedWeight;
          const baseWeight = currentExerciseLog?.performed_weight ?? suggestion ?? exercise.last_weight;

          return {
            exercise,
            muscleLabel: getMuscleGroupLabel(exercise.muscle_group, exercise.name),
            sets: buildDefaultSets(exercise, baseWeight, currentExerciseSetLogs),
            suggestion,
            prMessage: null,
            overload,
          } satisfies ExerciseDraft;
        });

      if (active) {
        const settings = (settingsRow ?? null) as UserSettings | null;
        let restoredExercises = exerciseDrafts;

        if (typeof window !== 'undefined' && currentSession.status !== 'done') {
          const savedSession = window.localStorage.getItem(STORAGE_KEY);

          if (savedSession) {
            try {
              const parsedExercises = JSON.parse(savedSession) as ExerciseDraft[];
              if (Array.isArray(parsedExercises)) {
                restoredExercises = parsedExercises;
                toast.success('Séance restaurée 🔄');
              }
            } catch {
              window.localStorage.removeItem(STORAGE_KEY);
            }
          }
        }

        setState({
          session: currentSession,
          settings,
          exercises: restoredExercises,
          personalRecords: recordMap,
        });
        setRestTimer({
          visible: false,
          duration: settings?.rest_timer_duration ?? 90,
          remaining: settings?.rest_timer_duration ?? 90,
        });
        setIsLoading(false);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [sessionId, STORAGE_KEY]);

  useEffect(() => {
    if (typeof window === 'undefined' || isLoading || !state.session || state.session.status === 'done') {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.exercises));
    }, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [STORAGE_KEY, isLoading, state.exercises, state.session]);

  useEffect(() => {
    if (!restTimer.visible) {
      return;
    }

    if (restTimer.remaining <= 0) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(200);
      }
      setRestTimer((previous: RestTimerState) => ({ ...previous, visible: false, remaining: previous.duration }));
      return;
    }

    const timeout = window.setTimeout(() => {
      setRestTimer((previous: RestTimerState) => ({ ...previous, remaining: previous.remaining - 1 }));
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [restTimer]);

  useEffect(() => {
    if (!isGymMode) {
      return;
    }

    const handleVisibilityChange = async (): Promise<void> => {
      if (document.visibilityState === 'visible' && wakeLockRef.current !== null) {
        await requestWakeLock(wakeLockRef);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isGymMode]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      if (document.fullscreenElement === null) {
        void wakeLockRef.current?.release();
        wakeLockRef.current = null;
        setIsGymMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      void wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (currentExerciseIndex <= state.exercises.length - 1) {
      return;
    }

    setCurrentExerciseIndex(Math.max(0, state.exercises.length - 1));
  }, [currentExerciseIndex, state.exercises.length]);

  useEffect(() => {
    hasCompletedSetsRef.current = state.exercises.some((exerciseDraft: ExerciseDraft) =>
      exerciseDraft.sets.some((setItem: DraftSet) => setItem.completed),
    );
  }, [state.exercises]);

  useEffect(() => {
    const handlePopState = (): void => {
      if (bypassPopStateRef.current) {
        bypassPopStateRef.current = false;
        return;
      }

      if (hasCompletedSetsRef.current) {
        window.history.pushState(null, '', window.location.href);
        setIsLeaveConfirmOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const completedExercises = useMemo(
    () => state.exercises.filter((exerciseDraft: ExerciseDraft) => isExerciseComplete(exerciseDraft)).length,
    [state.exercises],
  );
  const hasCompletedSets = useMemo(
    () => state.exercises.some((exerciseDraft: ExerciseDraft) => exerciseDraft.sets.some((setItem: DraftSet) => setItem.completed)),
    [state.exercises],
  );
  const currentExercise = state.exercises[currentExerciseIndex] ?? null;
  const currentExerciseFatigueWarning = currentExercise
    ? getFatigueWarning(
        currentExercise.exercise.name,
        state.exercises
          .slice(0, currentExerciseIndex)
          .filter((exerciseDraft: ExerciseDraft) => exerciseDraft.sets.some((setItem: DraftSet) => setItem.completed))
          .map((exerciseDraft: ExerciseDraft) => exerciseDraft.exercise.name),
      )
    : null;
  const totalExercises = state.exercises.length;
  const allExercisesComplete = totalExercises > 0 && completedExercises === totalExercises;
  const accent = getSessionAccent(state.session?.session_type ?? 'rest');
  const progressValue = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;
  const computedVolume = useMemo(
    () =>
      state.exercises.reduce((total: number, exerciseDraft: ExerciseDraft) => {
        return total + exerciseDraft.sets.reduce((exerciseTotal: number, setItem: DraftSet) => {
          if (!setItem.completed) {
            return exerciseTotal;
          }

          const weight = Number(setItem.weight);
          const reps = Number(setItem.reps);
          return exerciseTotal + weight * reps;
        }, 0);
      }, 0),
    [state.exercises],
  );
  const prMessages = useMemo(
    () => state.exercises.map((exerciseDraft: ExerciseDraft) => exerciseDraft.prMessage).filter((value: string | null): value is string => Boolean(value)),
    [state.exercises],
  );

  const updateSet = (exerciseId: string, setId: string, partial: Partial<DraftSet>): void => {
    setState((previous: SessionPageState) => ({
      ...previous,
      exercises: previous.exercises.map((exerciseDraft: ExerciseDraft) => {
        if (exerciseDraft.exercise.id !== exerciseId) {
          return exerciseDraft;
        }

        return {
          ...exerciseDraft,
          sets: exerciseDraft.sets.map((setItem: DraftSet) => (setItem.id === setId ? { ...setItem, ...partial } : setItem)),
        };
      }),
    }));
  };

  const addSet = (exerciseId: string): void => {
    setState((previous: SessionPageState) => ({
      ...previous,
      exercises: previous.exercises.map((exerciseDraft: ExerciseDraft) => {
        if (exerciseDraft.exercise.id !== exerciseId) {
          return exerciseDraft;
        }

        const lastSet = exerciseDraft.sets[exerciseDraft.sets.length - 1];
        return {
          ...exerciseDraft,
          sets: [
            ...exerciseDraft.sets,
            {
              id: uuidv4(),
              setNumber: exerciseDraft.sets.length + 1,
              weight: lastSet?.weight ?? (exerciseDraft.suggestion > 0 ? String(exerciseDraft.suggestion) : ''),
              reps: lastSet?.reps ?? String(exerciseDraft.exercise.rep_range_max),
              rir: lastSet?.rir ?? 2,
              completed: false,
              locked: false,
            },
          ],
        };
      }),
    }));
  };

  const triggerRestTimer = (): void => {
    const duration = state.settings?.rest_timer_duration ?? 90;
    setRestTimer({ visible: true, duration, remaining: duration });
  };

  const completeSet = (exerciseDraft: ExerciseDraft, setItem: DraftSet): void => {
    const weight = Number(setItem.weight);
    const reps = Number(setItem.reps);

    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight < 0 || reps <= 0) {
      toast.error('Renseigne un poids et un nombre de répétitions valides.');
      return;
    }

    const e1rm = calculateE1RM(weight, reps);
    const existingPr = state.personalRecords[exerciseDraft.exercise.id]?.best_e1rm ?? 0;
    const currentExerciseBest = exerciseDraft.prMessage ? existingPr + 0.01 : existingPr;
    const isNewPr = e1rm > currentExerciseBest;

    setState((previous: SessionPageState) => ({
      ...previous,
      exercises: previous.exercises.map((currentExercise: ExerciseDraft) => {
        if (currentExercise.exercise.id !== exerciseDraft.exercise.id) {
          return currentExercise;
        }

        return {
          ...currentExercise,
          prMessage: isNewPr ? `🏆 Nouveau PR sur ${currentExercise.exercise.name}` : currentExercise.prMessage,
          sets: currentExercise.sets.map((currentSet: DraftSet) =>
            currentSet.id === setItem.id
              ? {
                  ...currentSet,
                  completed: true,
                  locked: true,
                  weight: String(weight),
                  reps: String(reps),
                }
              : currentSet,
          ),
        };
      }),
    }));

    if (isNewPr) {
      toast.success('Nouveau PR détecté');
    }

    if (isNewPr) {
      setVisiblePrExerciseId(exerciseDraft.exercise.id);
      window.setTimeout(() => setVisiblePrExerciseId((current: string | null) => (current === exerciseDraft.exercise.id ? null : current)), 3000);
    }

    setAnimatedSetId(setItem.id);
    window.setTimeout(() => setAnimatedSetId((current: string | null) => (current === setItem.id ? null : current)), 240);
    triggerRestTimer();
  };

  const unlockSet = (exerciseId: string, setId: string): void => {
    setState((previous: SessionPageState) => ({
      ...previous,
      exercises: previous.exercises.map((exerciseDraft: ExerciseDraft) => {
        if (exerciseDraft.exercise.id !== exerciseId) {
          return exerciseDraft;
        }

        return {
          ...exerciseDraft,
          sets: exerciseDraft.sets.map((setItem: DraftSet) =>
            setItem.id === setId
              ? {
                  ...setItem,
                  locked: false,
                  completed: false,
                }
              : setItem,
          ),
        };
      }),
    }));

    toast.success('Série déverrouillée — modifie puis revalide');
  };

  const openSummary = (mode: 'done' | 'partial'): void => {
    const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const completedSetCount = state.exercises.reduce(
      (count: number, exerciseDraft: ExerciseDraft) => count + exerciseDraft.sets.filter((setItem: DraftSet) => setItem.completed).length,
      0,
    );
    const points = completedSetCount * 2 + prMessages.length * 5 + (mode === 'done' ? 10 : 5);

    setSummary({
      isOpen: true,
      mode,
      volume: computedVolume,
      durationMinutes,
      prMessages,
      points,
    });
  };

  const enterGymMode = async (): Promise<void> => {
    try {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked by the browser.
    }

    await requestWakeLock(wakeLockRef);
    setIsGymMode(true);
  };

  const exitGymMode = async (): Promise<void> => {
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen exit errors.
    }

    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }

    setIsGymMode(false);
  };

  const handleLeaveAttempt = (): void => {
    if (!hasCompletedSets) {
      bypassPopStateRef.current = true;
      router.back();
      return;
    }

    setIsLeaveConfirmOpen(true);
  };

  const confirmLeaveSession = (): void => {
    setIsLeaveConfirmOpen(false);
    bypassPopStateRef.current = true;
    router.back();
  };

  const finishSession = async (): Promise<void> => {
    if (!state.session || isSaving) {
      return;
    }

    console.log('clicked');

    try {
      const { data: userData } = await getUser();
      const user = userData.user;

      if (!user) {
        toast.error('Utilisateur introuvable.');
        return;
      }

      setIsSaving(true);

    const previousStatus = state.session.status;
    const nowIso = new Date().toISOString();

    const exerciseLogsPayload = state.exercises.map((exerciseDraft: ExerciseDraft) => {
      const completedSets = exerciseDraft.sets.filter((setItem: DraftSet) => setItem.completed);
      const bestSet = completedSets.reduce<{ weight: number; reps: number; e1rm: number } | null>((best, currentSet) => {
        const weight = Number(currentSet.weight);
        const reps = Number(currentSet.reps);
        const e1rm = calculateE1RM(weight, reps);
        if (!best || e1rm > best.e1rm) {
          return { weight, reps, e1rm };
        }
        return best;
      }, null);

      return {
        id: uuidv4(),
        session_id: state.session!.id,
        user_id: user.id,
        exercise_id: exerciseDraft.exercise.id,
        performed_weight: bestSet?.weight ?? 0,
        performed_reps: bestSet?.reps ?? 0,
        sets: completedSets.length,
        rir: completedSets.at(-1)?.rir ?? 2,
        e1rm: bestSet?.e1rm ?? 0,
        logged_at: nowIso,
      } satisfies ExerciseLog;
    });

    const setLogsPayload = state.exercises.flatMap((exerciseDraft: ExerciseDraft, exerciseIndex: number) =>
      exerciseDraft.sets.filter((setItem: DraftSet) => setItem.completed).map((setItem: DraftSet) => ({
        id: uuidv4(),
        exercise_log_id: exerciseLogsPayload[exerciseIndex].id,
        user_id: user.id,
        set_number: setItem.setNumber,
        weight: Number(setItem.weight || '0'),
        reps: Number(setItem.reps || '0'),
        rir: setItem.rir,
        completed: true,
        logged_at: nowIso,
      })),
    );

    const { error: deleteLogsError } = await supabase.from('exercise_logs').delete().eq('session_id', state.session.id);
    if (deleteLogsError) {
      setIsSaving(false);
      toast.error(deleteLogsError.message);
      return;
    }

    const { error: insertExerciseLogsError } = await supabase.from('exercise_logs').insert(exerciseLogsPayload);
    if (insertExerciseLogsError) {
      setIsSaving(false);
      toast.error(insertExerciseLogsError.message);
      return;
    }

    if (setLogsPayload.length > 0) {
      const { error: insertSetLogsError } = await supabase.from('set_logs').insert(setLogsPayload);
      if (insertSetLogsError) {
        setIsSaving(false);
        toast.error(insertSetLogsError.message);
        return;
      }
    }

    for (const exerciseDraft of state.exercises) {
      const completedSets = exerciseDraft.sets.filter((setItem: DraftSet) => setItem.completed);
      const lastCompletedSet = completedSets[completedSets.length - 1];
      const bestSet = completedSets.reduce<{ weight: number; reps: number; e1rm: number } | null>((best, currentSet) => {
        const weight = Number(currentSet.weight);
        const reps = Number(currentSet.reps);
        const e1rm = calculateE1RM(weight, reps);
        if (!best || e1rm > best.e1rm) {
          return { weight, reps, e1rm };
        }
        return best;
      }, null);

      if (lastCompletedSet) {
        const nextSuggestion = completedSets.every((setItem: DraftSet) => Number(setItem.reps) >= exerciseDraft.exercise.rep_range_max)
          ? Number((Number(lastCompletedSet.weight) + 2.5).toFixed(2))
          : Number(lastCompletedSet.weight);

        const { error: updateExerciseError } = await supabase
          .from('exercises')
          .update({
            last_weight: Number(lastCompletedSet.weight),
            last_reps: Number(lastCompletedSet.reps),
            suggested_weight: nextSuggestion,
          })
          .eq('id', exerciseDraft.exercise.id);

        if (updateExerciseError) {
          setIsSaving(false);
          toast.error(updateExerciseError.message);
          return;
        }
      }

      if (bestSet) {
        const existingPr = state.personalRecords[exerciseDraft.exercise.id];
        if (!existingPr || bestSet.e1rm > existingPr.best_e1rm) {
          const { error: upsertPrError } = await supabase.from('personal_records').upsert(
            {
              id: existingPr?.id ?? uuidv4(),
              user_id: user.id,
              exercise_id: exerciseDraft.exercise.id,
              best_weight: bestSet.weight,
              best_reps: bestSet.reps,
              best_e1rm: bestSet.e1rm,
              achieved_at: nowIso,
            },
            { onConflict: 'user_id,exercise_id' },
          );

          if (upsertPrError) {
            setIsSaving(false);
            toast.error(upsertPrError.message);
            return;
          }
        }
      }
    }

    const { error: updateSessionError } = await supabase
      .from('workout_sessions')
      .update({
        status: 'done',
        points_earned: summary.points,
        completed_at: nowIso,
      })
      .eq('id', state.session.id);

    if (updateSessionError) {
      setIsSaving(false);
      toast.error(updateSessionError.message);
      return;
    }

    const { data: updatedSessions, error: sessionsError } = await supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('scheduled_date', { ascending: true });
    if (sessionsError) {
      setIsSaving(false);
      toast.error(sessionsError.message);
      return;
    }

    const streakStats = computeWeekStreak((updatedSessions ?? []) as WorkoutSession[]);
    const previousCompleted = previousStatus === 'done' || previousStatus === 'partial';
    const totalSessions = (state.settings?.total_sessions ?? 0) + (previousCompleted ? 0 : 1);

    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          sessions_per_week: state.settings?.sessions_per_week ?? 5,
          training_days: state.settings?.training_days ?? [],
          setup_complete: state.settings?.setup_complete ?? true,
          current_streak: streakStats.current,
          longest_streak: Math.max(state.settings?.longest_streak ?? 0, streakStats.longest),
          total_sessions: totalSessions,
          rest_timer_duration: state.settings?.rest_timer_duration ?? 90,
        },
        { onConflict: 'user_id' },
      );

    if (settingsError) {
      setIsSaving(false);
      toast.error(settingsError.message);
      return;
    }

    await exitGymMode();
    window.localStorage.removeItem(STORAGE_KEY);
    setIsSaving(false);
    toast.success('Séance terminée ! 💪');
    router.push('/today');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de terminer la séance.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Container className="space-y-4 pt-4">
        <SkeletonCard height={112} />
        {Array.from({ length: 4 }).map((_, index: number) => (
          <div key={index} className="surface-card space-y-4 p-4">
            <div className="space-y-2">
              <SkeletonText width="42%" />
              <SkeletonText width="24%" />
            </div>
            {Array.from({ length: 3 }).map((__, rowIndex: number) => (
              <div key={rowIndex} className="grid grid-cols-[76px_1fr_18px_1fr_44px] items-center gap-2">
                <SkeletonText width="80%" height={20} />
                <Skeleton height={44} borderRadius="16px" />
                <SkeletonText width={12} height={16} />
                <Skeleton height={44} borderRadius="16px" />
                <Skeleton height={44} width={44} borderRadius="16px" />
              </div>
            ))}
          </div>
        ))}
      </Container>
    );
  }

  if (!state.session) {
    return (
      <Container className="pt-8">
        <EmptyState
          icon="🏋️"
          title="Séance introuvable"
          description="Cette séance n'existe plus ou n'est plus accessible."
          action={{ label: 'Retour au planning', onClick: () => router.push('/week') }}
        />
      </Container>
    );
  }

  if (state.exercises.length === 0) {
    return (
      <Container className="pt-8">
        <EmptyState
          icon="📝"
          title="Aucun exercice prévu"
          description="Ajoute ou régénère ton programme depuis les réglages."
          action={{ label: 'Ouvrir les réglages', onClick: () => router.push('/settings') }}
        />
      </Container>
    );
  }

  if (isGymMode && currentExercise) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8 pt-4">
          <div className="mb-6 flex items-center justify-between text-sm text-[#a1a1a1]">
            <span>
              Exercice {currentExerciseIndex + 1}/{totalExercises}
            </span>
            <span className="session-tracking text-xs text-white">{SESSION_LABELS[state.session.session_type]}</span>
            <button type="button" onClick={() => void exitGymMode()} className="rounded-full border border-[#2a2a2a] p-2 text-white">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-3 pt-4">
              <h2 className="text-4xl font-bold text-white">{currentExercise.exercise.name}</h2>
              <p className="text-base text-[#a1a1a1]">{currentExercise.muscleLabel}</p>
              <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getSuggestionChipClasses(currentExercise.overload.chipTone)}`}>
                {currentExercise.overload.chipLabel}
              </div>
              {currentExerciseFatigueWarning ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                  {currentExerciseFatigueWarning}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {currentExercise.sets.map((setItem: DraftSet) => (
                <Fragment key={setItem.id}>
                <div
                  key={setItem.id}
                  className={[
                    'rounded-2xl border p-4 transition-colors duration-300',
                    setItem.completed ? 'border-emerald-500/40 bg-[#0a2a0a]' : 'border-[#2a2a2a] bg-[#1c1c1c]',
                  ].join(' ')}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-base font-medium text-white">Série {setItem.setNumber}</span>
                    {setItem.completed ? <span className="text-sm text-emerald-300">Validée</span> : null}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_72px] gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={setItem.weight}
                      disabled={setItem.locked}
                      onChange={(event) => updateSet(currentExercise.exercise.id, setItem.id, { weight: event.target.value })}
                      className="min-h-[72px] rounded-2xl border border-[#2a2a2a] bg-[#141414] px-4 text-center text-3xl font-bold text-white disabled:opacity-60"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={setItem.reps}
                      disabled={setItem.locked}
                      onChange={(event) => updateSet(currentExercise.exercise.id, setItem.id, { reps: event.target.value })}
                      className="min-h-[72px] rounded-2xl border border-[#2a2a2a] bg-[#141414] px-4 text-center text-3xl font-bold text-white disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={setItem.completed}
                      onClick={() => completeSet(currentExercise, setItem)}
                      className={[
                        'min-h-[72px] rounded-2xl text-2xl font-bold transition-all duration-300',
                        animatedSetId === setItem.id ? 'set-complete-pop' : '',
                        setItem.completed ? `bg-gradient-to-r ${accent} text-white opacity-80` : `bg-gradient-to-r ${accent} text-white`,
                      ].join(' ')}
                    >
                      ✓
                    </button>
                  </div>
                  {setItem.completed ? (
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => unlockSet(currentExercise.exercise.id, setItem.id)}
                        className="text-xs text-[#a1a1a1] underline"
                      >
                        Modifier
                      </button>
                    </div>
                  ) : null}
                </div>
                </Fragment>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <SecondaryButton fullWidth disabled={currentExerciseIndex === 0} onClick={() => setCurrentExerciseIndex((value) => Math.max(0, value - 1))}>
              ← Exercice précédent
            </SecondaryButton>
            {currentExerciseIndex === totalExercises - 1 ? (
              <PrimaryButton fullWidth className="bg-[#22c55e] text-[#0a0a0a] hover:bg-[#16a34a]" onClick={() => openSummary(allExercisesComplete ? 'done' : 'partial')}>
                Terminer la séance
              </PrimaryButton>
            ) : (
              <PrimaryButton fullWidth className={`bg-gradient-to-r ${accent} text-white`} onClick={() => setCurrentExerciseIndex((value) => Math.min(totalExercises - 1, value + 1))}>
                Exercice suivant →
              </PrimaryButton>
            )}
          </div>
        </div>

        {restTimer.visible ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#050505]/95 px-4">
            <div className="flex w-full max-w-md flex-col items-center gap-8">
              <div className="relative flex h-72 w-72 items-center justify-center">
                <svg className="-rotate-90" width="288" height="288" viewBox="0 0 288 288">
                  <circle cx="144" cy="144" r="120" fill="none" stroke="#1c1c1c" strokeWidth="10" />
                  <circle
                    cx="144"
                    cy="144"
                    r="120"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={753.98}
                    strokeDashoffset={753.98 - (753.98 * restTimer.remaining) / restTimer.duration}
                  />
                </svg>
                <span className="absolute text-8xl font-bold text-white">{restTimer.remaining}</span>
              </div>
              <div className="grid w-full grid-cols-3 gap-3">
                <SecondaryButton fullWidth onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, remaining: Math.max(0, previous.remaining - 15) }))}>
                  −15s
                </SecondaryButton>
                <SecondaryButton fullWidth onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, visible: false }))}>
                  Passer
                </SecondaryButton>
                <SecondaryButton fullWidth onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, remaining: previous.remaining + 15, duration: previous.duration + 15 }))}>
                  +15s
                </SecondaryButton>
              </div>
            </div>
          </div>
        ) : null}

        <Modal isOpen={summary.isOpen} onClose={() => setSummary(INITIAL_SUMMARY)} title="✅ Séance terminée !">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-4">
              <p className="text-sm text-[#a1a1a1]">Volume total</p>
              <p className="text-2xl font-bold text-white">{Math.round(summary.volume)} kg</p>
              <p className="mt-3 text-sm text-[#a1a1a1]">Durée</p>
              <p className="text-lg font-semibold text-white">{summary.durationMinutes} minutes</p>
              <p className="mt-3 text-sm text-[#a1a1a1]">Points gagnés</p>
              <p className="text-lg font-semibold text-white">{summary.points} pts</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <PrimaryButton fullWidth onClick={() => void finishSession()} disabled={isSaving}>
                {isSaving ? 'Enregistrement...' : "Fermer et retourner à l'accueil"}
              </PrimaryButton>
              <SecondaryButton fullWidth onClick={() => setSummary(INITIAL_SUMMARY)}>
                Continuer la séance
              </SecondaryButton>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-56">
      <header className="sticky top-0 z-20 border-b border-[#2a2a2a] bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <button type="button" onClick={handleLeaveAttempt} className="rounded-full border border-[#2a2a2a] p-2 text-white">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#a1a1a1]">Séance en cours</p>
            <h1 className="session-tracking truncate text-2xl font-bold text-white">{SESSION_LABELS[state.session.session_type]}</h1>
            <p className="text-sm text-[#a1a1a1]">{formatDate(state.session.scheduled_date)}</p>
          </div>
          <button type="button" onClick={() => void enterGymMode()} className="rounded-full border border-[#2a2a2a] p-2 text-white transition-colors duration-200 hover:border-[#3a3a3a]">
            <Maximize2 size={18} />
          </button>
        </div>
      </header>

      <Container className="space-y-4 pt-4">
        <section className="surface-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{completedExercises}/{totalExercises} exercices complétés</p>
              <p className="text-xs text-[#a1a1a1]">Valide chaque série pour débloquer la fin de séance.</p>
            </div>
            <span className="text-sm font-semibold text-white">{progressValue}%</span>
          </div>
          <ProgressBar value={progressValue} color="bg-white" />
        </section>

        {state.exercises.map((exerciseDraft: ExerciseDraft) => {
          const completedSetCount = exerciseDraft.sets.filter((setItem: DraftSet) => setItem.completed).length;
          const fatigueWarning = getFatigueWarning(
            exerciseDraft.exercise.name,
            state.exercises
              .slice(0, state.exercises.findIndex((item: ExerciseDraft) => item.exercise.id === exerciseDraft.exercise.id))
              .filter((previousExercise: ExerciseDraft) => previousExercise.sets.some((setItem: DraftSet) => setItem.completed))
              .map((previousExercise: ExerciseDraft) => previousExercise.exercise.name),
          );

          return (
            <section key={exerciseDraft.exercise.id} className="surface-card space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{exerciseDraft.exercise.name}</h2>
                  <p className="text-sm text-[#a1a1a1]">{exerciseDraft.muscleLabel}</p>
                  <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getSuggestionChipClasses(exerciseDraft.overload.chipTone)}`}>
                    {exerciseDraft.overload.chipLabel}
                  </div>
                  {fatigueWarning ? (
                    <div className="mt-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                      {fatigueWarning}
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-[#555555]">
                    Cible : {exerciseDraft.exercise.sets} séries × {exerciseDraft.exercise.rep_range_min}-{exerciseDraft.exercise.rep_range_max} reps @{' '}
                    {exerciseDraft.suggestion > 0 ? `${exerciseDraft.suggestion} kg` : 'charge libre'}
                  </p>
                  <p className="mt-2 text-sm text-[#a1a1a1]">{exerciseDraft.overload.message}</p>
                </div>
                <span className="rounded-full border border-[#2a2a2a] px-3 py-1 text-xs font-medium text-[#a1a1a1]">
                  {completedSetCount}/{exerciseDraft.sets.length}
                </span>
              </div>

              {exerciseDraft.prMessage && visiblePrExerciseId === exerciseDraft.exercise.id ? (
                <div className="pr-badge-enter rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300">
                  {exerciseDraft.prMessage}
                </div>
              ) : null}

              <div className="space-y-2">
                {exerciseDraft.sets.map((setItem: DraftSet) => (
                  <Fragment key={setItem.id}>
                  <div
                    key={setItem.id}
                    className={[
                      'grid grid-cols-[76px_1fr_18px_1fr_44px] items-center gap-2 rounded-2xl border p-2 transition-colors duration-300',
                      setItem.completed ? 'border-emerald-500/40 bg-[#0a2a0a]' : 'border-[#2a2a2a] bg-[#1c1c1c]',
                    ].join(' ')}
                  >
                    <span className="text-sm font-medium text-white">Série {setItem.setNumber}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={setItem.weight}
                      disabled={setItem.locked}
                      onChange={(event) => updateSet(exerciseDraft.exercise.id, setItem.id, { weight: event.target.value })}
                      className="min-h-[44px] w-full rounded-2xl border border-[#2a2a2a] bg-[#141414] px-3 text-center text-white disabled:opacity-60"
                    />
                    <span className="text-center text-[#555555]">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={setItem.reps}
                      disabled={setItem.locked}
                      onChange={(event) => updateSet(exerciseDraft.exercise.id, setItem.id, { reps: event.target.value })}
                      className="min-h-[44px] w-full rounded-2xl border border-[#2a2a2a] bg-[#141414] px-3 text-center text-white disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={setItem.completed}
                      onClick={() => completeSet(exerciseDraft, setItem)}
                      className={[
                        'flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-300',
                        animatedSetId === setItem.id ? 'set-complete-pop' : '',
                        setItem.completed ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300' : 'border-[#2a2a2a] bg-[#141414] text-white hover:border-[#3a3a3a]',
                      ].join(' ')}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                  {setItem.completed ? (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => unlockSet(exerciseDraft.exercise.id, setItem.id)}
                        className="text-xs text-[#a1a1a1] underline"
                      >
                        Modifier
                      </button>
                    </div>
                  ) : null}
                  </Fragment>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addSet(exerciseDraft.exercise.id)}
                className="text-sm font-medium text-[#a1a1a1] transition-colors duration-200 hover:text-white"
              >
                + Ajouter une série
              </button>
            </section>
          );
        })}
      </Container>

      <div className="fixed bottom-24 left-0 right-0 z-20 px-4">
        <div className="mx-auto flex max-w-md flex-col gap-3 rounded-[24px] border border-[#2a2a2a] bg-[#141414]/95 p-4 backdrop-blur-sm">
          <PrimaryButton fullWidth className={`bg-gradient-to-r ${accent} text-white`} onClick={() => void finishSession()}>
            Terminer la séance
          </PrimaryButton>
          {!allExercisesComplete ? (
            <SecondaryButton fullWidth onClick={() => openSummary('partial')}>
              Terminer partiellement
            </SecondaryButton>
          ) : null}
        </div>
      </div>

      <Modal isOpen={summary.isOpen} onClose={() => setSummary(INITIAL_SUMMARY)} title="✅ Séance terminée !">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-4">
            <p className="text-sm text-[#a1a1a1]">Volume total</p>
            <p className="text-2xl font-bold text-white">{Math.round(summary.volume)} kg</p>
            <p className="mt-3 text-sm text-[#a1a1a1]">Durée</p>
            <p className="text-lg font-semibold text-white">{summary.durationMinutes} minutes</p>
            <p className="mt-3 text-sm text-[#a1a1a1]">Points gagnés</p>
            <p className="text-lg font-semibold text-white">{summary.points} pts</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-white">PRs battus</p>
            {summary.prMessages.length === 0 ? (
              <p className="text-sm text-[#a1a1a1]">Aucun PR cette fois.</p>
            ) : (
              <div className="space-y-2">
                {summary.prMessages.map((message: string) => (
                  <div key={message} className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                    <Trophy size={16} />
                    <span>{message.replace('🏆 ', '')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <PrimaryButton fullWidth onClick={() => void finishSession()} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : "Fermer et retourner à l'accueil"}
            </PrimaryButton>
            <SecondaryButton fullWidth onClick={() => setSummary(INITIAL_SUMMARY)}>
              Continuer la séance
            </SecondaryButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isLeaveConfirmOpen} onClose={() => setIsLeaveConfirmOpen(false)} title="Quitter la séance ?">
        <div className="space-y-4">
          <p className="text-sm text-[#a1a1a1]">Ta progression sera sauvegardée automatiquement.</p>
          <div className="grid grid-cols-2 gap-3">
            <SecondaryButton fullWidth onClick={() => setIsLeaveConfirmOpen(false)}>
              Rester
            </SecondaryButton>
            <PrimaryButton fullWidth className="bg-[#ef4444] text-white hover:bg-[#dc2626]" onClick={confirmLeaveSession}>
              Quitter
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      {restTimer.visible ? (
        <div className="fixed inset-0 z-30" onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, visible: false }))}>
          <div className="absolute bottom-24 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2" onClick={(event) => event.stopPropagation()}>
            <div className="surface-card flex items-center justify-between gap-4 p-4">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <svg className="-rotate-90" width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#2a2a2a" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={213.63}
                    strokeDashoffset={213.63 - (213.63 * restTimer.remaining) / restTimer.duration}
                  />
                </svg>
                <span className="absolute text-2xl font-bold text-white">{restTimer.remaining}s</span>
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-white">Repos entre séries</p>
                <p className="mb-3 text-xs text-[#a1a1a1]">Le timer reste non bloquant, tu peux continuer à saisir la séance.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, remaining: Math.max(0, previous.remaining - 15) }))}
                    className="rounded-2xl border border-[#2a2a2a] px-3 py-2 text-sm text-white"
                  >
                    −15s
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, visible: false }))}
                    className="rounded-2xl border border-[#2a2a2a] px-3 py-2 text-sm text-white"
                  >
                    Passer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, remaining: previous.remaining + 15, duration: previous.duration + 15 }))}
                    className="rounded-2xl border border-[#2a2a2a] px-3 py-2 text-sm text-white"
                  >
                    +15s
                  </button>
                </div>
              </div>

              <button type="button" onClick={() => setRestTimer((previous: RestTimerState) => ({ ...previous, visible: false }))} className="self-start text-[#a1a1a1]">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
