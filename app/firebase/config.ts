import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCXAiN7UkW9SehKNpJMNj3VyxkYFWKHs1E",
  authDomain: "mealprep-91f9f.firebaseapp.com",
  projectId: "mealprep-91f9f",
  storageBucket: "mealprep-91f9f.firebasestorage.app",
  messagingSenderId: "793394269510",
  appId: "1:793394269510:web:ba6e3418563474c8c2a947"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = (() => {
  if (typeof window === 'undefined') return getFirestore(app);
  return initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
})();

export default app;