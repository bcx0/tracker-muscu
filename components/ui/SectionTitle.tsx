'use client';

import { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
}

export default function SectionTitle({ children }: SectionTitleProps): JSX.Element {
  return <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#a1a1a1]">{children}</h2>;
}
