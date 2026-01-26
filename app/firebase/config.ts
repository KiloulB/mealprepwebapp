import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCXAiN7UkW9SehKNpJMNj3VyxkYFWKHs1E",
  authDomain: "mealprep-91f9f.firebaseapp.com",
  projectId: "mealprep-91f9f",
  storageBucket: "mealprep-91f9f.firebasestorage.app",
  messagingSenderId: "793394269510",
  appId: "1:793394269510:web:ba6e3418563474c8c2a947"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;