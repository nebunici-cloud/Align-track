import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Same value as firestoreDatabaseId in firebase-applet-config.json (not a
// secret - it's already public in the client bundle). Hardcoded here rather
// than imported from the JSON file because Vercel runs this function as
// native Node ESM (package.json has "type": "module"), which requires a
// `with { type: 'json' }` import attribute Vite's bundler doesn't need -
// simpler to avoid the JSON import in server code entirely.
const FIRESTORE_DATABASE_ID = 'ai-studio-alignertracker-77243989-1beb-41f6-bd6a-d997ca882125';

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
  return getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
}
