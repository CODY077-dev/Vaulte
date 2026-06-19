import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
  apiKey: "AIzaSyA8LJ07TpuHhMt5Sasy0RYr4LgcyaMCkzw",
  authDomain: "game-day-app-115a4.firebaseapp.com",
  projectId: "game-day-app-115a4",
  storageBucket: "game-day-app-115a4.firebasestorage.app",
  messagingSenderId: "426784645463",
  appId: "1:426784645463:web:909f022666b832a046de12"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
