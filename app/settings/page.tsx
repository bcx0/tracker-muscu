'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

import Container from '@/components/ui/Container';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import { clearAuthCookies, setAuthCookies } from '@/lib/authCookies';
import { DAY_ORDER, DAY_TO_FRENCH_LABEL, getMuscleGroupLabel, normalizeTrainingDays } from '@/lib/program-generator';
import { getUser, supabase } from '@/lib/supabase';
import { DayOfWeek, Exercise, ExerciseType, MuscleGroup, UserSettings } from '@/types';

const SESSION_OPTIONS = [3, 4, 5, 6];
const REST_TIMER_OPTIONS = [30, 60, 90, 120, 180];
const MUSCLE_OPTIONS = ['Pectoraux', 'Épaules', 'Triceps', 'Dos', 'Biceps', 'Abdominaux'] as const;
const TYPE_OPTIONS: ExerciseType[] = ['compound', 'isolation'];

type ExerciseMuscleOption = (typeof MUSCLE_OPTIONS)[number];

interface SettingsState {
  userId: string;
  settings: UserSettings | null;
  exercises: Exercise[];
}

interface ExerciseFormState {
  name: string;
  muscleLabel: ExerciseMuscleOption;
  type: ExerciseType;
  sets: number;
  rep_range_min: number;
  rep_range_max: number;
}

const DEFAULT_FORM: ExerciseFormState = {
  name: '',
  muscleLabel: 'Pectoraux',
  type: 'compound',
  sets: 3,
  rep_range_min: 8,
  rep_range_max: 12,
};

function mapLabelToMuscleGroup(label: ExerciseMuscleOption): MuscleGroup {
  switch (label) {
    case 'Pectoraux':
      return 'chest';
    case 'Épaules':
      return 'shoulders';
    case 'Triceps':
      return 'triceps';
    case 'Dos':
      return 'back';
    case 'Biceps':
      return 'biceps';
    case 'Abdominaux':
      return 'abs';
  }
}

function inferExerciseMuscleLabel(exercise: Exercise): ExerciseMuscleOption {
  const label = getMuscleGroupLabel(exercise.muscle_group, exercise.name);
  if (label === 'Pectoraux' || label === 'Épaules' || label === 'Triceps' || label === 'Dos' || label === 'Biceps' || label === 'Abdominaux') {
    return label;
  }
  return 'Pectoraux';
}

function buildExercisePayload(userId: string, form: ExerciseFormState, current?: Exercise): Omit<Exercise, 'id'> {
  return {
    user_id: userId,
    name: form.name.trim(),
    muscle_group: mapLabelToMuscleGroup(form.muscleLabel),
    type: form.type,
    sets: form.sets,
    rep_range_min: form.rep_range_min,
    rep_range_max: form.rep_range_max,
    last_weight: current?.last_weight ?? 0,
    last_reps: current?.last_reps ?? form.rep_range_min,
    suggested_weight: current?.suggested_weight ?? 0,
    is_active: true,
    created_at: current?.created_at ?? new Date().toISOString(),
  };
}

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<SettingsState>({ userId: '', settings: null, exercises: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(5);
  const [trainingDays, setTrainingDays] = useState<DayOfWeek[]>([]);
  const [restTimerDuration, setRestTimerDuration] = useState<number>(90);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [resetOpen, setResetOpen] = useState<boolean>(false);
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [form, setForm] = useState<ExerciseFormState>(DEFAULT_FORM);

  useEffect(() => {
    let active = true;

    async function loadSettings(): Promise<void> {
      const { data: userData } = await getUser();
      const user = userData.user;

      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const [{ data: settingsRow }, { data: exerciseRows }] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('exercises').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: true }),
      ]);

      let settings = (settingsRow ?? null) as UserSettings | null;
      if (!settings) {
        const { data: insertedSettings, error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            sessions_per_week: 5,
            training_days: [],
            setup_complete: false,
            current_streak: 0,
            longest_streak: 0,
            total_sessions: 0,
            rest_timer_duration: 90,
          })
          .select()
          .single();

        if (error) {
          toast.error(error.message);
        } else {
          settings = insertedSettings as UserSettings;
        }
      }

      if (active) {
        setState({ userId: user.id, settings, exercises: (exerciseRows ?? []) as Exercise[] });
        setSessionsPerWeek(settings?.sessions_per_week ?? 5);
        setTrainingDays(normalizeTrainingDays((settings?.training_days as string[] | undefined) ?? []));
        setRestTimerDuration(settings?.rest_timer_duration ?? 90);
        setIsLoading(false);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const selectionCount = trainingDays.length;
  const isSelectionValid = selectionCount === sessionsPerWeek;

  const resetForm = (): void => {
    setForm(DEFAULT_FORM);
    setEditingExerciseId(null);
    setIsAddOpen(false);
  };

  const toggleDay = (day: DayOfWeek): void => {
    setTrainingDays((previous: DayOfWeek[]) => {
      if (previous.includes(day)) {
        return previous.filter((value: DayOfWeek) => value !== day);
      }

      if (previous.length >= sessionsPerWeek) {
        toast.error('Le nombre de jours sélectionnés correspond déjà au nombre de séances.');
        return previous;
      }

      return [...previous, day].sort((a: DayOfWeek, b: DayOfWeek) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    });
  };

  const persistSettings = async (setupComplete: boolean): Promise<boolean> => {
    if (!state.userId) {
      return false;
    }

    const { data: updatedSettings, error } = await supabase
      .from('user_settings')
      .update({
        sessions_per_week: sessionsPerWeek,
        training_days: trainingDays,
        setup_complete: setupComplete,
        rest_timer_duration: restTimerDuration,
      })
      .eq('user_id', state.userId)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return false;
    }

    setState((previous: SettingsState) => ({ ...previous, settings: updatedSettings as UserSettings }));
    setAuthCookies(true, Boolean((updatedSettings as UserSettings).setup_complete));
    toast.success('Réglages enregistrés.');
    return true;
  };

  const refreshExercises = async (): Promise<void> => {
    const { data: exerciseRows } = await supabase.from('exercises').select('*').eq('user_id', state.userId).eq('is_active', true).order('created_at', { ascending: true });
    setState((previous: SettingsState) => ({ ...previous, exercises: (exerciseRows ?? []) as Exercise[] }));
  };

  const generateProgram = async (): Promise<void> => {
    if (!isSelectionValid) {
      toast.error('Le nombre de jours doit correspondre au nombre de séances.');
      return;
    }

    const settingsSaved = await persistSettings(true);
    if (!settingsSaved) {
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      toast.error('Session Supabase introuvable.');
      return;
    }

    setIsGenerating(true);
    const response = await fetch('/api/generate-program', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({}),
    });
    setIsGenerating(false);

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(payload.error ?? 'Impossible de générer le programme.');
      return;
    }

    await refreshExercises();
    toast.success('Programme généré.');
    router.push('/today');
  };

  const saveExercise = async (): Promise<void> => {
    if (!state.userId) {
      return;
    }

    if (!form.name.trim()) {
      toast.error('Le nom est obligatoire.');
      return;
    }

    if (form.rep_range_max < form.rep_range_min) {
      toast.error('Le maximum de répétitions doit être supérieur ou égal au minimum.');
      return;
    }

    if (form.sets < 1 || form.sets > 6) {
      toast.error('Le nombre de séries doit être compris entre 1 et 6.');
      return;
    }

    const current = state.exercises.find((exercise: Exercise) => exercise.id === editingExerciseId);
    const payload = buildExercisePayload(state.userId, form, current);

    if (editingExerciseId) {
      const { error } = await supabase.from('exercises').update(payload).eq('id', editingExerciseId);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('exercises').insert({ id: uuidv4(), ...payload });
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    await refreshExercises();
    resetForm();
    toast.success('Bibliothèque mise à jour — Régénère ton programme pour appliquer les changements');
  };

  const startEdit = (exercise: Exercise): void => {
    setEditingExerciseId(exercise.id);
    setIsAddOpen(false);
    setForm({
      name: exercise.name,
      muscleLabel: inferExerciseMuscleLabel(exercise),
      type: exercise.type,
      sets: exercise.sets,
      rep_range_min: exercise.rep_range_min,
      rep_range_max: exercise.rep_range_max,
    });
  };

  const handleDeleteExercise = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }

    const { error } = await supabase.from('exercises').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    await refreshExercises();
    setDeleteTarget(null);
    toast.success('Bibliothèque mise à jour — Régénère ton programme pour appliquer les changements');
  };

  const handleResetProgress = async (): Promise<void> => {
    if (!state.userId) {
      return;
    }

    const { data: sessionRows } = await supabase.from('workout_sessions').select('id').eq('user_id', state.userId);
    const sessionIds = ((sessionRows ?? []) as Array<{ id: string }>).map((session) => session.id);

    if (sessionIds.length > 0) {
      const { error: logError } = await supabase.from('exercise_logs').delete().in('session_id', sessionIds);
      if (logError) {
        toast.error(logError.message);
        return;
      }
    }

    const { error: prError } = await supabase.from('personal_records').delete().eq('user_id', state.userId);
    if (prError) {
      toast.error(prError.message);
      return;
    }

    const { error: sessionError } = await supabase
      .from('workout_sessions')
      .update({ status: 'upcoming', points_earned: 0, completed_at: null })
      .eq('user_id', state.userId)
      .neq('status', 'rest');

    if (sessionError) {
      toast.error(sessionError.message);
      return;
    }

    const { error: settingsError } = await supabase
      .from('user_settings')
      .update({ current_streak: 0, longest_streak: 0, total_sessions: 0 })
      .eq('user_id', state.userId);

    if (settingsError) {
      toast.error(settingsError.message);
      return;
    }

    toast.success('Progression réinitialisée.');
    setResetOpen(false);
  };

  const handleSignOut = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }

    clearAuthCookies();
    router.push('/auth');
  };

  if (isLoading) {
    return (
      <Container className="space-y-4 pt-4">
        <div className="h-20 animate-pulse rounded-2xl bg-[#141414]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#141414]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#141414]" />
      </Container>
    );
  }

  if (!state.settings) {
    return (
      <Container className="pt-8">
        <EmptyState icon="⚙️" title="Réglages indisponibles" description="Reconnecte-toi pour accéder à ton profil." />
      </Container>
    );
  }

  return (
    <Container className="space-y-4 pt-6">
      <header className="space-y-1">
        <p className="text-3xl font-bold text-white">Réglages</p>
        <p className="text-sm text-[#a1a1a1]">Personnalise ton planning, ton timer de repos et ta bibliothèque.</p>
      </header>

      <section className="surface-card space-y-4 p-4">
        <div>
          <p className="text-lg font-bold text-white">Programme hebdomadaire</p>
          <p className="text-sm text-[#a1a1a1]">Choisis ton volume d'entraînement et les jours correspondants.</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-white">Séances par semaine</p>
          <div className="flex flex-wrap gap-2">
            {SESSION_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setSessionsPerWeek(option);
                  setTrainingDays((previous: DayOfWeek[]) => previous.slice(0, option));
                }}
                className={[
                  'rounded-full border px-4 py-2 text-sm transition-colors duration-200',
                  sessionsPerWeek === option ? 'border-white bg-white text-black' : 'border-[#2a2a2a] bg-[#141414] text-[#a1a1a1] hover:border-[#3a3a3a]',
                ].join(' ')}
              >
                {option} séances
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-white">Jours d'entraînement</p>
          <div className="flex flex-wrap gap-2">
            {DAY_ORDER.map((day: DayOfWeek) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={[
                  'rounded-full border px-4 py-2 text-sm transition-colors duration-200',
                  trainingDays.includes(day) ? 'border-white bg-white text-black' : 'border-[#2a2a2a] bg-[#141414] text-[#a1a1a1] hover:border-[#3a3a3a]',
                ].join(' ')}
              >
                {DAY_TO_FRENCH_LABEL[day]}
              </button>
            ))}
          </div>
          <p className={isSelectionValid ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}>
            {selectionCount} / {sessionsPerWeek} jours sélectionnés
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <PrimaryButton fullWidth onClick={() => void generateProgram()} disabled={isGenerating || !isSelectionValid}>
            {isGenerating ? 'Génération...' : 'Générer ou régénérer le programme'}
          </PrimaryButton>
          <SecondaryButton fullWidth onClick={() => void persistSettings(state.settings?.setup_complete ?? false)}>
            Enregistrer sans régénérer
          </SecondaryButton>
        </div>
      </section>

      <section className="surface-card space-y-4 p-4">
        <div>
          <p className="text-lg font-bold text-white">Durée du repos entre séries</p>
          <p className="text-sm text-[#a1a1a1]">Réglage appliqué au timer flottant pendant la séance.</p>
        </div>

        <input
          type="range"
          min={0}
          max={REST_TIMER_OPTIONS.length - 1}
          step={1}
          value={REST_TIMER_OPTIONS.indexOf(restTimerDuration)}
          onChange={(event) => setRestTimerDuration(REST_TIMER_OPTIONS[Number(event.target.value)])}
          className="w-full"
        />

        <div className="flex flex-wrap gap-2">
          {REST_TIMER_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRestTimerDuration(value)}
              className={[
                'rounded-full border px-4 py-2 text-sm transition-colors duration-200',
                restTimerDuration === value ? 'border-white bg-white text-black' : 'border-[#2a2a2a] bg-[#141414] text-[#a1a1a1] hover:border-[#3a3a3a]',
              ].join(' ')}
            >
              {value}s
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-white">Bibliothèque d'exercices</p>
            <p className="text-sm text-[#a1a1a1]">Ajoute, modifie ou supprime les mouvements de ta bibliothèque réelle.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingExerciseId(null);
              setForm(DEFAULT_FORM);
              setIsAddOpen((value) => !value);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414] text-white transition-colors duration-200 hover:border-[#3a3a3a]"
          >
            {isAddOpen ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>

        {isAddOpen ? (
          <div className="space-y-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4">
            <ExerciseForm form={form} setForm={setForm} />
            <div className="grid grid-cols-2 gap-3">
              <PrimaryButton fullWidth onClick={() => void saveExercise()}>
                Sauvegarder
              </PrimaryButton>
              <SecondaryButton fullWidth onClick={resetForm}>
                Annuler
              </SecondaryButton>
            </div>
          </div>
        ) : null}

        {state.exercises.length === 0 ? (
          <p className="text-sm text-[#a1a1a1]">Aucun exercice actif pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {state.exercises.map((exercise: Exercise) => (
              <div key={exercise.id} className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-4">
                {editingExerciseId === exercise.id ? (
                  <div className="space-y-3">
                    <ExerciseForm form={form} setForm={setForm} />
                    <div className="grid grid-cols-2 gap-3">
                      <PrimaryButton fullWidth onClick={() => void saveExercise()}>
                        Enregistrer
                      </PrimaryButton>
                      <SecondaryButton fullWidth onClick={resetForm}>
                        Annuler
                      </SecondaryButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-semibold text-white">{exercise.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-[#2a2a2a] bg-[#141414] px-3 py-1 text-xs text-white">{inferExerciseMuscleLabel(exercise)}</span>
                          <span className="rounded-full border border-[#2a2a2a] bg-[#141414] px-3 py-1 text-xs text-[#a1a1a1]">{exercise.type === 'compound' ? 'compound' : 'isolation'}</span>
                        </div>
                        <p className="text-sm text-[#a1a1a1]">
                          {exercise.sets} séries × {exercise.rep_range_min}-{exercise.rep_range_max} reps
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(exercise)}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414] text-white transition-colors duration-200 hover:border-[#3a3a3a]"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exercise)}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 transition-colors duration-200 hover:border-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface-card space-y-3 p-4">
        <p className="text-lg font-bold text-white">Compte</p>
        <SecondaryButton fullWidth onClick={() => void handleSignOut()}>
          Se déconnecter
        </SecondaryButton>
        <SecondaryButton fullWidth className="border-red-500/30 text-red-300 hover:border-red-400" onClick={() => setResetOpen(true)}>
          Réinitialiser la progression
        </SecondaryButton>
      </section>

      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Supprimer l'exercice ?">
        <div className="space-y-4">
          <p className="text-sm text-[#a1a1a1]">Cette action retirera {deleteTarget?.name ?? 'cet exercice'} de ta bibliothèque.</p>
          <div className="grid grid-cols-2 gap-3">
            <PrimaryButton fullWidth onClick={() => void handleDeleteExercise()}>
              Supprimer
            </PrimaryButton>
            <SecondaryButton fullWidth onClick={() => setDeleteTarget(null)}>
              Annuler
            </SecondaryButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={resetOpen} onClose={() => setResetOpen(false)} title="Réinitialiser la progression ?">
        <div className="space-y-4">
          <p className="text-sm text-[#a1a1a1]">Cette action supprime les logs, les PRs et remet les streaks à zéro.</p>
          <div className="grid grid-cols-2 gap-3">
            <PrimaryButton fullWidth onClick={() => void handleResetProgress()}>
              Confirmer
            </PrimaryButton>
            <SecondaryButton fullWidth onClick={() => setResetOpen(false)}>
              Annuler
            </SecondaryButton>
          </div>
        </div>
      </Modal>
    </Container>
  );
}

interface ExerciseFormProps {
  form: ExerciseFormState;
  setForm: Dispatch<SetStateAction<ExerciseFormState>>;
}

function ExerciseForm({ form, setForm }: ExerciseFormProps): JSX.Element {
  return (
    <div className="space-y-3">
      <label className="block space-y-2">
        <span className="text-sm text-[#a1a1a1]">Nom</span>
        <input
          type="text"
          value={form.name}
          onChange={(event) => setForm((previous: ExerciseFormState) => ({ ...previous, name: event.target.value }))}
          className="min-h-[48px] w-full rounded-2xl border border-[#2a2a2a] bg-[#0a0a0a] px-4 text-white outline-none transition-colors duration-200 focus:border-[#3a3a3a]"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm text-[#a1a1a1]">Groupe musculaire</span>
          <select
            value={form.muscleLabel}
            onChange={(event) => setForm((previous: ExerciseFormState) => ({ ...previous, muscleLabel: event.target.value as ExerciseMuscleOption }))}
            className="min-h-[48px] w-full rounded-2xl border border-[#2a2a2a] bg-[#0a0a0a] px-4 text-white outline-none transition-colors duration-200 focus:border-[#3a3a3a]"
          >
            {MUSCLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-[#a1a1a1]">Type</span>
          <select
            value={form.type}
            onChange={(event) => setForm((previous: ExerciseFormState) => ({ ...previous, type: event.target.value as ExerciseType }))}
            className="min-h-[48px] w-full rounded-2xl border border-[#2a2a2a] bg-[#0a0a0a] px-4 text-white outline-none transition-colors duration-200 focus:border-[#3a3a3a]"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumberInput label="Séries" value={form.sets} min={1} max={6} onChange={(value) => setForm((previous: ExerciseFormState) => ({ ...previous, sets: value }))} />
        <NumberInput label="Rep min" value={form.rep_range_min} min={1} max={60} onChange={(value) => setForm((previous: ExerciseFormState) => ({ ...previous, rep_range_min: value }))} />
        <NumberInput label="Rep max" value={form.rep_range_max} min={1} max={60} onChange={(value) => setForm((previous: ExerciseFormState) => ({ ...previous, rep_range_max: value }))} />
      </div>
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumberInput({ label, value, min, max, onChange }: NumberInputProps): JSX.Element {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-[#a1a1a1]">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))}
        className="min-h-[48px] w-full rounded-2xl border border-[#2a2a2a] bg-[#0a0a0a] px-4 text-white outline-none transition-colors duration-200 focus:border-[#3a3a3a]"
      />
    </label>
  );
}
