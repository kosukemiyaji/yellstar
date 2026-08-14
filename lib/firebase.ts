import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 👇 ここにFirebaseでコピーした情報を貼り付けます
const firebaseConfig = {
  apiKey: "AIzaSyC_LLhPdt_1G3Uwy7-mWxUJnWsmgRDipO8",
  authDomain: "yellstar-kusokokkai.firebaseapp.com",
  projectId: "yellstar-kusokokkai",
  storageBucket: "yellstar-kusokokkai.firebasestorage.app",
  messagingSenderId: "656771463746",
  appId: "1:656771463746:web:ce86c7634f56a0a3dd8bdb",
  measurementId: "G-RZDYCE7WCZ"
};

// Firebaseの初期化
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// アプリ全体で使う機能
export const auth = getAuth(app);
export const db = getFirestore(app);