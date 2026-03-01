import { getTodayISO, getWeekId } from '@/lib/dateUtils';
import { WorkoutSession } from '@/types';

export interface GamificationResult {
  total_points: number;
  level: number;
  streak: number;
  weekly_done: number;
  weekly_total: number;
}

export function computeGamification(sessions: WorkoutSession[]): GamificationResult {
  const total_points = sessions.reduce((sum: number, session: WorkoutSession) => sum + session.points_earned, 0);
  const level = Math.floor(total_points / 100) + 1;
  const today = getTodayISO();
  const currentWeekId = getWeekId(new Date(`${today}T12:00:00`));
  const sortedSessions = [...sessions].sort((a: WorkoutSession, b: WorkoutSession) => b.scheduled_date.localeCompare(a.scheduled_date));

  let streak = 0;
  for (const session of sortedSessions) {
    if (session.scheduled_date > today) {
      continue;
    }
    if (session.status === 'rest') {
      continue;
    }
    if (session.status === 'upcoming') {
      break;
    }
    if (session.status === 'abandoned') {
      streak = 0;
      break;
    }
    if (session.status === 'done' || session.status === 'partial') {
      streak += 1;
      continue;
    }
  }

  const weeklySessions = sessions.filter((session: WorkoutSession) => getWeekId(new Date(`${session.scheduled_date}T12:00:00`)) === currentWeekId);
  const weekly_done = weeklySessions.filter((session: WorkoutSession) => session.status === 'done' || session.status === 'partial').length;
  const weekly_total = weeklySessions.filter((session: WorkoutSession) => session.status !== 'rest').length;

  return { total_points, level, streak, weekly_done, weekly_total };
}
