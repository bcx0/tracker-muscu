'use client';

import { ReactNode } from 'react';

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export default function SecondaryButton({ children, onClick, disabled = false, fullWidth = false, className = '' }: SecondaryButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'min-h-[48px] rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] px-6 py-3 font-medium text-white transition duration-200 ease-in-out active:scale-[0.97]',
        fullWidth ? 'w-full' : '',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-[#3a3a3a]',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}