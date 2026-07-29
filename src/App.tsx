import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { WearTimerCard } from './components/WearTimerCard';
import { TrayProgressCard } from './components/TrayProgressCard';
import { DailyLogsList } from './components/DailyLogsList';
import { MaintenanceChecklist } from './components/MaintenanceChecklist';
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
  subscribeToUserData,
  saveUserDataToCloud,
  subscribeToQuotaStatus,
  ActiveTimerState,
  PerPlanData,
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
  DEFAULT_SETTINGS,
  INITIAL_MAINTENANCE_TASKS,
  INITIAL_PHOTOS,
  INITIAL_NOTIFICATIONS,
} from './utils/storage';

import { LayoutDashboard, Clock, BarChart3, Camera, Sparkles, CheckCircle2, Zap, Settings, Smile, Loader2 } from 'lucide-react';

export default function App() {
  // Auth & Cloud Sync State
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);
  const isCloudHydratedRef = useRef<boolean>(false);

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
  const [activeTab, setActiveTab] = useState<'quick' | 'dashboard' | 'logs' | 'analytics' | 'photos'>('quick');

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

  const currentAccountIdRef = useRef<string>(currentAccountId);
  useEffect(() => {
    currentAccountIdRef.current = currentAccountId;
  }, [currentAccountId]);

  const plansMapRef = useRef<Record<string, PerPlanData>>({});
  const lastCloudHashRef = useRef<string>('');

  // Firebase Auth Lifecycle & Live Cloud Sync Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (!user) {
        isCloudHydratedRef.current = false;
        setIsCloudLoaded(false);
        return;
      }

      // Subscribe to real-time cross-device updates from Firestore
      const unsubscribeCloud = subscribeToUserData(user.uid, (cloudData, exists) => {
        if (exists) {
          lastCloudHashRef.current = JSON.stringify(cloudData);

          if (cloudData.plans) {
            plansMapRef.current = cloudData.plans;
          }

          if (cloudData.accounts && Array.isArray(cloudData.accounts) && cloudData.accounts.length > 0) {
            setAccounts(cloudData.accounts);
            saveAccounts(cloudData.accounts);
          }

          if (cloudData.currentAccountId) {
            setAccountIdState(cloudData.currentAccountId);
            setCurrentAccountId(cloudData.currentAccountId);
            currentAccountIdRef.current = cloudData.currentAccountId;
          }

          const activeAccId = cloudData.currentAccountId || currentAccountIdRef.current;
          const planObj = cloudData.plans?.[activeAccId];

          if (planObj) {
            if (planObj.settings) {
              setSettings(planObj.settings);
              saveSettings(planObj.settings, activeAccId);
            }
            if (planObj.logs) {
              const currentLocalLogs = loadLogs(activeAccId);
              const merged = mergeLogs(currentLocalLogs, planObj.logs);
              setLogs(merged);
              saveLogs(merged, activeAccId);
            }
            if (planObj.tasks) {
              setTasks(planObj.tasks);
              saveMaintenanceTasks(planObj.tasks, activeAccId);
            }
            if (planObj.photos) {
              setPhotos(planObj.photos);
              savePhotos(planObj.photos, activeAccId);
            }
            if (planObj.notifications) {
              setNotifications(planObj.notifications);
              saveNotifications(planObj.notifications, activeAccId);
            }
            if (planObj.activeTimer) {
              setWearStatus(planObj.activeTimer.wearStatus || 'in');
              setCurrentOutStartTime(planObj.activeTimer.startTime || null);
              setCurrentOutReason(planObj.activeTimer.reason || null);
              setPresetTimerMinutes(planObj.activeTimer.presetTimerMinutes || null);
              saveTimerState(planObj.activeTimer, activeAccId);
            }
          } else {
            // Fallback for root level legacy structure
            if (cloudData.settings) {
              setSettings(cloudData.settings);
              saveSettings(cloudData.settings, activeAccId);
            }
            if (cloudData.logs) {
              const currentLocalLogs = loadLogs(activeAccId);
              const merged = mergeLogs(currentLocalLogs, cloudData.logs);
              setLogs(merged);
              saveLogs(merged, activeAccId);
            }
            if (cloudData.tasks) {
              setTasks(cloudData.tasks);
              saveMaintenanceTasks(cloudData.tasks, activeAccId);
            }
            if (cloudData.photos) {
              setPhotos(cloudData.photos);
              savePhotos(cloudData.photos, activeAccId);
            }
            if (cloudData.notifications) {
              setNotifications(cloudData.notifications);
              saveNotifications(cloudData.notifications, activeAccId);
            }
            if (cloudData.activeTimer) {
              setWearStatus(cloudData.activeTimer.wearStatus || 'in');
              setCurrentOutStartTime(cloudData.activeTimer.startTime || null);
              setCurrentOutReason(cloudData.activeTimer.reason || null);
              setPresetTimerMinutes(cloudData.activeTimer.presetTimerMinutes || null);
              saveTimerState(cloudData.activeTimer, activeAccId);
            }
          }

          localStorage.setItem('aligner_tracker_has_onboarded_v1', 'true');
          setIsOnboardingOpen(false);
          setIsInitialFirstUse(false);
        } else if (!exists) {
          // New user record in Firestore: check if device has local onboarding
          const hasOnboarded = localStorage.getItem('aligner_tracker_has_onboarded_v1');
          if (!hasOnboarded) {
            setIsInitialFirstUse(true);
            setIsOnboardingOpen(true);
          } else {
            // Seed cloud with existing local state
            const currentAccId = currentAccountIdRef.current;
            const currentTimer = loadTimerState(currentAccId);
            const initialPlanData: PerPlanData = {
              settings,
              logs,
              tasks,
              photos,
              notifications,
              activeTimer: currentTimer,
            };
            plansMapRef.current = { [currentAccId]: initialPlanData };

            const initialPayload = {
              accounts,
              currentAccountId: currentAccId,
              plans: plansMapRef.current,
              activeTimer: currentTimer,
              settings,
              logs,
              tasks,
              photos,
              notifications,
              profile: currentAccount,
            };

            lastCloudHashRef.current = JSON.stringify(initialPayload);
            saveUserDataToCloud(user.uid, initialPayload);
          }
        }

        isCloudHydratedRef.current = true;
        setIsCloudLoaded(true);
      }, () => {
        // Error handler (e.g. quota limit exceeded)
        isCloudHydratedRef.current = true;
        setIsCloudLoaded(true);
      });

      return () => unsubscribeCloud();
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

  // Save changes to cloud whenever data updates while logged in AND cloud hydration is ready
  useEffect(() => {
    const activeTimer: ActiveTimerState = {
      wearStatus,
      startTime: currentOutStartTime,
      reason: currentOutReason,
      presetTimerMinutes,
    };

    // Always persist locally for immediate offline resilience
    saveSettings(settings, currentAccountId);
    saveLogs(logs, currentAccountId);
    saveMaintenanceTasks(tasks, currentAccountId);
    savePhotos(photos, currentAccountId);
    saveNotifications(notifications, currentAccountId);
    saveAccounts(accounts);
    saveTimerState(activeTimer, currentAccountId);

    if (authUser && isCloudLoaded) {
      const currentPlanData: PerPlanData = {
        settings,
        logs,
        tasks,
        photos,
        notifications,
        activeTimer,
      };

      const updatedPlansMap: Record<string, PerPlanData> = {
        ...(plansMapRef.current || {}),
        [currentAccountId]: currentPlanData,
      };

      plansMapRef.current = updatedPlansMap;

      const payload = {
        accounts,
        currentAccountId,
        plans: updatedPlansMap,
        activeTimer,
        settings,
        logs,
        tasks,
        photos,
        notifications,
        profile: currentAccount,
      };

      const serialized = JSON.stringify(payload);
      if (serialized === lastCloudHashRef.current) {
        return;
      }

      lastCloudHashRef.current = serialized;
      saveUserDataToCloud(authUser.uid, payload);
    }
  }, [
    authUser,
    isCloudLoaded,
    accounts,
    currentAccountId,
    settings,
    logs,
    tasks,
    photos,
    notifications,
    wearStatus,
    currentOutStartTime,
    currentOutReason,
    presetTimerMinutes,
    currentAccount,
  ]);

  // Sync state when switching current account
  const handleSelectAccount = (id: string) => {
    setCurrentAccountId(id);
    setAccountIdState(id);

    const targetPlan = plansMapRef.current[id];
    if (targetPlan) {
      if (targetPlan.settings) setSettings(targetPlan.settings);
      if (targetPlan.logs) {
        const merged = mergeLogs(loadLogs(id), targetPlan.logs);
        setLogs(merged);
        saveLogs(merged, id);
      }
      if (targetPlan.tasks) setTasks(targetPlan.tasks);
      if (targetPlan.photos) setPhotos(targetPlan.photos);
      if (targetPlan.notifications) setNotifications(targetPlan.notifications);
      if (targetPlan.activeTimer) {
        setWearStatus(targetPlan.activeTimer.wearStatus || 'in');
        setCurrentOutStartTime(targetPlan.activeTimer.startTime || null);
        setCurrentOutReason(targetPlan.activeTimer.reason || null);
        setPresetTimerMinutes(targetPlan.activeTimer.presetTimerMinutes || null);
      }
    } else {
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
    }

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

    // Switch active account to the new profile
    setCurrentAccountId(newProfile.id);
    setAccountIdState(newProfile.id);
    setSettings(newSettings);
    setLogs([]);
    setTasks(INITIAL_MAINTENANCE_TASKS);
    setPhotos([]);
    setNotifications([
      {
        id: `notif_welcome_${Date.now()}`,
        title: `Welcome to your plan, ${newProfile.name}! 🎉`,
        body: `Your individual ${newProfile.planType} treatment plan is active. Wear target set to ${newSettings.dailyTargetHours} hours daily.`,
        timestamp: new Date().toISOString(),
        type: 'goal_achieved',
        read: false,
      },
    ]);

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
    if (newStatus === 'out') {
      const nowIso = new Date().toISOString();
      setWearStatus('out');
      setCurrentOutStartTime(nowIso);
      setCurrentOutReason(reason || 'lunch');
      setPresetTimerMinutes(presetMins || null);
      showToast(`Aligners taken OUT for ${reason || 'meal'}`);
    } else {
      // Put aligners back in: save out session log entry
      if (currentOutStartTime) {
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

        const updatedLogs = [newLog, ...logs];
        setLogs(updatedLogs);
        saveLogs(updatedLogs, currentAccountId);

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

    const updated = [newLog, ...logs];
    setLogs(updated);
    saveLogs(updated, currentAccountId);
    showToast('Manual log entry saved');
  };

  // Edit Existing Log Entry
  const handleEditLog = (updatedLog: WearLog) => {
    const updated = logs.map((l) => (l.id === updatedLog.id ? updatedLog : l));
    setLogs(updated);
    saveLogs(updated, currentAccountId);
    showToast('Log entry updated');
  };

  // Delete Log Entry
  const handleDeleteLog = (id: string) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveLogs(updated, currentAccountId);
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

  // Photos Handler
  const handleAddPhoto = (photoData: Omit<PhotoEntry, 'id'>) => {
    const newPhoto: PhotoEntry = {
      ...photoData,
      id: `photo_${Date.now()}`,
    };
    const updated = [newPhoto, ...photos];
    setPhotos(updated);
    savePhotos(updated, currentAccountId);
    showToast('Smile photo saved to progress diary');
  };

  const handleDeletePhoto = (id: string) => {
    const updated = photos.filter((p) => p.id !== id);
    setPhotos(updated);
    savePhotos(updated, currentAccountId);
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
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-teal-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
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
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Primary Live Timer Widget */}
            <WearTimerCard
              wearStatus={wearStatus}
              currentOutStartTime={currentOutStartTime}
              currentOutReason={currentOutReason}
              presetTimerMinutes={presetTimerMinutes}
              todayLogs={todayLogs}
              allLogs={logs}
              settings={settings}
              onToggleStatus={handleToggleWearStatus}
              onAddManualLog={() => setActiveTab('logs')}
            />

            {/* Grid Layout for Tray Schedule & Hygiene */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrayProgressCard
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onOpenPhotoDiary={() => setActiveTab('photos')}
              />

              <MaintenanceChecklist
                tasks={tasks}
                onToggleTask={handleToggleTask}
                onOpenChewiesTimer={() => setIsChewiesModalOpen(true)}
              />
            </div>

            {/* Orthodontist Information */}
            <OrthodontistCard settings={settings} onUpdateSettings={handleUpdateSettings} />
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
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'text-teal-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
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

