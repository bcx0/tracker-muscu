'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProgressRedirectPage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace('/progression');
  }, [router]);

  return <div className="min-h-screen bg-[#0a0a0a]" />;
}
