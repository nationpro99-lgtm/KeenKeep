import { TaskItem } from '../types';

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) {
    const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
    return 0;
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function sortTasksChronologically(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    // Both time fields now hold ISO timestamps. Sort directly.
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });
}
