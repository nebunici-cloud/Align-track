import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Server-side Firebase Admin SDK, used only by API routes (never bundled
 * into the client). Admin SDK calls bypass Firestore security rules
 * entirely, so this must only ever be reached from trusted server code that
 * has already verified the caller (see requireTelegramSecret in
 * telegram-webhook.ts).
 */
function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// This project uses a named (non-default) Firestore database, same as the
// client SDK in src/lib/firebase.ts — must match or writes silently land in
// an empty, unrelated database that the app never reads from.
export function getAdminDb() {
  return getFirestore(getAdminApp(), firebaseConfig.firestoreDatabaseId);
}
