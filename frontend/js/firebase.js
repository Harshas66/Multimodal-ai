// backend/js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiE2DdWfQley8l88Jv2vwsq0OraWjSSJ4",
  authDomain: "silver-agility-475306-r0.firebaseapp.com",
  projectId: "silver-agility-475306-r0",
  storageBucket: "silver-agility-475306-r0.firebasestorage.app",
  messagingSenderId: "1089444754253",
  appId: "1:1089444754253:web:3b06d8e76536dfbae67d04"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification
};
