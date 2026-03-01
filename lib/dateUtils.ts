import { DayOfWeek } from '@/types';

const DAY_NAMES: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

export function getWeekStart(date: Date): Date {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getWeekId(date: Date): string {
  const monday = getWeekStart(date);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);

  const isoYear = thursday.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstThursdayWeekStart = getWeekStart(firstThursday);
  const diffInWeeks = Math.round((monday.getTime() - firstThursdayWeekStart.getTime()) / 604800000);
  const weekNumber = diffInWeeks + 1;

  return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
}

export function formatDate(date: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(`${date}T12:00:00`));
}

export function formatLongDate(date: string): string {
  const value = LONG_DATE_FORMATTER.format(new Date(`${date}T12:00:00`));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDayLabel(date: string): string {
  return DAY_LABEL_FORMATTER.format(new Date(`${date}T12:00:00`)).replace('.', '');
}

export function getDayOfWeek(date: string): DayOfWeek {
  const day = new Date(`${date}T12:00:00`).getDay();
  return DAY_NAMES[day === 0 ? 6 : day - 1];
}

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
