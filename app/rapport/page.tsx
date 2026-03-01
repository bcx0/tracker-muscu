'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import Container from '@/components/ui/Container';
import EmptyState from '@/components/ui/EmptyState';
import SecondaryButton from '@/components/ui/SecondaryButton';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { formatLongDate } from '@/lib/dateUtils';
import { getUser } from '@/lib/supabase';
import { WeeklyReportData, loadWeeklyReport } from '@/lib/weeklyReport';

const MUSCLE_ORDER = [
  { key: 'chest', label: 'Pectoraux' },
  { key: 'back', label: 'Dos' },
  { key: 'shoulders', label: 'Épaules' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'abs', label: 'Abdominaux' },
] as const;

function getBarColor(sets: number): string {
  if (sets < 10) {
    return '#ef4444';
  }
  if (sets <= 20) {
    return '#22c55e';
  }
  return '#f59e0b';
}

export default function RapportPage(): JSX.Element {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [previousReport, setPreviousReport] = useState<WeeklyReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    async function loadData(): Promise<void> {
      const { data } = await getUser();
      const user = data.user;

      if (!user) {
        if (active) {
          setIsLoading(false);
        }
        return;
      }

      const [currentWeek, previousWeek] = await Promise.all([loadWeeklyReport(user.id, weekOffset), loadWeeklyReport(user.id, weekOffset - 1)]);

      if (active) {
        setReport(currentWeek);
        setPreviousReport(previousWeek);
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    void loadData();
    return () => {
      active = false;
    };
  }, [weekOffset]);

  const chartData = useMemo(() => {
    if (!report) {
      return [];
    }

    return MUSCLE_ORDER.map((item) => ({
      label: item.label,
      sets: report.setsByMuscle[item.key],
      fill: getBarColor(report.setsByMuscle[item.key]),
    }));
  }, [report]);

  const pushPullRatio = useMemo(() => {
    if (!report) {
      return 0;
    }
    return report.pullSets === 0 ? (report.pushSets > 0 ? Infinity : 1) : report.pushSets / report.pullSets;
  }, [report]);

  const comparison = useMemo(() => {
    if (!report || !previousReport) {
      return null;
    }

    if (previousReport.totalVolume === 0) {
      return {
        diff: report.totalVolume > 0 ? 100 : 0,
        isUp: report.totalVolume >= previousReport.totalVolume,
      };
    }

    const diff = ((report.totalVolume - previousReport.totalVolume) / previousReport.totalVolume) * 100;
    return {
      diff,
      isUp: diff >= 0,
    };
  }, [previousReport, report]);

  if (isLoading) {
    return (
      <Container className="space-y-4 pt-6">
        <div className="space-y-3">
          <SkeletonText width="42%" height={20} />
          <SkeletonText width="58%" />
          <SkeletonCard height={56} />
        </div>
        <SkeletonCard height={176} />
        <SkeletonCard height={320} />
        <div className="grid grid-cols-1 gap-4">
          <SkeletonCard height={168} />
          <SkeletonCard height={136} />
        </div>
      </Container>
    );
  }

  if (!report) {
    return (
      <Container className="pt-8">
        <EmptyState icon="📊" title="Rapport indisponible" description="Impossible de charger le rapport hebdomadaire pour le moment." />
      </Container>
    );
  }

  const noSessionsYet = report.sessions.length === 0 || report.totalSets === 0;

  return (
    <Container className="space-y-4 pt-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Rapport de la semaine</h1>
          <p className="text-sm text-[#a1a1a1]">
            Semaine du {formatLongDate(report.weekStart).toLowerCase()} au {formatLongDate(report.weekEnd).toLowerCase()}
          </p>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[#2a2a2a] bg-[#141414] px-4 py-3">
          <button type="button" onClick={() => setWeekOffset((value) => value - 1)} className="rounded-full border border-[#2a2a2a] p-2 text-white transition-colors duration-200 hover:border-[#3a3a3a]">
            <ArrowLeft size={16} />
          </button>
          <p className="text-sm font-medium text-white">
            {weekOffset === 0 ? 'Semaine en cours' : weekOffset < 0 ? `Il y a ${Math.abs(weekOffset)} semaine(s)` : `Dans ${weekOffset} semaine(s)`}
          </p>
          <button
            type="button"
            onClick={() => setWeekOffset((value) => Math.min(value + 1, 0))}
            disabled={weekOffset === 0}
            className="rounded-full border border-[#2a2a2a] p-2 text-white transition-colors duration-200 hover:border-[#3a3a3a] disabled:opacity-40"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {noSessionsYet ? (
        <section className="surface-card p-6">
          <EmptyState icon="🗓️" title="Aucune séance cette semaine encore" description="Commence une séance pour faire apparaître ton rapport hebdomadaire." />
        </section>
      ) : (
        <>
          <section className="surface-card grid grid-cols-2 gap-4 p-4">
            <div>
              <p className="text-sm text-[#a1a1a1]">Séances complétées</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {report.completedSessions} / {report.plannedSessions}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#a1a1a1]">Volume total</p>
              <p className="mt-2 text-2xl font-bold text-white">{Math.round(report.totalVolume)} kg</p>
            </div>
            <div>
              <p className="text-sm text-[#a1a1a1]">Temps total estimé</p>
              <p className="mt-2 text-2xl font-bold text-white">{report.totalEstimatedMinutes} min</p>
            </div>
            <div>
              <p className="text-sm text-[#a1a1a1]">Séances manquées</p>
              <p className={`mt-2 text-2xl font-bold ${report.missedSessions > 0 ? 'text-red-400' : 'text-white'}`}>{report.missedSessions}</p>
            </div>
          </section>

          <section className="surface-card space-y-4 p-4">
            <div>
              <p className="text-lg font-bold text-white">Volume par muscle</p>
              <p className="text-sm text-[#a1a1a1]">Objectif recommandé : 10 à 20 séries par muscle et par semaine.</p>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} stroke="#a1a1a1" />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} stroke="#ffffff" width={90} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 16, color: '#ffffff' }}
                    formatter={(value: number) => [`${value} séries`, 'Volume']}
                  />
                  <Bar dataKey="sets" radius={[8, 8, 8, 8]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="surface-card space-y-4 p-4">
            <div>
              <p className="text-lg font-bold text-white">Équilibre Push / Pull</p>
              <p className="text-sm text-[#a1a1a1]">
                {report.pushSets} séries Push vs {report.pullSets} séries Pull
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#a1a1a1]">Push</p>
                <div className="h-3 rounded-full bg-[#0a0a0a]">
                  <div className="h-full rounded-full bg-[#ef4444]" style={{ width: `${Math.min(100, (report.pushSets / Math.max(report.pushSets, report.pullSets, 1)) * 100)}%` }} />
                </div>
              </div>
              <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#a1a1a1]">Pull</p>
                <div className="h-3 rounded-full bg-[#0a0a0a]">
                  <div className="h-full rounded-full bg-[#3b82f6]" style={{ width: `${Math.min(100, (report.pullSets / Math.max(report.pushSets, report.pullSets, 1)) * 100)}%` }} />
                </div>
              </div>
            </div>
            {pushPullRatio > 1.3 ? (
              <p className="rounded-2xl border border-amber-500/30 bg-[#1a1200] px-3 py-3 text-sm text-amber-300">
                ⚠️ Tu pousses plus que tu ne tires - risque de déséquilibre épaules
              </p>
            ) : (
              <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">✅ Bonne balance Push/Pull</p>
            )}
          </section>

          <section className="surface-card space-y-4 p-4">
            <div>
              <p className="text-lg font-bold text-white">Muscles négligés</p>
              <p className="text-sm text-[#a1a1a1]">
                {report.neglectedMuscles.length > 0
                  ? `Pas travaillés cette semaine : ${report.neglectedMuscles.join(', ')}`
                  : 'Tous les groupes musculaires principaux ont été stimulés cette semaine.'}
              </p>
            </div>
            <SecondaryButton fullWidth onClick={() => router.push('/week')}>
              Voir le programme
            </SecondaryButton>
          </section>

          <section className="surface-card space-y-3 p-4">
            <p className="text-lg font-bold text-white">Comparaison semaine précédente</p>
            {comparison ? (
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-4 ${comparison.isUp ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
                <div className={comparison.isUp ? 'text-emerald-300' : 'text-red-300'}>
                  {comparison.isUp ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                </div>
                <p className={comparison.isUp ? 'text-emerald-300' : 'text-red-300'}>
                  {comparison.diff >= 0 ? '+' : ''}
                  {comparison.diff.toFixed(0)}% de volume vs semaine dernière {comparison.isUp ? '↑' : '↓'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#a1a1a1]">Pas encore assez de données pour comparer avec la semaine précédente.</p>
            )}
          </section>
        </>
      )}
    </Container>
  );
}
