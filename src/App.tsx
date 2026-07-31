import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { TrayProgressCard } from './components/TrayProgressCard';
import { DailyLogsList } from './components/DailyLogsList';
import { AnalyticsView } from './components/AnalyticsView';
import { PhotoDiary } from './components/PhotoDiary';
import { OrthodontistCard } from './components/OrthodontistCard';
import { ChewiesTimerModal } from './components/ChewiesTimerModal';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AccountSwitcherModal } from './components/AccountSwitcherModal';
import { QuickTrackView } from './components/QuickTrackView';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './components/LoginScreen';

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

import { Clock, BarChart3, Camera, Sparkles, CheckCircle2, Zap, Settings, Smile, Loader2 } from 'lucide-react';

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
  const handleAddPhoto = async (photoData: Omit<PhotoEntry, 'id'>, file?: File) => {
    const newId = `photo_${Date.now()}`;
    let imageUrl = photoData.imageUrl;
    let cloudUploadFailed = false;

    if (file) {
      if (authUser) {
        try {
          imageUrl = await uploadPhotoFile(authUser.uid, currentAccountId, newId, file);
        } catch (err) {
          console.error('Photo upload to cloud storage failed, keeping it local-only:', err);
          cloudUploadFailed = true;
          imageUrl = await fileToDataUrl(file);
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

    if (cloudUploadFailed) {
      showToast('Photo saved on this device only — cloud upload failed, it will not sync to other devices.');
    } else {
      showToast('Smile photo saved to progress diary');
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
      {/* Toast Banner Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-teal-500/40 text-teal-300 text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        currentTray={settings.currentTray}
        totalTrays={settings.totalTrays}
        wearStatus={wearStatus}
        unreadCount={unreadNotifCount}
        currentAccount={currentAccount}
        settings={settings}
        authUser={authUser}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenChewiesTimer={() => setIsChewiesModalOpen(true)}
        onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-28 sm:pb-12 space-y-6">
        {/* Top Navigation Tabs Bar (Desktop & Tablet) */}
        <div className="hidden sm:flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl w-full sm:w-auto overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'quick'
                ? 'bg-gradient-to-r from-amber-400 via-teal-400 to-cyan-400 text-slate-950 font-bold shadow-lg shadow-teal-500/15 ring-1 ring-amber-300/30'
                : 'text-amber-300/90 hover:text-amber-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400/30" />
            <span>Quick Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-teal-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Out Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-teal-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics & Report</span>
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'photos'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-teal-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Smile Diary</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'quick' && (
          <div className="space-y-6">
            <QuickTrackView
              wearStatus={wearStatus}
              currentOutStartTime={currentOutStartTime}
              currentOutReason={currentOutReason}
              todayLogs={todayLogs}
              settings={settings}
              tasks={tasks}
              onToggleStatus={handleToggleWearStatus}
              onToggleTask={handleToggleTask}
              onOpenChewiesTimer={() => setIsChewiesModalOpen(true)}
              onOpenAddManualLog={() => setActiveTab('logs')}
              onUpdateSettings={handleUpdateSettings}
            />

            <div className="max-w-md mx-auto w-full space-y-6">
              <TrayProgressCard
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onOpenPhotoDiary={() => setActiveTab('photos')}
              />

              <OrthodontistCard settings={settings} onUpdateSettings={handleUpdateSettings} />
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <DailyLogsList
            logs={logs}
            settings={settings}
            onAddLog={handleAddLog}
            onEditLog={handleEditLog}
            onDeleteLog={handleDeleteLog}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsView logs={logs} settings={settings} />}

        {activeTab === 'photos' && (
          <PhotoDiary
            photos={photos}
            settings={settings}
            onAddPhoto={handleAddPhoto}
            onDeletePhoto={handleDeletePhoto}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Dock */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl px-2 py-2.5 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'quick'
              ? 'text-amber-300 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-5 h-5 fill-amber-400/20 text-amber-400" />
          <span className="text-[10px]">Quick</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'logs'
              ? 'text-teal-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px]">Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'analytics'
              ? 'text-teal-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">Stats</span>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'photos'
              ? 'text-teal-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px]">Diary</span>
        </button>

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition-all text-slate-400 hover:text-slate-200"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AlignerTrack Orthodontic Wear & Maintenance System</span>
          <span>
            Active Profile: {currentAccount?.name} ({currentAccount?.planType})
          </span>
        </div>
      </footer>

      {/* MODALS */}
      <ChewiesTimerModal
        isOpen={isChewiesModalOpen}
        onClose={() => setIsChewiesModalOpen(false)}
        onCompleteExercise={handleCompleteChewies}
      />

      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        notifications={notifications}
        onClose={() => setIsNotifModalOpen(false)}
        onClearAll={handleClearNotifications}
        onAddNotification={handleAddNotification}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        settings={settings}
        logs={logs}
        authUser={authUser}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleUpdateSettings}
        onResetAll={handleResetAllData}
        onImportBackup={handleImportBackup}
        onOpenAuthModal={() => {
          setIsSettingsModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        user={authUser}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccessToast={showToast}
      />

      <AccountSwitcherModal
        isOpen={isAccountSwitcherOpen}
        accounts={accounts}
        currentAccountId={currentAccountId}
        onClose={() => setIsAccountSwitcherOpen(false)}
        onSelectAccount={handleSelectAccount}
        onCreateNewPlan={() => setIsOnboardingOpen(true)}
        onDeleteAccount={handleDeleteAccount}
        onUpdateAccountProfile={handleUpdateAccountProfile}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleCompleteOnboarding}
        isInitialFirstUse={isInitialFirstUse}
      />
    </div>
  );
}
