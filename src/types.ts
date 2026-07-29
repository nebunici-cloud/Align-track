export interface UserProfile {
  id: string; // e.g. "acc_1720000000"
  name: string; // e.g. "Sarah Jenkins"
  planType: string; // e.g. "Invisalign® Full", "Spark® Aligners", "ClearCorrect®", "Custom Plan"
  avatarColor: string; // gradient classes e.g. "from-teal-500 to-cyan-400"
  createdAt: string;
}

export type WearStatus = 'in' | 'out';

export type OutReason = 
  | 'breakfast' 
  | 'lunch' 
  | 'dinner' 
  | 'snack' 
  | 'coffee_drink' 
  | 'brushing_cleaning' 
  | 'sports' 
  | 'other';

export interface WearLog {
  id: string;
  date: string; // YYYY-MM-DD
  type: WearStatus;
  startTime: string; // ISO string
  endTime?: string | null; // ISO string if ended
  durationMinutes?: number; // total duration out or in
  reason?: OutReason;
  notes?: string;
}

export interface AlignerSettings {
  dailyTargetHours: number; // e.g. 22
  totalTrays: number; // e.g. 24
  currentTray: number; // e.g. 7
  trayDurationDays: number; // default duration in days (e.g. 7)
  customTrayDurations?: Record<number, number>; // map trayNumber -> days (e.g. { 1: 14, 2: 10 })
  planStartDate?: string; // YYYY-MM-DD plan start date
  planStartTime?: string; // HH:mm plan start time
  trayStartDate: string; // ISO date string when current tray was started
  trayStartTime?: string; // HH:mm preferred/actual start time of current tray
  preferredTrayChangeTime?: string; // HH:mm preferred reminder time for tray switch (e.g. "21:00")
  orthodontistName: string;
  clinicName: string;
  doctorPhone: string;
  nextApptDate: string; // YYYY-MM-DD
  nextApptTime: string; // HH:mm
  chewiesDailyTargetMinutes: number; // e.g. 10
  useRubberBands?: boolean; // toggle for elastics/rubber bands
  rubberBandsTargetPerDay?: number; // e.g. 3 times per day (morning, lunch, evening)
  rubberBandsChangedToday?: number; // count changed today
  outTimerAlertMinutes: number; // e.g. 30
  pushNotificationsEnabled: boolean;
  soundAlertsEnabled: boolean;
}

export function getTrayDuration(settings: AlignerSettings, trayNumber: number): number {
  if (settings.customTrayDurations && settings.customTrayDurations[trayNumber] !== undefined) {
    return settings.customTrayDurations[trayNumber];
  }
  return settings.trayDurationDays || 7;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  category: 'clean' | 'chewies' | 'soak' | 'case';
  completed: boolean;
  timeSpentMinutes?: number;
}

export interface PhotoEntry {
  id: string;
  trayNumber: number;
  date: string;
  imageUrl: string;
  note?: string;
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'out_limit' | 'tray_change' | 'maintenance' | 'goal_achieved' | 'test';
  read: boolean;
}
