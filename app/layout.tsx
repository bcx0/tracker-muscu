'use client';

import './globals.css';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  const pathname = usePathname();
  const hideNav = pathname === '/auth' || pathname === '/onboarding';

  return (
    <html lang="fr">
      <body className="bg-[#0a0a0a] font-sans text-white">
        <AuthGuard>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#141414',
                color: '#ffffff',
                border: '1px solid #2a2a2a',
              },
            }}
          />
          <div className={hideNav ? 'page-enter' : 'page-enter pb-24'}>{children}</div>
          {hideNav ? null : <BottomNav />}
        </AuthGuard>
      </body>
    </html>
  );
}
