'use client';

interface QuickAdjustButtonProps {
  label: string;
  onClick: () => void;
}

export default function QuickAdjustButton({ label, onClick }: QuickAdjustButtonProps): JSX.Element {
  return (
    <button type="button" onClick={onClick} className="min-h-[44px] min-w-[60px] rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
      {label}
    </button>
  );
}
