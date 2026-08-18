import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { HomeView } from './components/home/HomeView';
import { TrayceBottomNav, TrayceNavDestination } from './components/home/TrayceBottomNav';
import { TrayceSidebar } from './components/home/TrayceSidebar';
import { TrayceTopBar } from './components/home/TrayceTopBar';
import { useTrayceTheme } from './hooks/useTrayceTheme';

// Lazy-loaded: each of these is only ever needed once a specific tab is
// selected or a specific modal is opened, so there's no reason for their
// code to be in the initial bundle everyone downloads on first load.
const DailyLogsList = lazy(() => import('./components/DailyLogsList').then((m) => ({ default: m.DailyLogsList })));
const AnalyticsView = lazy(() => import('./components/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
const PhotoDiary = lazy(() => import('./components/PhotoDiary').then((m) => ({ default: m.PhotoDiary })));
const ChewiesTimerModal = lazy(() =>
  import('./components/ChewiesTimerModal').then((m) => ({ default: m.ChewiesTimerModal }))
);
const NotificationCenterModal = lazy(() =>
  import('./components/NotificationCenterModal').then((m) => ({ default: m.NotificationCenterModal }))
);
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const OnboardingModal = lazy(() => import('./components/OnboardingModal').then((m) => ({ default: m.OnboardingModal })));
const AccountSwitcherModal = lazy(() =>
  import('./components/AccountSwitcherModal').then((m) => ({ default: m.AccountSwitcherModal }))
);
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const DailyPlanSheet = lazy(() =>
  import('./components/home/DailyPlanSheet').then((m) => ({ default: m.DailyPlanSheet }))
);
const TreatmentSheet = lazy(() =>
  import('./components/home/TreatmentSheet').then((m) => ({ default: m.TreatmentSheet }))
);

import { auth, onAuthStateChanged, User as FirebaseUser } from './lib/firebase';
import {
  subscribeToProfile,
  saveProfileToCloud,
  subscribeToPlanMeta,
  savePlanMetaToCloud,
  subscribeToWearLogs,
  saveWearLogToCloud,
  deleteWearLogFromCloud,
  subscribeToPhotos,
  uploadPhotoFile,
  savePhotoToCloud,
  deletePhotoFromCloud,
  deletePlanFromCloud,
  deleteAllPlansFromCloud,
  subscribeToQuotaStatus,
  ActiveTimerState,
} from './services/firebaseService';

import {
  WearStatus,
  OutReason,
  WearLog,
  AlignerSettings,
  MaintenanceTask,
  PhotoEntry,
  NotificationLog,
  UserProfile,
} from './types';

import {
  loadAccounts,
  saveAccounts,
  loadCurrentAccountId,
  setCurrentAccountId,
  loadSettings,
  saveSettings,
  loadLogs,
  saveLogs,
  mergeLogs,
  loadMaintenanceTasks,
  saveMaintenanceTasks,
  loadPhotos,
  savePhotos,
  mergePhotos,
  loadNotifications,
  saveNotifications,
  loadTimerState,
  saveTimerState,
  getTodayDateString,
  fileToDataUrl,
  DEFAULT_SETTINGS,
  INITIAL_MAINTENANCE_TASKS,
  INITIAL_PHOTOS,
  INITIAL_NOTIFICATIONS,
} from './utils/storage';

import { CheckCircle2, Smile, Loader2 } from 'lucide-react';

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

export default function App() {
  // Auth State
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // True once the current account's cloud plan doc has been read at least once
  // (or determined not to exist). Gates cloud writes so we never overwrite
  // cloud data with stale local state before the first snapshot arrives.
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);

  // Accounts State
  const [accounts, setAccounts] = useState<UserProfile[]>(loadAccounts);
  const [currentAccountId, setAccountIdState] = useState<string>(loadCurrentAccountId);

  // Active Account Object
  const currentAccount = accounts.find((a) => a.id === currentAccountId) || accounts[0];

  // Account-Scoped Data States
  const [settings, setSettings] = useState<AlignerSettings>(() => loadSettings(currentAccountId));
  const [logs, setLogs] = useState<WearLog[]>(() => loadLogs(currentAccountId));
  const [tasks, setTasks] = useState<MaintenanceTask[]>(() => loadMaintenanceTasks(currentAccountId));
  const [photos, setPhotos] = useState<PhotoEntry[]>(() => loadPhotos(currentAccountId));
  const [notifications, setNotifications] = useState<NotificationLog[]>(() => loadNotifications(currentAccountId));

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'quick' | 'logs' | 'analytics' | 'photos'>('quick');

  // Redesigned mobile Home screen: theme + its two secondary destinations
  const [trayceTheme, setTrayceTheme] = useTrayceTheme();
  const [isDailyPlanOpen, setIsDailyPlanOpen] = useState<boolean>(false);
  const [isTreatmentSheetOpen, setIsTreatmentSheetOpen] = useState<boolean>(false);

  // Wear Timer State
  const initialTimer = loadTimerState(currentAccountId);
  const [wearStatus, setWearStatus] = useState<WearStatus>(initialTimer.wearStatus);
  const [currentOutStartTime, setCurrentOutStartTime] = useState<string | null>(initialTimer.startTime);
  const [currentOutReason, setCurrentOutReason] = useState<OutReason | null>(initialTimer.reason);
  const [presetTimerMinutes, setPresetTimerMinutes] = useState<number | null>(initialTimer.presetTimerMinutes);

  // Modal Visibility States
  const [isChewiesModalOpen, setIsChewiesModalOpen] = useState<boolean>(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isInitialFirstUse, setIsInitialFirstUse] = useState<boolean>(false);

  // Toast banner message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Tracks which accountIds have already had their (empty) cloud collections seeded
  // from local data, so we don't re-seed on every snapshot.
  const seededLogsRef = useRef<Set<string>>(new Set());
  const seededPhotosRef = useRef<Set<string>>(new Set());

  // Set right before applying an incoming Firestore snapshot to local state.
  // Without this, applying a remote update triggers this same client's own
  // cloud-sync effect, which re-writes the same data right back — and with a
  // second device doing the same thing, stale echo-writes can race a genuine
  // change and stomp it back to the previous value. The cloud-sync effects
  // check this flag and skip (consuming it) when the change they're about to
  // sync was the one that just arrived from the cloud, not a local edit.
  // (A content-hash comparison was tried here first, but Firestore doesn't
  // guarantee field order on read, so JSON.stringify comparisons against
  // locally-constructed objects false-mismatched and never actually skipped.)
  const isApplyingRemotePlanMetaRef = useRef<boolean>(false);
  const isApplyingRemoteProfileRef = useRef<boolean>(false);

  // Timestamp of the last local wear-status toggle for the current account,
  // '' if none yet this session. Resolves a separate race: on page load the
  // app renders instantly from local cache while the live listener's first
  // snapshot (reflecting whatever was last saved before this page opened) is
  // still in flight. If the user acts before that snapshot lands, it must
  // not blindly overwrite their fresher click with stale server data.
  const activeTimerUpdatedAtRef = useRef<string>('');

  // The startTime of the out-session a closing WearLog was last written for.
  // Without this, calling handleToggleWearStatus('in') more than once for the
  // same still-open session (a stray double-click, a race between devices,
  // or the app briefly reverting to 'out' and getting toggled 'in' again)
  // writes a duplicate log each time, since nothing else remembers that this
  // particular out-session was already closed out.
  const lastLoggedOutStartTimeRef = useRef<string | null>(null);

  // Logs/photos added locally but not yet confirmed present in a wearLogs/
  // photos snapshot. The reconciliation below now treats the cloud snapshot
  // as authoritative (so a genuine deletion on another device actually
  // disappears here too) except for entries still in these maps, which
  // covers the brief window between a local add and its write landing.
  // An entry is dropped from the map the moment a snapshot confirms it, or
  // immediately on local delete so a fast add-then-delete can't resurrect it.
  const pendingNewLogsRef = useRef<Map<string, WearLog>>(new Map());
  const pendingNewPhotosRef = useRef<Map<string, PhotoEntry>>(new Map());

  // Firebase Auth Lifecycle
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    const unsubscribeQuota = subscribeToQuotaStatus((exceeded) => {
      if (exceeded) {
        setIsCloudLoaded(true);
      }
    });

    return () => {
      unsubscribeQuota();
      unsubscribeAuth();
    };
  }, []);

  // Reset cloud-loaded gate whenever the signed-in user or active account changes,
  // so we don't write pre-switch state into the new account's cloud doc.
  useEffect(() => {
    setIsCloudLoaded(false);
    activeTimerUpdatedAtRef.current = '';
    // These aren't scoped per account - without clearing them here, a log or
    // photo added on the previous profile right before switching, but not
    // yet confirmed by a snapshot, could leak into the newly-selected
    // profile's next merged view.
    pendingNewLogsRef.current.clear();
    pendingNewPhotosRef.current.clear();
  }, [authUser, currentAccountId]);

  // Subscribe to the account/profile list (small doc: /users/{uid}/profile/main)
  useEffect(() => {
    if (!authUser) return;

    const unsubscribe = subscribeToProfile(authUser.uid, (profile) => {
      if (profile) {
        isApplyingRemoteProfileRef.current = true;
        if (Array.isArray(profile.accounts) && profile.accounts.length > 0) {
          setAccounts(profile.accounts);
          saveAccounts(profile.accounts);
        }
        if (profile.currentAccountId) {
          setAccountIdState(profile.currentAccountId);
          setCurrentAccountId(profile.currentAccountId);
        }
        localStorage.setItem('aligner_tracker_has_onboarded_v1', 'true');
        setIsOnboardingOpen(false);
        setIsInitialFirstUse(false);
      } else {
        const hasOnboarded = localStorage.getItem('aligner_tracker_has_onboarded_v1');
        if (!hasOnboarded) {
          setIsInitialFirstUse(true);
          setIsOnboardingOpen(true);
        } else {
          // Existing local user signing in for the first time: seed the cloud profile.
          saveProfileToCloud(authUser.uid, { accounts, currentAccountId });
        }
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  // Subscribe to the active plan's settings/tasks/notifications/timer (small doc)
  useEffect(() => {
    if (!authUser) return;

    const unsubscribe = subscribeToPlanMeta(authUser.uid, currentAccountId, (meta) => {
      if (meta) {
        let activeTimerConflictsWithNewerLocalEdit = false;

        if (meta.activeTimer) {
          const localTs = activeTimerUpdatedAtRef.current;
          const incomingTs = meta.activeTimer.updatedAt || '';
          const incomingIsStale = localTs !== '' && incomingTs < localTs;

          if (incomingIsStale) {
            // A local toggle happened more recently than this snapshot reflects
            // (e.g. the user acted before the first listener snapshot arrived).
            // Keep local state and let it flow back out on the next sync pass.
            activeTimerConflictsWithNewerLocalEdit = true;
          } else {
            setWearStatus(meta.activeTimer.wearStatus || 'in');
            setCurrentOutStartTime(meta.activeTimer.startTime || null);
            setCurrentOutReason(meta.activeTimer.reason || null);
            setPresetTimerMinutes(meta.activeTimer.presetTimerMinutes || null);
            saveTimerState(meta.activeTimer, currentAccountId);
            activeTimerUpdatedAtRef.current = incomingTs || activeTimerUpdatedAtRef.current;
          }
        }

        // Only suppress the outgoing sync when nothing here was rejected as
        // stale — if we kept a fresher local activeTimer, that change still
        // needs to reach the cloud, so the sync effect must be allowed to run.
        if (!activeTimerConflictsWithNewerLocalEdit) {
          isApplyingRemotePlanMetaRef.current = true;
        }

        if (meta.settings) {
          setSettings(meta.settings);
          saveSettings(meta.settings, currentAccountId);
        }
        if (meta.tasks) {
          setTasks(meta.tasks);
          saveMaintenanceTasks(meta.tasks, currentAccountId);
        }
        if (meta.notifications) {
          setNotifications(meta.notifications);
          saveNotifications(meta.notifications, currentAccountId);
        }
      } else {
        // No cloud doc yet for this plan: seed it from current local state.
        const activeTimer: ActiveTimerState = {
          wearStatus,
          startTime: currentOutStartTime,
          reason: currentOutReason,
          presetTimerMinutes,
          updatedAt: activeTimerUpdatedAtRef.current || new Date().toISOString(),
        };
        savePlanMetaToCloud(authUser.uid, currentAccountId, { settings, tasks, notifications, activeTimer });
      }
      setIsCloudLoaded(true);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, currentAccountId]);

  // Subscribe to wear logs (unbounded collection, one document per log)
  useEffect(() => {
    if (!authUser) return;

    const unsubscribe = subscribeToWearLogs(authUser.uid, currentAccountId, (cloudLogs) => {
      if (cloudLogs.length === 0 && !seededLogsRef.current.has(currentAccountId)) {
        seededLogsRef.current.add(currentAccountId);
        const localLogs = loadLogs(currentAccountId);
        localLogs.forEach((log) => saveWearLogToCloud(authUser.uid, currentAccountId, log));
        return;
      }

      seededLogsRef.current.add(currentAccountId);

      // Cloud is authoritative (a genuine deletion elsewhere must actually
      // disappear here). Only entries still pending confirmation survive on
      // top of it, so a just-added log doesn't flicker away before its own
      // write lands.
      const cloudIds = new Set(cloudLogs.map((l) => l.id));
      for (const id of Array.from(pendingNewLogsRef.current.keys())) {
        if (cloudIds.has(id)) pendingNewLogsRef.current.delete(id);
      }
      const merged = [...cloudLogs, ...Array.from(pendingNewLogsRef.current.values())].sort((a, b) => {
        const timeA = new Date(a.startTime || a.date).getTime();
        const timeB = new Date(b.startTime || b.date).getTime();
        return timeB - timeA;
      });
      setLogs(merged);
      saveLogs(merged, currentAccountId);
    });

    return unsubscribe;
  }, [authUser, currentAccountId]);

  // Subscribe to photos (unbounded collection; images live in Storage, Firestore holds URLs)
  useEffect(() => {
    if (!authUser) return;

    const unsubscribe = subscribeToPhotos(authUser.uid, currentAccountId, (cloudPhotos) => {
      if (cloudPhotos.length === 0 && !seededPhotosRef.current.has(currentAccountId)) {
        seededPhotosRef.current.add(currentAccountId);
        const localPhotos = loadPhotos(currentAccountId).filter((p) => p.imageUrl?.startsWith('http'));
        localPhotos.forEach((photo) => savePhotoToCloud(authUser.uid, currentAccountId, photo));
        return;
      }

      seededPhotosRef.current.add(currentAccountId);

      const cloudIds = new Set(cloudPhotos.map((p) => p.id));
      for (const id of Array.from(pendingNewPhotosRef.current.keys())) {
        if (cloudIds.has(id)) pendingNewPhotosRef.current.delete(id);
      }
      const merged = [...cloudPhotos, ...Array.from(pendingNewPhotosRef.current.values())].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setPhotos(merged);
      savePhotos(merged, currentAccountId);
    }, (err) => {
      console.error('Photo sync subscription failed:', err);
      showToast(`Photo sync error: ${err?.code || err?.message || 'unknown error'}`);
    });

    return unsubscribe;
  }, [authUser, currentAccountId]);

  // Always persist locally for immediate offline resilience
  useEffect(() => {
    const activeTimer: ActiveTimerState = {
      wearStatus,
      startTime: currentOutStartTime,
      reason: currentOutReason,
      presetTimerMinutes,
    };
    saveSettings(settings, currentAccountId);
    saveLogs(logs, currentAccountId);
    saveMaintenanceTasks(tasks, currentAccountId);
    savePhotos(photos, currentAccountId);
    saveNotifications(notifications, currentAccountId);
    saveAccounts(accounts);
    saveTimerState(activeTimer, currentAccountId);
  }, [
    currentAccountId,
    settings,
    logs,
    tasks,
    photos,
    notifications,
    accounts,
    wearStatus,
    currentOutStartTime,
    currentOutReason,
    presetTimerMinutes,
  ]);

  // Sync plan meta (settings/tasks/notifications/timer) to cloud on change
  useEffect(() => {
    if (!authUser || !isCloudLoaded) return;
    if (isApplyingRemotePlanMetaRef.current) {
      isApplyingRemotePlanMetaRef.current = false;
      return;
    }
    const activeTimer: ActiveTimerState = {
      wearStatus,
      startTime: currentOutStartTime,
      reason: currentOutReason,
      presetTimerMinutes,
      updatedAt: activeTimerUpdatedAtRef.current || new Date().toISOString(),
    };
    savePlanMetaToCloud(authUser.uid, currentAccountId, { settings, tasks, notifications, activeTimer });
  }, [authUser, isCloudLoaded, currentAccountId, settings, tasks, notifications, wearStatus, currentOutStartTime, currentOutReason, presetTimerMinutes]);

  // Sync profile (accounts list + current selection) to cloud on change
  useEffect(() => {
    if (!authUser || !isCloudLoaded) return;
    if (isApplyingRemoteProfileRef.current) {
      isApplyingRemoteProfileRef.current = false;
      return;
    }
    saveProfileToCloud(authUser.uid, { accounts, currentAccountId });
  }, [authUser, isCloudLoaded, accounts, currentAccountId]);

  // Switch current account
  const handleSelectAccount = (id: string) => {
    setCurrentAccountId(id);
    setAccountIdState(id);

    setSettings(loadSettings(id));
    setLogs(loadLogs(id));
    setTasks(loadMaintenanceTasks(id));
    setPhotos(loadPhotos(id));
    setNotifications(loadNotifications(id));
    const localTimer = loadTimerState(id);
    setWearStatus(localTimer.wearStatus);
    setCurrentOutStartTime(localTimer.startTime);
    setCurrentOutReason(localTimer.reason);
    setPresetTimerMinutes(localTimer.presetTimerMinutes);

    const selected = accounts.find((a) => a.id === id);
    if (selected) {
      showToast(`Switched to plan for ${selected.name}`);
    }
  };

  // Create new account profile & plan via Onboarding Wizard
  const handleCompleteOnboarding = (newProfile: UserProfile, newSettings: AlignerSettings) => {
    const updatedAccounts = [...accounts, newProfile];
    setAccounts(updatedAccounts);
    saveAccounts(updatedAccounts);

    // Save individual plan settings for new account ID
    saveSettings(newSettings, newProfile.id);

    const welcomeNotifications: NotificationLog[] = [
      {
        id: `notif_welcome_${Date.now()}`,
        title: `Welcome to your plan, ${newProfile.name}! 🎉`,
        body: `Your individual ${newProfile.planType} treatment plan is active. Wear target set to ${newSettings.dailyTargetHours} hours daily.`,
        timestamp: new Date().toISOString(),
        type: 'goal_achieved',
        read: false,
      },
    ];

    // Switch active account to the new profile
    setCurrentAccountId(newProfile.id);
    setAccountIdState(newProfile.id);
    setSettings(newSettings);
    setLogs([]);
    setTasks(INITIAL_MAINTENANCE_TASKS);
    setPhotos([]);
    setNotifications(welcomeNotifications);

    if (authUser) {
      saveProfileToCloud(authUser.uid, { accounts: updatedAccounts, currentAccountId: newProfile.id });
      savePlanMetaToCloud(authUser.uid, newProfile.id, {
        settings: newSettings,
        tasks: INITIAL_MAINTENANCE_TASKS,
        notifications: welcomeNotifications,
        activeTimer: { wearStatus: 'in', startTime: null, reason: null, presetTimerMinutes: null },
      });
    }

    localStorage.setItem('aligner_tracker_has_onboarded_v1', 'true');
    setIsOnboardingOpen(false);
    setIsInitialFirstUse(false);
    showToast(`Treatment plan for ${newProfile.name} activated! 🎉`);
  };

  // Delete account profile
  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) {
      showToast('At least one account plan must remain.');
      return;
    }
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    saveAccounts(updated);

    if (authUser) {
      deletePlanFromCloud(authUser.uid, id);
    }

    if (currentAccountId === id) {
      const fallbackId = updated[0].id;
      handleSelectAccount(fallbackId);
    } else {
      showToast('Account profile deleted');
    }
  };

  // Update account profile info
  const handleUpdateAccountProfile = (updatedProfile: UserProfile) => {
    const updated = accounts.map((a) => (a.id === updatedProfile.id ? updatedProfile : a));
    setAccounts(updated);
    saveAccounts(updated);
    showToast('Account profile updated');
  };

  // Filter logs for today
  const todayStr = getTodayDateString();
  const todayLogs = logs.filter((l) => l.date === todayStr);

  // Toggle Wear Status (In <-> Out)
  const handleToggleWearStatus = (newStatus: WearStatus, reason?: OutReason, presetMins?: number) => {
    activeTimerUpdatedAtRef.current = new Date().toISOString();

    if (newStatus === 'out') {
      const nowIso = new Date().toISOString();
      lastLoggedOutStartTimeRef.current = null;
      setWearStatus('out');
      setCurrentOutStartTime(nowIso);
      setCurrentOutReason(reason || 'lunch');
      setPresetTimerMinutes(presetMins || null);
      showToast(`Aligners taken OUT for ${reason || 'meal'}`);
    } else {
      // Put aligners back in: save out session log entry, but only once per
      // session — if this fires again for the same startTime (double-click,
      // multi-device, or a UI hiccup), skip re-logging it.
      if (currentOutStartTime && currentOutStartTime !== lastLoggedOutStartTimeRef.current) {
        lastLoggedOutStartTimeRef.current = currentOutStartTime;
        const nowMs = Date.now();
        const startMs = new Date(currentOutStartTime).getTime();
        const durationMins = Math.max(1, Math.round((nowMs - startMs) / 60000));

        const newLog: WearLog = {
          id: `log_${Date.now()}`,
          date: todayStr,
          type: 'out',
          startTime: currentOutStartTime,
          endTime: new Date().toISOString(),
          durationMinutes: durationMins,
          reason: currentOutReason || 'lunch',
        };

        pendingNewLogsRef.current.set(newLog.id, newLog);
        const updatedLogs = [newLog, ...logs];
        setLogs(updatedLogs);
        saveLogs(updatedLogs, currentAccountId);
        if (authUser) {
          saveWearLogToCloud(authUser.uid, currentAccountId, newLog).then((ok) => {
            if (!ok) showToast('Saved on this device only — this log failed to sync to the cloud.');
          });
        }

        showToast(`Aligners back IN! Logged ${durationMins}m out time.`);
      }

      setWearStatus('in');
      setCurrentOutStartTime(null);
      setCurrentOutReason(null);
      setPresetTimerMinutes(null);
    }
  };

  // Add Manual Log Entry
  const handleAddLog = (logData: Omit<WearLog, 'id'>) => {
    const newLog: WearLog = {
      ...logData,
      id: `log_${Date.now()}`,
    };

    pendingNewLogsRef.current.set(newLog.id, newLog);
    const updated = [newLog, ...logs];
    setLogs(updated);
    saveLogs(updated, currentAccountId);
    if (authUser) {
      saveWearLogToCloud(authUser.uid, currentAccountId, newLog).then((ok) => {
        if (!ok) showToast('Saved on this device only — this log failed to sync to the cloud.');
      });
    }
    showToast('Manual log entry saved');
  };

  // Edit Existing Log Entry
  const handleEditLog = (updatedLog: WearLog) => {
    const updated = logs.map((l) => (l.id === updatedLog.id ? updatedLog : l));
    setLogs(updated);
    saveLogs(updated, currentAccountId);
    if (authUser) {
      saveWearLogToCloud(authUser.uid, currentAccountId, updatedLog).then((ok) => {
        if (!ok) showToast('Saved on this device only — this log update failed to sync to the cloud.');
      });
    }
    showToast('Log entry updated');
  };

  // Delete Log Entry
  const handleDeleteLog = (id: string) => {
    pendingNewLogsRef.current.delete(id);
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveLogs(updated, currentAccountId);
    if (authUser) {
      deleteWearLogFromCloud(authUser.uid, currentAccountId, id).then((ok) => {
        if (!ok) showToast('Removed on this device only — the cloud copy failed to delete.');
      });
    }
    showToast('Log entry removed');
  };

  // Toggle Maintenance Task
  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
    setTasks(updated);
    saveMaintenanceTasks(updated, currentAccountId);
  };

  // Complete Chewies Exercise
  const handleCompleteChewies = (minutes: number) => {
    const updated = tasks.map((t) =>
      t.category === 'chewies' ? { ...t, completed: true, timeSpentMinutes: minutes } : t
    );
    setTasks(updated);
    saveMaintenanceTasks(updated, currentAccountId);
    setIsChewiesModalOpen(false);
    showToast(`Great job! Completed ${minutes}-minute chewies seating exercise.`);
  };

  // Update Settings
  const handleUpdateSettings = (newSettings: AlignerSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings, currentAccountId);
    showToast('Settings updated');
  };

  // Photos Handler: uploads the real file to Storage (when signed in) and stores only the URL.
  // The whole body is wrapped in try/catch so any failure - e.g. fileToDataUrl
  // throwing, not just the upload itself - surfaces as a toast instead of
  // rejecting silently; PhotoDiary awaits this and shows a saving spinner.
  //
  // The cloud upload is only raced against a short timeout for *display*
  // purposes (so a slow connection doesn't leave the save button spinning
  // forever) - the real upload promise is never abandoned. If it finishes
  // later, the local-only entry is upgraded in place to the synced cloud
  // version so it still ends up on other devices instead of being stuck
  // local-only just because it was slow.
  const handleAddPhoto = async (photoData: Omit<PhotoEntry, 'id'>, file?: File) => {
    const newId = `photo_${Date.now()}`;
    let imageUrl = photoData.imageUrl;
    let cloudUploadFailed = false;

    const describeError = (err: unknown): string => {
      const anyErr = err as any;
      return anyErr?.code || anyErr?.message || String(err);
    };

    try {
      let backgroundUpload: Promise<string> | null = null;
      let immediateUploadError: unknown = null;

      if (file) {
        if (authUser) {
          const uploadPromise = uploadPhotoFile(authUser.uid, currentAccountId, newId, file);
          const timeoutMarker = Symbol('upload-timeout');
          try {
            imageUrl = await Promise.race([
              uploadPromise,
              new Promise<typeof timeoutMarker>((resolve) => setTimeout(() => resolve(timeoutMarker), 20000)),
            ]).then((result) => {
              if (result === timeoutMarker) throw timeoutMarker;
              return result as string;
            });
          } catch (err) {
            cloudUploadFailed = true;
            imageUrl = await fileToDataUrl(file);
            if (err === timeoutMarker) {
              // Just slow, not (yet) failed — keep waiting on the real upload in the background.
              backgroundUpload = uploadPromise;
            } else {
              // The upload itself rejected — a real, immediate failure, not a timeout.
              console.error('Photo cloud upload failed:', err);
              immediateUploadError = err;
            }
          }
        } else {
          // Not signed in: no cloud storage available, keep the photo local-only.
          imageUrl = await fileToDataUrl(file);
        }
      }

      const newPhoto: PhotoEntry = { ...photoData, imageUrl, id: newId };
      pendingNewPhotosRef.current.set(newPhoto.id, newPhoto);
      const updated = [newPhoto, ...photos];
      setPhotos(updated);
      savePhotos(updated, currentAccountId);

      if (authUser && imageUrl.startsWith('http')) {
        savePhotoToCloud(authUser.uid, currentAccountId, newPhoto).then((ok) => {
          if (!ok) showToast('Photo saved on this device only — its cloud record failed to save.');
        });
      }

      if (backgroundUpload) {
        backgroundUpload
          .then((uploadedUrl) => {
            const syncedPhoto: PhotoEntry = { ...newPhoto, imageUrl: uploadedUrl };
            pendingNewPhotosRef.current.set(syncedPhoto.id, syncedPhoto);
            setPhotos((prev) => {
              const next = prev.map((p) => (p.id === newId ? syncedPhoto : p));
              savePhotos(next, currentAccountId);
              return next;
            });
            return savePhotoToCloud(authUser!.uid, currentAccountId, syncedPhoto);
          })
          .then((ok) => {
            if (ok) showToast('Smile photo finished uploading and is now synced to your other devices.');
          })
          .catch((err) => {
            console.error('Background photo upload ultimately failed:', err);
            showToast(`Cloud upload ultimately failed (${describeError(err)}) — photo stays on this device only.`);
          });
      }

      if (immediateUploadError) {
        showToast(`Photo saved on this device only — cloud upload failed (${describeError(immediateUploadError)}).`);
      } else if (cloudUploadFailed) {
        showToast('Upload is taking a while — photo saved on this device for now, it will sync once the upload finishes.');
      } else {
        showToast('Smile photo saved to progress diary');
      }
    } catch (err) {
      console.error('Failed to save photo:', err);
      showToast('Could not save that photo. Please try again.');
    }
  };

  const handleDeletePhoto = (id: string) => {
    pendingNewPhotosRef.current.delete(id);
    const updated = photos.filter((p) => p.id !== id);
    setPhotos(updated);
    savePhotos(updated, currentAccountId);
    if (authUser) {
      deletePhotoFromCloud(authUser.uid, currentAccountId, id).then((ok) => {
        if (!ok) showToast('Removed on this device only — the cloud copy failed to delete.');
      });
    }
    showToast('Photo removed');
  };

  // Notifications Handler
  const handleAddNotification = (notifData: Omit<NotificationLog, 'id'>) => {
    const newNotif: NotificationLog = {
      ...notifData,
      id: `notif_${Date.now()}`,
    };
    const updated = [newNotif, ...notifications];
    setNotifications(updated);
    saveNotifications(updated, currentAccountId);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    saveNotifications([], currentAccountId);
    showToast('Notifications cleared');
  };

  const handleResetAllData = () => {
    if (confirm(`Reset aligner tracking data for profile "${currentAccount?.name}"?`)) {
      setSettings(DEFAULT_SETTINGS);
      setLogs([]);
      setTasks(INITIAL_MAINTENANCE_TASKS);
      setPhotos(INITIAL_PHOTOS);
      setNotifications(INITIAL_NOTIFICATIONS);
      saveSettings(DEFAULT_SETTINGS, currentAccountId);
      saveLogs([], currentAccountId);
      saveMaintenanceTasks(INITIAL_MAINTENANCE_TASKS, currentAccountId);
      savePhotos(INITIAL_PHOTOS, currentAccountId);
      saveNotifications(INITIAL_NOTIFICATIONS, currentAccountId);
      if (authUser) {
        deletePlanFromCloud(authUser.uid, currentAccountId);
        savePlanMetaToCloud(authUser.uid, currentAccountId, {
          settings: DEFAULT_SETTINGS,
          tasks: INITIAL_MAINTENANCE_TASKS,
          notifications: INITIAL_NOTIFICATIONS,
          activeTimer: { wearStatus: 'in', startTime: null, reason: null, presetTimerMinutes: null },
        });
      }
      setIsSettingsModalOpen(false);
      showToast('Plan data reset for current profile');
    }
  };

  // Wipes every plan's Firestore/Storage data for this account. The caller
  // (SettingsModal) is responsible for deleting the Firebase Auth user itself
  // afterward, since that step needs its own re-authentication handling.
  const handleDeleteAllCloudData = async () => {
    if (!authUser) return;
    await deleteAllPlansFromCloud(
      authUser.uid,
      accounts.map((a) => a.id)
    );
    localStorage.clear();
  };

  const handleImportBackup = (backupData: any) => {
    if (backupData.settings) {
      setSettings(backupData.settings);
      saveSettings(backupData.settings, currentAccountId);
    }
    if (Array.isArray(backupData.logs) && backupData.logs.length > 0) {
      const merged = mergeLogs(logs, backupData.logs);
      setLogs(merged);
      saveLogs(merged, currentAccountId);
      if (authUser) {
        backupData.logs.forEach((log: WearLog) => saveWearLogToCloud(authUser.uid, currentAccountId, log));
      }
    }
    if (Array.isArray(backupData.tasks) && backupData.tasks.length > 0) {
      setTasks(backupData.tasks);
      saveMaintenanceTasks(backupData.tasks, currentAccountId);
    }
    if (Array.isArray(backupData.notifications) && backupData.notifications.length > 0) {
      setNotifications(backupData.notifications);
      saveNotifications(backupData.notifications, currentAccountId);
    }
    if (Array.isArray(backupData.photos) && backupData.photos.length > 0) {
      // Photo binaries live in Storage, not the backup file - only URL-backed
      // entries (already-synced photos) can be safely restored; local-only
      // data-URI photos from another device wouldn't resolve here anyway.
      const restorablePhotos = backupData.photos.filter((p: PhotoEntry) => p.imageUrl?.startsWith('http'));
      const merged = mergePhotos(photos, restorablePhotos);
      setPhotos(merged);
      savePhotos(merged, currentAccountId);
    }
    showToast('Backup data restored and merged successfully!');
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 via-teal-400 to-cyan-400 flex items-center justify-center text-slate-950 shadow-xl shadow-teal-500/20">
            <Smile className="w-8 h-8 stroke-[2.2]" />
          </div>
          <Loader2 className="w-5 h-5 text-teal-400 animate-spin mt-2" />
          <span className="text-xs font-semibold text-slate-400">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onSuccessToast={showToast} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-teal-500 selection:text-slate-950 flex flex-col">
      {/* Toast Banner Notification — anchored to the top so it never
          overlaps the floating bottom nav on mobile */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] bg-slate-900 border border-teal-500/40 text-teal-300 text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header — mobile-only (<1024px), and only on non-Home
          tabs; the desktop sidebar/top bar below own that role at >=1024px,
          and the Home tab has its own embedded header at every size below
          that breakpoint. */}
      <div className={activeTab === 'quick' ? 'hidden' : 'lg:hidden'}>
        <Navbar
          currentTray={settings.currentTray}
          totalTrays={settings.totalTrays}
          wearStatus={wearStatus}
          currentOutStartTime={currentOutStartTime}
          unreadCount={unreadNotifCount}
          currentAccount={currentAccount}
          settings={settings}
          authUser={authUser}
          onOpenNotifications={() => setIsNotifModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenChewiesTimer={() => setIsChewiesModalOpen(true)}
          onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
        />
      </div>

      <div className="flex-1 flex">
        {/* Persistent desktop sidebar (>=1024px only) — hidden/zero-width
            below that, so this row collapses to a single full-width mobile
            column naturally, no separate mobile-only wrapper needed. */}
        <div className="hidden lg:block">
          <TrayceSidebar
            theme={trayceTheme}
            active={activeTab === 'quick' ? 'home' : activeTab}
            onNavigate={(destination: TrayceNavDestination) =>
              setActiveTab(destination === 'home' ? 'quick' : destination)
            }
            currentAccount={currentAccount}
            avatarUrl={authUser?.photoURL}
            onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        </div>

        <div className={`flex-1 min-w-0 flex flex-col tz-scope tz-${trayceTheme}`}>
          <div className="hidden lg:block" style={{ backgroundColor: 'var(--tz-bg-canvas)' }}>
            <TrayceTopBar
              theme={trayceTheme}
              onThemeChange={setTrayceTheme}
              unreadCount={unreadNotifCount}
              avatarUrl={authUser?.photoURL}
              onOpenNotifications={() => setIsNotifModalOpen(true)}
              onOpenProfile={() => setIsSettingsModalOpen(true)}
            />
          </div>

          {activeTab === 'quick' && (
            <HomeView
              firstName={currentAccount?.name?.split(' ')[0] || 'there'}
              avatarUrl={authUser?.photoURL}
              theme={trayceTheme}
              onThemeChange={setTrayceTheme}
              wearStatus={wearStatus}
              currentOutStartTime={currentOutStartTime}
              currentOutReason={currentOutReason}
              todayLogs={todayLogs}
              allLogs={logs}
              settings={settings}
              tasks={tasks}
              onToggleStatus={handleToggleWearStatus}
              onOpenProfile={() => setIsSettingsModalOpen(true)}
              onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
              onOpenDailyPlan={() => setIsDailyPlanOpen(true)}
              onOpenTreatment={() => setIsTreatmentSheetOpen(true)}
            />
          )}

          <Suspense fallback={<TabLoadingFallback />}>
            {activeTab === 'logs' && (
              <div className="flex-1 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-28 lg:pb-10 max-w-6xl w-full mx-auto lg:mx-0">
                <DailyLogsList
                  logs={logs}
                  settings={settings}
                  onAddLog={handleAddLog}
                  onEditLog={handleEditLog}
                  onDeleteLog={handleDeleteLog}
                />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="flex-1 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-28 lg:pb-10 max-w-6xl w-full mx-auto lg:mx-0">
                <AnalyticsView logs={logs} settings={settings} />
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="flex-1 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-28 lg:pb-10 max-w-6xl w-full mx-auto lg:mx-0">
                <PhotoDiary
                  photos={photos}
                  settings={settings}
                  onAddPhoto={handleAddPhoto}
                  onDeletePhoto={handleDeletePhoto}
                />
              </div>
            )}
          </Suspense>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Dock (<1024px) */}
      <div className="lg:hidden">
        <TrayceBottomNav
          theme={trayceTheme}
          active={activeTab === 'quick' ? 'home' : activeTab}
          onNavigate={(destination: TrayceNavDestination) =>
            setActiveTab(destination === 'home' ? 'quick' : destination)
          }
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AlignerTrack Orthodontic Wear & Maintenance System</span>
          <span>
            Active Profile: {currentAccount?.name} ({currentAccount?.planType})
          </span>
        </div>
      </footer>

      {/* MODALS: each only mounted (and its code fetched) while actually open */}
      <Suspense fallback={null}>
        {isChewiesModalOpen && (
          <ChewiesTimerModal
            isOpen={isChewiesModalOpen}
            onClose={() => setIsChewiesModalOpen(false)}
            onCompleteExercise={handleCompleteChewies}
          />
        )}

        {isDailyPlanOpen && (
          <DailyPlanSheet
            theme={trayceTheme}
            tasks={tasks}
            settings={settings}
            onToggleTask={handleToggleTask}
            onOpenChewiesTimer={() => {
              setIsDailyPlanOpen(false);
              setIsChewiesModalOpen(true);
            }}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setIsDailyPlanOpen(false)}
          />
        )}

        {isTreatmentSheetOpen && (
          <TreatmentSheet
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenPhotoDiary={() => {
              setIsTreatmentSheetOpen(false);
              setActiveTab('photos');
            }}
            onClose={() => setIsTreatmentSheetOpen(false)}
          />
        )}

        {isNotifModalOpen && (
          <NotificationCenterModal
            isOpen={isNotifModalOpen}
            notifications={notifications}
            onClose={() => setIsNotifModalOpen(false)}
            onClearAll={handleClearNotifications}
            onAddNotification={handleAddNotification}
          />
        )}

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            settings={settings}
            currentAccountId={currentAccountId}
            logs={logs}
            photos={photos}
            tasks={tasks}
            notifications={notifications}
            accounts={accounts}
            authUser={authUser}
            onClose={() => setIsSettingsModalOpen(false)}
            onSave={handleUpdateSettings}
            onResetAll={handleResetAllData}
            onImportBackup={handleImportBackup}
            onDeleteAllCloudData={handleDeleteAllCloudData}
            onOpenAuthModal={() => {
              setIsSettingsModalOpen(false);
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            user={authUser}
            onClose={() => setIsAuthModalOpen(false)}
            onSuccessToast={showToast}
          />
        )}

        {isAccountSwitcherOpen && (
          <AccountSwitcherModal
            isOpen={isAccountSwitcherOpen}
            accounts={accounts}
            currentAccountId={currentAccountId}
            authUser={authUser}
            onClose={() => setIsAccountSwitcherOpen(false)}
            onSelectAccount={handleSelectAccount}
            onCreateNewPlan={() => setIsOnboardingOpen(true)}
            onDeleteAccount={handleDeleteAccount}
            onUpdateAccountProfile={handleUpdateAccountProfile}
            onSuccessToast={showToast}
          />
        )}

        {isOnboardingOpen && (
          <OnboardingModal
            isOpen={isOnboardingOpen}
            onClose={() => setIsOnboardingOpen(false)}
            onComplete={handleCompleteOnboarding}
            isInitialFirstUse={isInitialFirstUse}
          />
        )}
      </Suspense>
    </div>
  );
}
