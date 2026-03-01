'use client';

import { CoachInsight } from '@/lib/coachInsight';

interface InsightCardProps {
  insight: CoachInsight;
}

const CONFIG: Record<CoachInsight['type'], { border: string; icon: string }> = {
  plateau: { border: 'border-orange-400', icon: '⚠️' },
  increase: { border: 'border-green-400', icon: '🚀' },
  volume: { border: 'border-amber-400', icon: '📊' },
  default: { border: 'border-[#3a3a3a]', icon: '💪' },
};

export default function InsightCard({ insight }: InsightCardProps): JSX.Element {
  const config = CONFIG[insight.type];

  return (
    <div className={`rounded-2xl border border-[#2a2a2a] border-l-4 bg-[#141414] p-4 ${config.border}`}>
      <p className="text-sm text-white">{config.icon} {insight.message}</p>
    </div>
  );
}