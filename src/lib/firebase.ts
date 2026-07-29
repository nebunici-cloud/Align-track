import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
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
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

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
  signOut,
  onAuthStateChanged,
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
