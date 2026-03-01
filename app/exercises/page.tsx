'use client';

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

import Container from '@/components/ui/Container';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import SectionTitle from '@/components/ui/SectionTitle';
import { getUser, supabase } from '@/lib/supabase';
import { Exercise, ExerciseType, MuscleGroup } from '@/types';

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  legs: 'Jambes',
  shoulders: 'Épaules',
  arms: 'Bras',
  abs: 'Abdominaux',
  other: 'Autres',
};

const MUSCLE_OPTIONS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'arms', 'abs', 'other'];
const TYPE_OPTIONS: ExerciseType[] = ['compound', 'isolation'];

interface ExerciseFormState {
  name: string;
  muscle_group: MuscleGroup;
  type: ExerciseType;
  sets: number;
  rep_range_min: number;
  rep_range_max: number;
  last_weight: number;
  last_reps: number;
}

const DEFAULT_FORM: ExerciseFormState = {
  name: '',
  muscle_group: 'chest',
  type: 'compound',
  sets: 3,
  rep_range_min: 8,
  rep_range_max: 12,
  last_weight: 0,
  last_reps: 8,
};

export default function ExercisesPage(): JSX.Element {
  const [userId, setUserId] = useState<string>('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [form, setForm] = useState<ExerciseFormState>(DEFAULT_FORM);

  useEffect(() => {
    let active = true;

    async function loadExercises(): Promise<void> {
      const { data } = await getUser();
      const user = data.user;
      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const { data: rows, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) {
        toast.error(error.message);
      }

      if (active) {
        setUserId(user.id);
        setExercises((rows ?? []) as Exercise[]);
        setIsLoading(false);
      }
    }

    void loadExercises();
    return () => {
      active = false;
    };
  }, []);

  const groupedExercises = useMemo(() => {
    return MUSCLE_OPTIONS.reduce<Record<MuscleGroup, Exercise[]>>(
      (accumulator, muscle) => {
        accumulator[muscle] = exercises.filter((exercise: Exercise) => exercise.muscle_group === muscle);
        return accumulator;
      },
      {
        chest: [],
        back: [],
        legs: [],
        shoulders: [],
        biceps: [],
        triceps: [],
        arms: [],
        abs: [],
        other: [],
      },
    );
  }, [exercises]);

  const openAddModal = (): void => {
    setEditingExercise(null);
    setForm(DEFAULT_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (exercise: Exercise): void => {
    setEditingExercise(exercise);
    setForm({
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      type: exercise.type,
      sets: exercise.sets,
      rep_range_min: exercise.rep_range_min,
      rep_range_max: exercise.rep_range_max,
      last_weight: exercise.last_weight,
      last_reps: exercise.last_reps,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error('Le nom est obligatoire');
      return;
    }
    if (form.rep_range_max < form.rep_range_min) {
      toast.error('Le max de répétitions doit être supérieur ou égal au min');
      return;
    }
    if (!userId) {
      toast.error('Utilisateur introuvable');
      return;
    }

    const payload = {
      name: trimmedName,
      muscle_group: form.muscle_group,
      type: form.type,
      sets: form.sets,
      rep_range_min: form.rep_range_min,
      rep_range_max: form.rep_range_max,
      last_weight: form.last_weight,
      last_reps: form.last_reps,
      suggested_weight: editingExercise?.suggested_weight ?? form.last_weight,
      is_active: true,
    };

    if (editingExercise) {
      const { data: updated, error } = await supabase.from('exercises').update(payload).eq('id', editingExercise.id).select().single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setExercises((prev: Exercise[]) => prev.map((exercise: Exercise) => (exercise.id === editingExercise.id ? (updated as Exercise) : exercise)));
    } else {
      const { data: inserted, error } = await supabase
        .from('exercises')
        .insert({
          id: uuidv4(),
          user_id: userId,
          created_at: new Date().toISOString(),
          ...payload,
        })
        .select()
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }
      setExercises((prev: Exercise[]) => [...prev, inserted as Exercise]);
    }

    setIsModalOpen(false);
    setEditingExercise(null);
    setForm(DEFAULT_FORM);
    toast.success('Exercice sauvegardé !');
  };

  const handleDuplicate = async (exercise: Exercise): Promise<void> => {
    if (!userId) {
      toast.error('Utilisateur introuvable');
      return;
    }

    const { data: inserted, error } = await supabase
      .from('exercises')
      .insert({
        ...exercise,
        id: uuidv4(),
        user_id: userId,
        name: `${exercise.name} (copie)`,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setExercises((prev: Exercise[]) => [...prev, inserted as Exercise]);
    toast.success('Exercice dupliqué');
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }

    const { error } = await supabase.from('exercises').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    setExercises((prev: Exercise[]) => prev.filter((exercise: Exercise) => exercise.id !== deleteTarget.id));
    toast.success('Exercice supprimé');
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Mes exercices</h1>
          <button type="button" onClick={openAddModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-xl text-white">
            +
          </button>
        </div>
      </header>

      <Container className="space-y-4 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-white" />
            <div className="h-24 animate-pulse rounded-2xl bg-white" />
          </div>
        ) : exercises.length === 0 ? (
          <EmptyState icon="🏋️" title="Aucun exercice" description="Ajoute tes premiers mouvements pour démarrer ton programme." action={{ label: 'Ajouter un exercice', onClick: openAddModal }} />
        ) : (
          MUSCLE_OPTIONS.map((muscle: MuscleGroup) => {
            const items = groupedExercises[muscle];
            if (items.length === 0) {
              return null;
            }

            return (
              <section key={muscle} className="space-y-2">
                <SectionTitle>{MUSCLE_LABELS[muscle]}</SectionTitle>
                <div className="space-y-3">
                  {items.map((exercise: Exercise) => (
                    <Card key={exercise.id} className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold text-gray-900">{exercise.name}</h2>
                          <p className="text-sm text-gray-500">{exercise.last_weight}kg × {exercise.last_reps} reps · {exercise.sets} séries</p>
                          {exercise.suggested_weight > exercise.last_weight ? <p className="text-sm text-green-600">→ {exercise.suggested_weight}kg suggéré</p> : null}
                        </div>
                        <span className={exercise.type === 'compound' ? 'rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700' : 'rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600'}>
                          {exercise.type === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <button type="button" onClick={() => openEditModal(exercise)} className="text-gray-500">Modifier</button>
                        <button type="button" onClick={() => void handleDuplicate(exercise)} className="text-gray-500">Dupliquer</button>
                        <button type="button" onClick={() => setDeleteTarget(exercise)} className="text-red-400">🗑</button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </Container>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExercise ? 'Modifier' : 'Ajouter'}>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-gray-500">Nom</span>
            <input type="text" value={form.name} onChange={(event) => setForm((prev: ExerciseFormState) => ({ ...prev, name: event.target.value }))} className="min-h-[48px] w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-black" />
          </label>

          <div className="space-y-2">
            <span className="text-sm text-gray-500">Groupe musculaire</span>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_OPTIONS.map((muscle: MuscleGroup) => (
                <button key={muscle} type="button" onClick={() => setForm((prev: ExerciseFormState) => ({ ...prev, muscle_group: muscle }))} className={['rounded-full px-3 py-2 text-sm', form.muscle_group === muscle ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'].join(' ')}>
                  {MUSCLE_LABELS[muscle]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-gray-500">Type</span>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((type: ExerciseType) => (
                <button key={type} type="button" onClick={() => setForm((prev: ExerciseFormState) => ({ ...prev, type }))} className={['rounded-full px-3 py-2 text-sm', form.type === type ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'].join(' ')}>
                  {type === 'compound' ? 'Polyarticulaire' : 'Isolation'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Séries" value={form.sets} onChange={(value: number) => setForm((prev: ExerciseFormState) => ({ ...prev, sets: value }))} min={1} max={10} />
            <NumberField label="Poids de départ (kg)" value={form.last_weight} onChange={(value: number) => setForm((prev: ExerciseFormState) => ({ ...prev, last_weight: value }))} min={0} step={2.5} />
            <NumberField label="Reps min" value={form.rep_range_min} onChange={(value: number) => setForm((prev: ExerciseFormState) => ({ ...prev, rep_range_min: value }))} min={1} />
            <NumberField label="Reps max" value={form.rep_range_max} onChange={(value: number) => setForm((prev: ExerciseFormState) => ({ ...prev, rep_range_max: value }))} min={1} />
            <NumberField label="Reps de départ" value={form.last_reps} onChange={(value: number) => setForm((prev: ExerciseFormState) => ({ ...prev, last_reps: value }))} min={1} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PrimaryButton fullWidth onClick={() => void handleSave()}>Sauvegarder</PrimaryButton>
            <SecondaryButton fullWidth onClick={() => setIsModalOpen(false)}>Annuler</SecondaryButton>
          </div>
        </div>
      </Modal>

      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Supprimer l'exercice ?">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Cette action retire {deleteTarget?.name ?? 'cet exercice'} de ta bibliothèque.</p>
          <div className="grid grid-cols-2 gap-3">
            <PrimaryButton fullWidth onClick={() => void handleDelete()}>Supprimer</PrimaryButton>
            <SecondaryButton fullWidth onClick={() => setDeleteTarget(null)}>Annuler</SecondaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  step?: number;
}

function NumberField({ label, value, onChange, min, max, step = 1 }: NumberFieldProps): JSX.Element {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-gray-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isNaN(nextValue)) {
            return;
          }
          onChange(nextValue);
        }}
        className="min-h-[48px] w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-black"
      />
    </label>
  );
}
