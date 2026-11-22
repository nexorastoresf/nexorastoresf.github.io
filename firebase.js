// Proyecto EXCLUSIVO de NEXORA STORE NUEVO (nexora-store-sf).
// Firebase config web es pública; la seguridad de datos depende de las reglas
// de Firestore y de los permisos de Authentication del proyecto.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAczzzSLjr88OKKv7IcrSD9w_fvuGOQmFQ",
  authDomain: "nexora-store-sf.firebaseapp.com",
  projectId: "nexora-store-sf",
  storageBucket: "nexora-store-sf.firebasestorage.app",
  messagingSenderId: "205234333693",
  appId: "1:205234333693:web:7967c3f368d71a5eb95b94",
  measurementId: "G-ZTLZHTDW3W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };
