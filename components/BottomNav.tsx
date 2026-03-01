'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Calendar, Dumbbell, Play, Settings, TrendingUp } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: typeof Dumbbell;
  accent: string;
}

const ITEMS: NavItem[] = [
  { href: '/today', label: "Aujourd'hui", match: (pathname: string) => pathname === '/' || pathname.startsWith('/today'), icon: Dumbbell, accent: 'from-red-500 to-red-600' },
  { href: '/week', label: 'Calendrier', match: (pathname: string) => pathname.startsWith('/week'), icon: Calendar, accent: 'from-blue-500 to-blue-600' },
  { href: '/today', label: 'Séance', match: (pathname: string) => pathname.startsWith('/session'), icon: Play, accent: 'from-green-500 to-green-600' },
  { href: '/progression', label: 'Progression', match: (pathname: string) => pathname.startsWith('/progression') || pathname.startsWith('/progress'), icon: TrendingUp, accent: 'from-amber-500 to-amber-600' },
  { href: '/rapport', label: 'Rapport', match: (pathname: string) => pathname.startsWith('/rapport'), icon: BarChart3, accent: 'from-orange-500 to-amber-600' },
  { href: '/settings', label: 'Réglages', match: (pathname: string) => pathname.startsWith('/settings'), icon: Settings, accent: 'from-purple-500 to-purple-600' },
];

export default function BottomNav(): JSX.Element | null {
  const pathname = usePathname();

  if (pathname === '/auth' || pathname === '/onboarding') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#2a2a2a] bg-[#141414]/95 backdrop-blur-sm">
      <ul className="mx-auto flex w-full max-w-md items-center justify-between px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-2">
        {ITEMS.map((item: NavItem) => {
          const active = item.match(pathname);
          const Icon = item.icon;

          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-[#a1a1a1] transition-all duration-200 ease-out hover:text-white"
              >
                <span className={active ? `scale-110 rounded-full bg-gradient-to-r ${item.accent} p-2 text-white transition-all duration-200 ease-out` : 'rounded-full border border-[#2a2a2a] p-2 text-[#a1a1a1] transition-all duration-200 ease-out'}>
                  <Icon size={16} />
                </span>
                <span className={active ? 'text-white' : 'text-[#a1a1a1]'}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
