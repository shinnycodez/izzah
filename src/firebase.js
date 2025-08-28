// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';



const firebaseConfig = {
  apiKey: "AIzaSyBWgdQpvvH6n2Efa0HOT2e6Rg2b4jkdQOA",
  authDomain: "izzah-cb111.firebaseapp.com",
  projectId: "izzah-cb111",
  storageBucket: "izzah-cb111.firebasestorage.app",
  messagingSenderId: "576897486305",
  appId: "1:576897486305:web:50123172ae7afe91d596a0",
  measurementId: "G-0PB9NP50JW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Export the db
export { db };