'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { clearAuthCookies, setAuthCookies } from '@/lib/authCookies';
import { getUser, supabase } from '@/lib/supabase';
import { UserSettings } from '@/types';

interface AuthGuardProps {
  children: ReactNode;
}

const PUBLIC_PATHS = new Set(['/auth']);

export default function AuthGuard({ children }: AuthGuardProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    async function checkAuth(): Promise<void> {
      if (PUBLIC_PATHS.has(pathname)) {
        if (active) {
          setIsChecking(false);
        }
        return;
      }

      const { data } = await getUser();
      const user = data.user;

      if (!user) {
        clearAuthCookies();
        router.replace('/auth');
        if (active) {
          setIsChecking(false);
        }
        return;
      }

      const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      const userSettings = (settings ?? null) as UserSettings | null;
      setAuthCookies(true, Boolean(userSettings?.setup_complete));

      if (userSettings && !userSettings.setup_complete && pathname !== '/onboarding') {
        router.replace('/onboarding');
      } else if (userSettings?.setup_complete && pathname === '/onboarding') {
        router.replace('/today');
      }

      if (active) {
        setIsChecking(false);
      }
    }

    void checkAuth();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (isChecking && !PUBLIC_PATHS.has(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2a2a2a] border-t-white" />
      </div>
    );
  }

  return <>{children}</>;
}
