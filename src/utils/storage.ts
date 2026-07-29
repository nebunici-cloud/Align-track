import { AlignerSettings, WearLog, MaintenanceTask, PhotoEntry, NotificationLog, UserProfile, WearStatus, OutReason } from '../types';

const ACCOUNTS_KEY = 'aligner_tracker_accounts_v1';
const CURRENT_ACCOUNT_ID_KEY = 'aligner_tracker_current_account_id_v1';

const SETTINGS_KEY = 'aligner_tracker_settings_v1';
const LOGS_KEY = 'aligner_tracker_logs_v1';
const TASKS_KEY = 'aligner_tracker_tasks_v1';
const PHOTOS_KEY = 'aligner_tracker_photos_v1';
const NOTIFICATIONS_KEY = 'aligner_tracker_notifications_v1';
const TIMER_KEY = 'aligner_tracker_timer_v1';

export const DEFAULT_PROFILE: UserProfile = {
  id: 'acc_default_1',
  name: 'Sarah Jenkins',
  planType: 'Invisalign® Comprehensive',
  avatarColor: 'from-teal-500 to-cyan-400',
  createdAt: new Date().toISOString(),
};

export function loadAccounts(): UserProfile[] {
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading accounts:', e);
  }
  // If no accounts exist yet, return empty list or seed default
  return [DEFAULT_PROFILE];
}

export function saveAccounts(accounts: UserProfile[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts:', e);
  }
}

export function loadCurrentAccountId(): string {
  try {
    const id = localStorage.getItem(CURRENT_ACCOUNT_ID_KEY);
    if (id) return id;
  } catch (e) {
    console.error('Error loading current account id:', e);
  }
  const accounts = loadAccounts();
  const defaultId = accounts[0]?.id || DEFAULT_PROFILE.id;
  setCurrentAccountId(defaultId);
  return defaultId;
}

export function setCurrentAccountId(id: string): void {
  try {
    localStorage.setItem(CURRENT_ACCOUNT_ID_KEY, id);
  } catch (e) {
    console.error('Failed to set current account id:', e);
  }
}

export const DEFAULT_SETTINGS: AlignerSettings = {
  dailyTargetHours: 22,
  totalTrays: 24,
  currentTray: 1,
  trayDurationDays: 7,
  customTrayDurations: { 1: 14 }, // e.g. Tray 1 starter was 14 days
  planStartDate: getTodayDateString(),
  planStartTime: '09:00',
  trayStartDate: new Date().toISOString(),
  trayStartTime: '21:00',
  preferredTrayChangeTime: '21:00', // Preferred time of day for switching trays
  orthodontistName: 'Dr. Sarah Miller',
  clinicName: 'BrightSmiles Orthodontics',
  doctorPhone: '+1 (555) 234-5678',
  nextApptDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  nextApptTime: '14:30',
  chewiesDailyTargetMinutes: 10,
  useRubberBands: true,
  rubberBandsTargetPerDay: 3,
  rubberBandsChangedToday: 1,
  outTimerAlertMinutes: 30,
  pushNotificationsEnabled: true,
  soundAlertsEnabled: true,
};

export const INITIAL_MAINTENANCE_TASKS: MaintenanceTask[] = [
  { id: '1', title: 'Morning Brush & Clean Aligners', category: 'clean', completed: true },
  { id: '2', title: 'Chewies Exercise (5-10 min)', category: 'chewies', completed: false, timeSpentMinutes: 4 },
  { id: '3', title: 'Evening Cleaning Crystal Soak', category: 'soak', completed: false },
  { id: '4', title: 'Check Aligner Storage Case', category: 'case', completed: true },
];

export const INITIAL_PHOTOS: PhotoEntry[] = [
  {
    id: 'p1',
    trayNumber: 1,
    date: new Date(Date.now() - 42 * 86400000).toISOString().split('T')[0],
    imageUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80',
    note: 'Day 1 Treatment Start - Initial alignment check',
  },
  {
    id: 'p2',
    trayNumber: 4,
    date: new Date(Date.now() - 21 * 86400000).toISOString().split('T')[0],
    imageUrl: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=400&q=80',
    note: 'Tray 4 - Noticeable gap reduction on top incisors!',
  },
  {
    id: 'p3',
    trayNumber: 7,
    date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
    imageUrl: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=400&q=80',
    note: 'Tray 7 - Upper arch tracking very well',
  },
];

export const INITIAL_NOTIFICATIONS: NotificationLog[] = [
  {
    id: 'n1',
    title: 'Welcome to AlignerTrack! 🎉',
    body: 'Your aligner treatment plan is active. Keep tracking your daily wear time.',
    timestamp: new Date().toISOString(),
    type: 'goal_achieved',
    read: false,
  },
];

/**
 * Formats a Date as YYYY-MM-DD in the user's local timezone.
 * Using toISOString() here would shift the date to UTC, which can
 * misattribute logs to the wrong day near midnight in local time.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatLocalDate(new Date());
}

/** Reads a File into a base64 data URL. Used only as an offline/no-account fallback for photos. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Calculates total available minutes for aligner tracking on a specific date,
 * taking into account planStartDate and planStartTime.
 */
export function getAvailableMinutesForDate(
  dateStr: string,
  settings: AlignerSettings
): {
  availableMins: number;
  isBeforeStart: boolean;
  isPlanStartDay: boolean;
  startWindowMin: number;
  endWindowMin: number;
} {
  const todayStr = getTodayDateString();
  const planStartStr =
    settings.planStartDate || (settings.trayStartDate ? settings.trayStartDate.split('T')[0] : todayStr);

  if (dateStr < planStartStr) {
    return {
      availableMins: 0,
      isBeforeStart: true,
      isPlanStartDay: false,
      startWindowMin: 0,
      endWindowMin: 0,
    };
  }

  const isPlanStartDay = dateStr === planStartStr;
  let startWindowMin = 0;

  if (isPlanStartDay && settings.planStartTime) {
    const parts = settings.planStartTime.split(':');
    const startHour = parseInt(parts[0], 10) || 0;
    const startMin = parseInt(parts[1], 10) || 0;
    startWindowMin = startHour * 60 + startMin;
  }

  const isToday = dateStr === todayStr;
  let endWindowMin = 1440;

  if (isToday) {
    const now = new Date();
    endWindowMin = Math.min(1440, Math.max(1, now.getHours() * 60 + now.getMinutes()));
  }

  const availableMins = Math.max(0, endWindowMin - startWindowMin);

  return {
    availableMins,
    isBeforeStart: false,
    isPlanStartDay,
    startWindowMin,
    endWindowMin,
  };
}

export function calculateWearStreak(logs: WearLog[], settings: AlignerSettings): number {
  const todayStr = getTodayDateString();
  const planStartStr =
    settings.planStartDate || (settings.trayStartDate ? settings.trayStartDate.split('T')[0] : todayStr);

  let streak = 0;
  const now = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = formatLocalDate(d);

    // Cannot count days before treatment plan started
    if (dateStr < planStartStr) {
      break;
    }

    const { availableMins, isBeforeStart, isPlanStartDay } = getAvailableMinutesForDate(dateStr, settings);

    if (isBeforeStart) {
      break;
    }

    const dayLogs = logs.filter((l) => l.date === dateStr);
    const outMins = dayLogs.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
    const isToday = i === 0;

    const wearMins = Math.max(0, availableMins - outMins);
    const targetMins = isPlanStartDay
      ? (settings.dailyTargetHours / 24) * availableMins
      : settings.dailyTargetHours * 60;

    if (wearMins >= targetMins && availableMins > 0) {
      streak++;
    } else if (isToday) {
      // Today is in progress, target not met yet: don't break streak, check yesterday
      continue;
    } else {
      // Past day below goal: streak broken
      break;
    }
  }

  return streak;
}

export function loadSettings(accountId?: string): AlignerSettings {
  try {
    const key = accountId ? `${SETTINGS_KEY}_${accountId}` : SETTINGS_KEY;
    const data = localStorage.getItem(key) || (accountId ? localStorage.getItem(SETTINGS_KEY) : null);
    if (!data) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      customTrayDurations: parsed.customTrayDurations ?? DEFAULT_SETTINGS.customTrayDurations ?? {},
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AlignerSettings, accountId?: string): void {
  try {
    const key = accountId ? `${SETTINGS_KEY}_${accountId}` : SETTINGS_KEY;
    localStorage.setItem(key, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function mergeLogs(localLogs: WearLog[], cloudLogs: WearLog[]): WearLog[] {
  const map = new Map<string, WearLog>();
  if (Array.isArray(cloudLogs)) {
    for (const log of cloudLogs) {
      if (log && log.id) {
        map.set(log.id, log);
      }
    }
  }
  if (Array.isArray(localLogs)) {
    for (const log of localLogs) {
      if (log && log.id) {
        map.set(log.id, log);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.startTime || a.date).getTime();
    const timeB = new Date(b.startTime || b.date).getTime();
    return timeB - timeA;
  });
}

export function loadLogs(accountId?: string): WearLog[] {
  try {
    const key = accountId ? `${LOGS_KEY}_${accountId}` : LOGS_KEY;
    const data = localStorage.getItem(key) || (accountId ? localStorage.getItem(LOGS_KEY) : null);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // fallback
  }

  return [];
}

export function saveLogs(logs: WearLog[], accountId?: string): void {
  try {
    const key = accountId ? `${LOGS_KEY}_${accountId}` : LOGS_KEY;
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save logs:', e);
  }
}

export function loadMaintenanceTasks(accountId?: string): MaintenanceTask[] {
  try {
    const key = accountId ? `${TASKS_KEY}_${accountId}` : TASKS_KEY;
    const data = localStorage.getItem(key) || (accountId ? localStorage.getItem(TASKS_KEY) : null);
    return data ? JSON.parse(data) : INITIAL_MAINTENANCE_TASKS;
  } catch {
    return INITIAL_MAINTENANCE_TASKS;
  }
}

export function saveMaintenanceTasks(tasks: MaintenanceTask[], accountId?: string): void {
  try {
    const key = accountId ? `${TASKS_KEY}_${accountId}` : TASKS_KEY;
    localStorage.setItem(key, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

export function loadPhotos(accountId?: string): PhotoEntry[] {
  try {
    const key = accountId ? `${PHOTOS_KEY}_${accountId}` : PHOTOS_KEY;
    const data = localStorage.getItem(key) || (accountId ? localStorage.getItem(PHOTOS_KEY) : null);
    return data ? JSON.parse(data) : INITIAL_PHOTOS;
  } catch {
    return INITIAL_PHOTOS;
  }
}

export function savePhotos(photos: PhotoEntry[], accountId?: string): void {
  try {
    const key = accountId ? `${PHOTOS_KEY}_${accountId}` : PHOTOS_KEY;
    localStorage.setItem(key, JSON.stringify(photos));
  } catch (e) {
    console.error('Failed to save photos:', e);
  }
}

export function loadNotifications(accountId?: string): NotificationLog[] {
  try {
    const key = accountId ? `${NOTIFICATIONS_KEY}_${accountId}` : NOTIFICATIONS_KEY;
    const data = localStorage.getItem(key) || (accountId ? localStorage.getItem(NOTIFICATIONS_KEY) : null);
    return data ? JSON.parse(data) : INITIAL_NOTIFICATIONS;
  } catch {
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveNotifications(notifications: NotificationLog[], accountId?: string): void {
  try {
    const key = accountId ? `${NOTIFICATIONS_KEY}_${accountId}` : NOTIFICATIONS_KEY;
    localStorage.setItem(key, JSON.stringify(notifications));
  } catch (e) {
    console.error('Failed to save notifications:', e);
  }
}

export interface StoredTimerState {
  wearStatus: WearStatus;
  startTime: string | null;
  reason: OutReason | null;
  presetTimerMinutes: number | null;
}

export function loadTimerState(accountId?: string): StoredTimerState {
  try {
    const key = accountId ? `${TIMER_KEY}_${accountId}` : TIMER_KEY;
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
  } catch {
    // fallback
  }
  return { wearStatus: 'in', startTime: null, reason: null, presetTimerMinutes: null };
}

export function saveTimerState(state: StoredTimerState, accountId?: string): void {
  try {
    const key = accountId ? `${TIMER_KEY}_${accountId}` : TIMER_KEY;
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save timer state:', e);
  }
}
