'use client';

interface BadgeProps {
  label: string;
  variant: 'done' | 'partial' | 'abandoned' | 'rest' | 'upcoming' | 'level';
}

const VARIANTS: Record<BadgeProps['variant'], string> = {
  done: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  partial: 'border border-amber-500/30 bg-amber-500/15 text-amber-300',
  abandoned: 'border border-red-500/30 bg-red-500/15 text-red-300',
  rest: 'border border-[#2a2a2a] bg-[#1c1c1c] text-[#a1a1a1]',
  upcoming: 'border border-blue-500/30 bg-blue-500/15 text-blue-300',
  level: 'border border-[#2a2a2a] bg-white text-black',
};

export default function Badge({ label, variant }: BadgeProps): JSX.Element {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${VARIANTS[variant]}`}>{label}</span>;
}
