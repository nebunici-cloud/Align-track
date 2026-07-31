import {
  db,
  storage,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
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

/**
 * Recursively removes keys whose value is `undefined`. Firestore's setDoc
 * throws ("Unsupported field value: undefined") if any field is explicitly
 * undefined, as opposed to simply omitted — a common trap when an optional
 * field is built as `value || undefined`. Applied to every write below so a
 * blank optional field (e.g. a manual log's empty notes) can't silently fail
 * the whole write.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        out[key] = stripUndefined(val);
      }
    }
    return out as T;
  }
  return value;
}

export interface ActiveTimerState {
  wearStatus: WearStatus;
  startTime: string | null;
  reason: OutReason | null;
  presetTimerMinutes: number | null;
  // When this timer state was set locally. Used to resolve the race where the
  // live listener's first snapshot (reflecting whatever was last saved before
  // this page loaded) arrives after a fresh local action — without a
  // timestamp, that stale snapshot would silently overwrite the newer local
  // change instead of losing to it.
  updatedAt?: string;
}

export interface PlanMeta {
  settings?: AlignerSettings;
  tasks?: MaintenanceTask[];
  notifications?: NotificationLog[];
  activeTimer?: ActiveTimerState;
}

export interface ProfileData {
  accounts: UserProfile[];
  currentAccountId: string;
}

const QUOTA_STORAGE_KEY = 'alignertrack_firestore_quota_exceeded';
const MAX_SYNCED_LOGS = 500;

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

function isQuotaError(error: any): boolean {
  const errMsg = String(error?.message || error || '');
  const errCode = String(error?.code || '');
  return (
    errMsg.includes('Quota exceeded') ||
    errMsg.includes('resource-exhausted') ||
    errCode.includes('resource-exhausted')
  );
}

function handleWriteError(error: any, context: string) {
  if (isQuotaError(error)) {
    console.warn('Firestore write quota reached. Switching to local persistence mode.');
    notifyQuotaExceeded();
  } else {
    console.error(`Error saving ${context}:`, error);
  }
}

function handleSubscriptionError(error: any, onError?: (err: any) => void) {
  if (isQuotaError(error)) {
    console.warn('Firestore subscription quota reached. Switching to local persistence mode.');
    notifyQuotaExceeded();
  } else {
    console.error('Firestore subscription error:', error);
  }
  if (onError) onError(error);
}

/** Simple per-key debounce so rapid successive edits (e.g. settings form typing) collapse to one write. */
function createDebouncedWriter<T>(writeFn: (key: string, payload: T) => Promise<void>, delayMs = 1200) {
  const timers = new Map<string, NodeJS.Timeout>();
  const pending = new Map<string, T>();

  return (key: string, payload: T) => {
    pending.set(key, payload);
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(key);
      const data = pending.get(key);
      pending.delete(key);
      if (data !== undefined) {
        writeFn(key, data).catch((err) => handleWriteError(err, key));
      }
    }, delayMs);

    timers.set(key, timer);
  };
}

// ---------- Profile (accounts list + current selection) ----------
// Small, bounded document: /users/{uid}/profile/main

const profileDocPath = (uid: string) => doc(db, 'users', uid, 'profile', 'main');

const debouncedProfileWrite = createDebouncedWriter<ProfileData>(async (uid, data) => {
  if (isQuotaExceeded) return;
  await setDoc(profileDocPath(uid), stripUndefined({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
});

export function saveProfileToCloud(uid: string, data: ProfileData) {
  if (!uid || isQuotaExceeded) return;
  debouncedProfileWrite(uid, data);
}

export function subscribeToProfile(
  uid: string,
  onUpdate: (data: ProfileData | null) => void,
  onError?: (err: any) => void
): () => void {
  if (!uid || isQuotaExceeded) return () => {};
  return onSnapshot(
    profileDocPath(uid),
    (snapshot) => {
      onUpdate(snapshot.exists() ? (snapshot.data() as ProfileData) : null);
    },
    (error) => handleSubscriptionError(error, onError)
  );
}

// ---------- Plan meta (settings, tasks, notifications, active timer) ----------
// Small, bounded document per plan: /users/{uid}/plans/{accountId}/meta/main

const planMetaDocPath = (uid: string, accountId: string) =>
  doc(db, 'users', uid, 'plans', accountId, 'meta', 'main');

const debouncedPlanMetaWrite = createDebouncedWriter<PlanMeta>(async (key, data) => {
  if (isQuotaExceeded) return;
  const [uid, accountId] = key.split('::');
  await setDoc(planMetaDocPath(uid, accountId), stripUndefined({ ...data, updatedAt: new Date().toISOString() }), { merge: true });
});

export function savePlanMetaToCloud(uid: string, accountId: string, data: PlanMeta) {
  if (!uid || !accountId || isQuotaExceeded) return;
  debouncedPlanMetaWrite(`${uid}::${accountId}`, data);
}

export function subscribeToPlanMeta(
  uid: string,
  accountId: string,
  onUpdate: (data: PlanMeta | null) => void,
  onError?: (err: any) => void
): () => void {
  if (!uid || !accountId || isQuotaExceeded) return () => {};
  return onSnapshot(
    planMetaDocPath(uid, accountId),
    (snapshot) => {
      onUpdate(snapshot.exists() ? (snapshot.data() as PlanMeta) : null);
    },
    (error) => handleSubscriptionError(error, onError)
  );
}

// ---------- Wear logs ----------
// Unbounded collection, one document per log entry: /users/{uid}/plans/{accountId}/wearLogs/{logId}

const wearLogsCollection = (uid: string, accountId: string) =>
  collection(db, 'users', uid, 'plans', accountId, 'wearLogs');

export function subscribeToWearLogs(
  uid: string,
  accountId: string,
  onUpdate: (logs: WearLog[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!uid || !accountId || isQuotaExceeded) return () => {};
  const q = query(wearLogsCollection(uid, accountId), orderBy('startTime', 'desc'), limit(MAX_SYNCED_LOGS));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((d) => d.data() as WearLog);
      onUpdate(logs);
    },
    (error) => handleSubscriptionError(error, onError)
  );
}

export async function saveWearLogToCloud(uid: string, accountId: string, log: WearLog): Promise<boolean> {
  if (!uid || !accountId || isQuotaExceeded) return false;
  try {
    await setDoc(doc(wearLogsCollection(uid, accountId), log.id), stripUndefined(log), { merge: true });
    return true;
  } catch (error) {
    handleWriteError(error, 'wear log');
    return false;
  }
}

export async function deleteWearLogFromCloud(uid: string, accountId: string, logId: string): Promise<boolean> {
  if (!uid || !accountId || isQuotaExceeded) return false;
  try {
    await deleteDoc(doc(wearLogsCollection(uid, accountId), logId));
    return true;
  } catch (error) {
    handleWriteError(error, 'wear log deletion');
    return false;
  }
}

// ---------- Photos ----------
// Unbounded collection, images live in Storage; Firestore only holds metadata + download URL.
// /users/{uid}/plans/{accountId}/photos/{photoId}

const photosCollection = (uid: string, accountId: string) =>
  collection(db, 'users', uid, 'plans', accountId, 'photos');

const photoStoragePath = (uid: string, accountId: string, photoId: string) =>
  `users/${uid}/plans/${accountId}/photos/${photoId}`;

export function subscribeToPhotos(
  uid: string,
  accountId: string,
  onUpdate: (photos: PhotoEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!uid || !accountId || isQuotaExceeded) return () => {};
  const q = query(photosCollection(uid, accountId), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const photos = snapshot.docs.map((d) => d.data() as PhotoEntry);
      onUpdate(photos);
    },
    (error) => handleSubscriptionError(error, onError)
  );
}

/**
 * Uploads an image file to Firebase Storage and returns its public download URL.
 * Callers should store only the returned URL in Firestore, never the raw file data.
 */
export async function uploadPhotoFile(
  uid: string,
  accountId: string,
  photoId: string,
  file: File
): Promise<string> {
  const storageRef = ref(storage, photoStoragePath(uid, accountId, photoId));
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function savePhotoToCloud(uid: string, accountId: string, photo: PhotoEntry): Promise<boolean> {
  if (!uid || !accountId || isQuotaExceeded) return false;
  try {
    await setDoc(doc(photosCollection(uid, accountId), photo.id), stripUndefined(photo), { merge: true });
    return true;
  } catch (error) {
    handleWriteError(error, 'photo');
    return false;
  }
}

export async function deletePhotoFromCloud(uid: string, accountId: string, photoId: string): Promise<boolean> {
  if (!uid || !accountId || isQuotaExceeded) return false;
  let ok = true;
  try {
    await deleteDoc(doc(photosCollection(uid, accountId), photoId));
  } catch (error) {
    handleWriteError(error, 'photo deletion');
    ok = false;
  }

  try {
    await deleteObject(ref(storage, photoStoragePath(uid, accountId, photoId)));
  } catch {
    // Best-effort: image may not exist in Storage (e.g. legacy base64-only entry).
  }

  return ok;
}

// ---------- Whole-plan cleanup (used when a treatment profile is deleted) ----------

export async function deletePlanFromCloud(uid: string, accountId: string): Promise<void> {
  if (!uid || !accountId || isQuotaExceeded) return;

  try {
    const [logsSnap, photosSnap] = await Promise.all([
      getDocs(wearLogsCollection(uid, accountId)),
      getDocs(photosCollection(uid, accountId)),
    ]);

    await Promise.all([
      ...logsSnap.docs.map((d) => deleteDoc(d.ref)),
      ...photosSnap.docs.map((d) => deleteDoc(d.ref)),
      deleteDoc(planMetaDocPath(uid, accountId)),
    ]);
  } catch (error) {
    handleWriteError(error, 'plan data deletion');
  }

  try {
    const folderRef = ref(storage, `users/${uid}/plans/${accountId}/photos`);
    const listing = await listAll(folderRef);
    await Promise.all(listing.items.map((item) => deleteObject(item)));
  } catch {
    // Best-effort: folder may not exist if the plan never had photos.
  }
}
