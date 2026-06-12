import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache } from 'firebase/firestore';

// Same Firebase project as the web app — data is shared across both platforms.
const firebaseConfig = {
  apiKey:            'AIzaSyDRiIhhg7Uav6cApyUzea_u_WXSZa5fiZs',
  authDomain:        'mwrazej-training.firebaseapp.com',
  projectId:         'mwrazej-training',
  storageBucket:     'mwrazej-training.firebasestorage.app',
  messagingSenderId: '528346991243',
  appId:             '1:528346991243:web:87dd1f59f7a8a2f9f4e28e',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Enable offline persistence — writes queue locally and sync when reconnected.
// Falls back to getFirestore if initializeFirestore has already been called (e.g. hot reload).
export const db = (() => {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    return getFirestore(app);
  }
})();

export const auth = getAuth(app);
