'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { setAuthCookies } from '@/lib/authCookies';
import { DAY_ORDER, DAY_TO_FRENCH_LABEL } from '@/lib/program-generator';
import { getUser, supabase } from '@/lib/supabase';
import { DayOfWeek, UserLevel, UserObjective, UserSettings } from '@/types';

type Step = 1 | 2 | 3 | 4;

interface OptionCard<TValue extends string> {
  value: TValue;
  emoji: string;
  title: string;
  description: string;
}

const OBJECTIVES: Array<OptionCard<UserObjective>> = [
  { value: 'masse', emoji: '🏋️', title: 'Prise de masse', description: 'Gagner du muscle et de la force' },
  { value: 'seche', emoji: '🔥', title: 'Sèche', description: 'Perdre du gras en conservant le muscle' },
  { value: 'maintien', emoji: '⚖️', title: 'Maintien', description: 'Rester en forme et progresser doucement' },
];

const LEVELS: Array<OptionCard<UserLevel>> = [
  { value: 'debutant', emoji: '🌱', title: 'Débutant', description: "Moins de 1 an d'entraînement" },
  { value: 'intermediaire', emoji: '⚡', title: 'Intermédiaire', description: "1 à 3 ans d'entraînement" },
  { value: 'avance', emoji: '🔱', title: 'Avancé', description: "Plus de 3 ans d'entraînement" },
];

function ProgressDots({ step }: { step: Step }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4].map((value) => (
        <span key={value} className={`h-2.5 w-2.5 rounded-full ${value <= step ? 'bg-white' : 'bg-[#2a2a2a]'}`} />
      ))}
    </div>
  );
}

function SelectableCard<TValue extends string>({
  option,
  selected,
  onSelect,
}: {
  option: OptionCard<TValue>;
  selected: boolean;
  onSelect: (value: TValue) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={[
        'w-full rounded-2xl border p-5 text-left transition-all duration-200',
        selected ? 'border-[#ef4444] bg-[#1a0a0a]' : 'border-[#2a2a2a] bg-[#1c1c1c] hover:border-[#3a3a3a]',
      ].join(' ')}
    >
      <div className="mb-3 text-3xl">{option.emoji}</div>
      <p className="text-lg font-bold text-white">{option.title}</p>
      <p className="mt-2 text-sm text-[#a1a1a1]">{option.description}</p>
    </button>
  );
}

export default function OnboardingPage(): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [objective, setObjective] = useState<UserObjective | null>(null);
  const [level, setLevel] = useState<UserLevel | null>(null);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showMaxWarning, setShowMaxWarning] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function loadUserState(): Promise<void> {
      const { data } = await getUser();
      const user = data.user;

      if (!user) {
        router.replace('/auth');
        return;
      }

      const { data: settingsRow } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      let settings = (settingsRow ?? null) as UserSettings | null;

      if (!settings) {
        const { data: inserted } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            sessions_per_week: 0,
            training_days: [],
            setup_complete: false,
            current_streak: 0,
            longest_streak: 0,
            total_sessions: 0,
            rest_timer_duration: 90,
            objective: 'masse',
            level: 'intermediaire',
          })
          .select()
          .single();

        settings = (inserted ?? null) as UserSettings | null;
      }

      if (settings?.setup_complete) {
        setAuthCookies(true, true);
        router.replace('/today');
        return;
      }

      if (active) {
        setObjective(settings?.objective ?? null);
        setLevel(settings?.level ?? null);
        setSelectedDays(settings?.training_days ?? []);
        setIsLoading(false);
      }
    }

    void loadUserState();
    return () => {
      active = false;
    };
  }, [router]);

  const translateClass = useMemo(() => {
    switch (step) {
      case 1:
        return 'translate-x-0';
      case 2:
        return '-translate-x-full';
      case 3:
        return '-translate-x-[200%]';
      case 4:
        return '-translate-x-[300%]';
      default:
        return 'translate-x-0';
    }
  }, [step]);

  const progressPercent = step * 25;

  const toggleDay = (day: DayOfWeek): void => {
    setSelectedDays((previous: DayOfWeek[]) => {
      if (previous.includes(day)) {
        setShowMaxWarning(false);
        return previous.filter((value: DayOfWeek) => value !== day);
      }

      if (previous.length >= 6) {
        setShowMaxWarning(true);
        return previous;
      }

      setShowMaxWarning(false);
      return [...previous, day];
    });
  };

  const handleGenerateProgram = async (): Promise<void> => {
    if (!objective || !level || selectedDays.length < 2) {
      return;
    }

    setIsSubmitting(true);

    const { data: userData } = await getUser();
    const user = userData.user;

    if (!user) {
      setIsSubmitting(false);
      router.replace('/auth');
      return;
    }

    const { error: updateSettingsError } = await supabase
      .from('user_settings')
      .update({
        training_days: selectedDays,
        sessions_per_week: selectedDays.length,
        setup_complete: true,
        objective,
        level,
      })
      .eq('user_id', user.id);

    if (updateSettingsError) {
      setIsSubmitting(false);
      toast.error(updateSettingsError.message);
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      setIsSubmitting(false);
      toast.error('Session Supabase introuvable');
      return;
    }

    const response = await fetch('/api/generate-program', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(payload.error ?? 'Impossible de générer le programme');
      await supabase.from('user_settings').update({ setup_complete: false }).eq('user_id', user.id);
      setAuthCookies(true, false);
      return;
    }

    setAuthCookies(true, true);
    toast.success('Programme créé ! Bonne séance 🚀');
    router.replace('/today');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2a2a2a] border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#0a0a0a] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((previous) => (previous > 1 ? ((previous - 1) as Step) : previous))}
              className={`rounded-full border border-[#2a2a2a] p-2 ${step === 1 ? 'invisible' : 'visible'}`}
            >
              <ArrowLeft size={18} />
            </button>
            <ProgressDots step={step} />
            <div className="w-9" />
          </div>
          <div className="h-2 rounded-full bg-[#1c1c1c]">
            <div className="h-full rounded-full bg-white transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className={`flex h-full w-[400%] transform transition-all duration-300 ease-out ${translateClass}`}>
            <section className="flex w-full shrink-0 flex-col justify-center">
              <div className="space-y-6 text-center">
                <div className="text-7xl">💪</div>
                <div className="space-y-3">
                  <h1 className="text-4xl font-bold text-white">Bienvenue sur Muscu Tracker</h1>
                  <p className="text-base text-[#a1a1a1]">On va construire ton programme en 4 étapes</p>
                </div>
              </div>
            </section>

            <section className="flex w-full shrink-0 flex-col justify-center">
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white">Quel est ton objectif ?</h2>
                </div>
                <div className="space-y-3">
                  {OBJECTIVES.map((option) => (
                    <SelectableCard key={option.value} option={option} selected={objective === option.value} onSelect={setObjective} />
                  ))}
                </div>
              </div>
            </section>

            <section className="flex w-full shrink-0 flex-col justify-center">
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white">Quel est ton niveau ?</h2>
                </div>
                <div className="space-y-3">
                  {LEVELS.map((option) => (
                    <SelectableCard key={option.value} option={option} selected={level === option.value} onSelect={setLevel} />
                  ))}
                </div>
              </div>
            </section>

            <section className="flex w-full shrink-0 flex-col justify-center">
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white">Combien de jours par semaine ?</h2>
                  <p className="text-sm text-[#a1a1a1]">Sélectionne tes jours disponibles</p>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAY_ORDER.map((day: DayOfWeek) => {
                    const selected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={[
                          'rounded-2xl border px-3 py-3 text-sm font-medium transition-colors duration-200',
                          selected ? 'border-[#ef4444] bg-[#ef4444] text-white' : 'border-[#2a2a2a] bg-[#1c1c1c] text-[#a1a1a1]',
                        ].join(' ')}
                      >
                        {DAY_TO_FRENCH_LABEL[day]}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-white">{selectedDays.length} jours sélectionnés</p>
                  {showMaxWarning ? <p className="text-xs text-amber-300">6 jours maximum recommandés</p> : null}
                  {selectedDays.length < 2 ? <p className="text-xs text-[#a1a1a1]">Sélectionne au moins 2 jours pour générer un programme.</p> : null}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="pt-6">
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-[52px] w-full rounded-2xl bg-white px-6 py-3 text-base font-bold text-black transition-transform duration-200 active:scale-[0.97]"
            >
              Commencer →
            </button>
          ) : null}

          {step === 2 ? (
            <button
              type="button"
              disabled={!objective}
              onClick={() => setStep(3)}
              className="min-h-[52px] w-full rounded-2xl bg-white px-6 py-3 text-base font-bold text-black transition-transform duration-200 disabled:opacity-40"
            >
              Suivant →
            </button>
          ) : null}

          {step === 3 ? (
            <button
              type="button"
              disabled={!level}
              onClick={() => setStep(4)}
              className="min-h-[52px] w-full rounded-2xl bg-white px-6 py-3 text-base font-bold text-black transition-transform duration-200 disabled:opacity-40"
            >
              Suivant →
            </button>
          ) : null}

          {step === 4 ? (
            <button
              type="button"
              disabled={selectedDays.length < 2 || isSubmitting}
              onClick={() => void handleGenerateProgram()}
              className="min-h-[52px] w-full rounded-2xl bg-white px-6 py-3 text-base font-bold text-black transition-transform duration-200 disabled:opacity-40"
            >
              {isSubmitting ? 'Génération de ton programme...' : 'Générer mon programme →'}
            </button>
          ) : null}
        </div>

        {isSubmitting ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0a]/90">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2a2a2a] border-t-white" />
              <p className="text-sm text-[#a1a1a1]">Génération de ton programme...</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
