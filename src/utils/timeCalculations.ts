import { TimeEntry } from '@/context/ProjectContext';

export interface MissedEntry {
  date: string;
  totalHours: number;
  formattedDate: string;
}

export const calculateMissedEntries = (timeEntries: TimeEntry[]): MissedEntry[] => {
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  // Generate all working days in the last month (Monday to Friday)
  const workingDays: string[] = [];
  const currentDate = new Date(oneMonthAgo);
  
  // Helper to format date as YYYY-MM-DD in local timezone
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  while (currentDate <= now) {
    const dayOfWeek = currentDate.getDay();
    // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays.push(formatLocalDate(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Calculate total hours for each working day
  const dailyHours: { [date: string]: number } = {};
  
  timeEntries.forEach(entry => {
    const entryDate = entry.date;
    if (workingDays.includes(entryDate)) {
      dailyHours[entryDate] = (dailyHours[entryDate] || 0) + entry.hours;
    }
  });
  
  // Find days with less than 8 hours
  const missedEntries: MissedEntry[] = [];
  
  workingDays.forEach(date => {
    const totalHours = dailyHours[date] || 0;
    if (totalHours < 8) {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
      missedEntries.push({
        date,
        totalHours,
        formattedDate
      });
    }
  });
  
  // Sort by date descending (most recent first)
  return missedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};