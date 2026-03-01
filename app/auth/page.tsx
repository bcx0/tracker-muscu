'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import Container from '@/components/ui/Container';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import { setAuthCookies } from '@/lib/authCookies';
import { getUser, supabase } from '@/lib/supabase';
import { UserSettings } from '@/types';

export default function AuthPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSignup, setIsSignup] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function checkSession(): Promise<void> {
      const { data } = await getUser();
      if (!data.user) {
        return;
      }

      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', data.user.id).maybeSingle();
      const userSettings = (settings ?? null) as UserSettings | null;
      setAuthCookies(true, Boolean(userSettings?.setup_complete));
      router.replace(userSettings?.setup_complete ? '/today' : '/onboarding');
    }

    void checkSession();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);

    const action = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (action.error) {
      toast.error(action.error.message);
      return;
    }

    toast.success(isSignup ? 'Compte créé' : 'Connexion réussie');
    const userId = action.data.user?.id;

    if (userId) {
      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
      const userSettings = (settings ?? null) as UserSettings | null;
      setAuthCookies(true, Boolean(userSettings?.setup_complete));
      router.push(userSettings?.setup_complete ? '/today' : '/onboarding');
      return;
    }

    setAuthCookies(true, false);
    router.push('/onboarding');
  };

  return (
    <Container className="pt-12 pb-12">
      <Card className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-white">Muscu Tracker</h1>
          <p className="text-sm text-[#a1a1a1]">Suivi musculation simple, rapide et centré sur ta progression.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton fullWidth className={!isSignup ? 'border-white bg-white text-black hover:border-white' : ''} onClick={() => setIsSignup(false)}>
            Se connecter
          </SecondaryButton>
          <SecondaryButton fullWidth className={isSignup ? 'border-white bg-white text-black hover:border-white' : ''} onClick={() => setIsSignup(true)}>
            Créer un compte
          </SecondaryButton>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-[#a1a1a1]">Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="min-h-[48px] w-full px-4" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-[#a1a1a1]">Mot de passe</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="min-h-[48px] w-full px-4" />
          </label>
          <PrimaryButton type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Chargement...' : isSignup ? 'Créer mon compte' : 'Se connecter'}
          </PrimaryButton>
        </form>
      </Card>
    </Container>
  );
}
