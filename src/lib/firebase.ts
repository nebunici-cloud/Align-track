import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  deleteDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// App Check: only activates once VITE_RECAPTCHA_SITE_KEY is configured (set it
// as an env var, not committed). Until then this is a deliberate no-op so the
// app keeps working exactly as before - enabling it requires registering this
// app under Firebase Console -> App Check with the reCAPTCHA v3 provider,
// getting the site key from there, and only then flipping Firestore/Storage
// enforcement on in the console (start in "monitor" mode first).
if (typeof window !== 'undefined' && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Target provisioned database instance or default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);

// Connection test helper (optional)
export async function testFirebaseConnection() {
  if (typeof window !== 'undefined' && localStorage.getItem('alignertrack_firestore_quota_exceeded') === 'true') {
    return;
  }
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
  } catch (error: any) {
    const errMsg = String(error?.message || error || '');
    if (
      errMsg.includes('Quota exceeded') ||
      errMsg.includes('resource-exhausted') ||
      error?.code === 'resource-exhausted'
    ) {
      console.warn('Firebase Firestore write/read quota reached for project.');
      try {
        localStorage.setItem('alignertrack_firestore_quota_exceeded', 'true');
      } catch {
        // Ignore storage errors
      }
    } else if (errMsg.includes('offline')) {
      console.warn('Firebase appears offline or configuration issue:', error);
    }
  }
}

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
};
export type { User };
