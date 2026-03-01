'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps): JSX.Element {
  const classes = [
    'rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4 transition-colors duration-200 ease-in-out hover:border-[#3a3a3a]',
    onClick ? 'cursor-pointer hover:border-[#3a3a3a]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}
