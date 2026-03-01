'use client';

interface ProgressBarProps {
  value: number;
  color?: string;
  className?: string;
}

export default function ProgressBar({ value, color = 'bg-amber-400', className = '' }: ProgressBarProps): JSX.Element {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={['h-2 overflow-hidden rounded-full bg-[#1c1c1c]', className].filter(Boolean).join(' ')}>
      <div className={`${color} h-full rounded-full transition-all duration-200 ease-in-out`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}