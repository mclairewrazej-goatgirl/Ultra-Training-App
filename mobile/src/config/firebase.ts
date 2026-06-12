import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const auth = getAuth(app);
export const db = getFirestore(app);
