import {
  db,
  doc,
  setDoc,
  onSnapshot,
} from '../lib/firebase';
import {
  AlignerSettings,
  WearLog,
  MaintenanceTask,
  PhotoEntry,
  NotificationLog,
  UserProfile,
  WearStatus,
  OutReason,
} from '../types';

export interface ActiveTimerState {
  wearStatus: WearStatus;
  startTime: string | null;
  reason: OutReason | null;
  presetTimerMinutes: number | null;
}

export interface PerPlanData {
  settings?: AlignerSettings;
  logs?: WearLog[];
  tasks?: MaintenanceTask[];
  photos?: PhotoEntry[];
  notifications?: NotificationLog[];
  activeTimer?: ActiveTimerState;
}

export interface UserCloudData {
  accounts?: UserProfile[];
  currentAccountId?: string;
  plans?: Record<string, PerPlanData>;
  activeTimer?: ActiveTimerState;
  profile?: UserProfile;
  settings?: AlignerSettings;
  logs?: WearLog[];
  tasks?: MaintenanceTask[];
  photos?: PhotoEntry[];
  notifications?: NotificationLog[];
  lastUpdated?: string;
}

let saveDebounceTimer: NodeJS.Timeout | null = null;
let pendingSaveUserId: string | null = null;
let pendingSaveData: Partial<UserCloudData> | null = null;

const QUOTA_STORAGE_KEY = 'alignertrack_firestore_quota_exceeded';

let isQuotaExceeded = typeof window !== 'undefined' && localStorage.getItem(QUOTA_STORAGE_KEY) === 'true';
type QuotaListener = (exceeded: boolean) => void;
const quotaListeners: QuotaListener[] = [];

export function isCloudQuotaExceeded(): boolean {
  if (!isQuotaExceeded && typeof window !== 'undefined') {
    isQuotaExceeded = localStorage.getItem(QUOTA_STORAGE_KEY) === 'true';
  }
  return isQuotaExceeded;
}

export function subscribeToQuotaStatus(listener: QuotaListener): () => void {
  quotaListeners.push(listener);
  listener(isCloudQuotaExceeded());
  return () => {
    const idx = quotaListeners.indexOf(listener);
    if (idx !== -1) quotaListeners.splice(idx, 1);
  };
}

function notifyQuotaExceeded() {
  if (!isQuotaExceeded) {
    isQuotaExceeded = true;
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    quotaListeners.forEach((l) => l(true));
  }
}

/**
 * Saves user data to Firestore under /users/{userId} with debouncing to optimize quota usage
 */
export async function saveUserDataToCloud(userId: string, data: Partial<UserCloudData>) {
  if (!userId || isQuotaExceeded) return;

  pendingSaveUserId = userId;
  pendingSaveData = { ...pendingSaveData, ...data };

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(async () => {
    const uid = pendingSaveUserId;
    const payload = pendingSaveData;
    pendingSaveUserId = null;
    pendingSaveData = null;

    if (!uid || !payload || isQuotaExceeded) return;

    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          ...payload,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error: any) {
      const errMsg = String(error?.message || error || '');
      const errCode = String(error?.code || '');
      if (
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('resource-exhausted') ||
        errCode.includes('resource-exhausted')
      ) {
        console.warn('Firestore write quota reached. Switching to local persistence mode.');
        notifyQuotaExceeded();
      } else {
        console.error('Error saving user data to cloud:', error);
      }
    }
  }, 3500);
}

/**
 * Subscribes to live user data changes in Firestore for seamless cross-device syncing
 */
export function subscribeToUserData(
  userId: string,
  onUpdate: (data: UserCloudData, exists: boolean) => void,
  onError?: (err: any) => void
) {
  if (!userId || isQuotaExceeded) return () => {};
  const userDocRef = doc(db, 'users', userId);

  return onSnapshot(
    userDocRef,
    (snapshot) => {
      const exists = snapshot.exists();
      const data = exists ? (snapshot.data() as UserCloudData) : {};
      onUpdate(data, exists);
    },
    (error: any) => {
      const errMsg = String(error?.message || error || '');
      const errCode = String(error?.code || '');
      if (
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('resource-exhausted') ||
        errCode.includes('resource-exhausted')
      ) {
        console.warn('Firestore subscription quota reached. Switching to local persistence mode.');
        notifyQuotaExceeded();
      } else {
        console.error('Firestore subscription error:', error);
      }
      if (onError) onError(error);
    }
  );
}
