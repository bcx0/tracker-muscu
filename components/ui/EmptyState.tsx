'use client';

import PrimaryButton from '@/components/ui/PrimaryButton';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="text-5xl">{icon}</div>
      <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-[#a1a1a1]">{description}</p>
      {action ? (
        <div className="mt-6 w-full max-w-xs">
          <PrimaryButton fullWidth onClick={action.onClick}>{action.label}</PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
