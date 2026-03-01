'use client';

interface VolumeBarProps {
  muscle: string;
  current: number;
  min: number;
  max: number;
}

export default function VolumeBar({ muscle, current, min, max }: VolumeBarProps): JSX.Element {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const colorClassName = current >= min ? 'bg-green-500' : current > 0 ? 'bg-orange-400' : 'bg-[#2a2a2a]';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white">{muscle}</span>
        <span className="text-[#a1a1a1]">{current} / {max} séries</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#1c1c1c]">
        <div className={`${colorClassName} h-full rounded-full transition-all duration-200 ease-in-out`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}