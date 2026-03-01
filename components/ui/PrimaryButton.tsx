'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  className?: string;
}

export default function PrimaryButton({ children, onClick, disabled = false, fullWidth = false, type = 'button', className = '' }: PrimaryButtonProps): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'min-h-[48px] rounded-xl bg-white px-6 py-3 font-semibold text-black transition duration-100 ease-in-out active:scale-95',
        fullWidth ? 'w-full' : '',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:brightness-110',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
