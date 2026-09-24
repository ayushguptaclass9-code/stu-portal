// Firebase initialization — single source of truth for SDK instances.
// NOTE: For production, restrict this config via Firebase authorized domains
// and enforce access with firestore.rules (see firestore.rules in project root).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// NOTE: Firebase Storage (Cloud Storage) is intentionally NOT used here — as of
// late 2024, Google requires the paid Blaze plan just to provision a Storage
// bucket, even for tiny free-tier usage. Firestore/Auth stay free on Spark, so
// file uploads (resume, profile images) instead go through free third-party
// upload APIs (ImgBB, Cloudinary) — see storage.js — with only the resulting
// URL saved into Firestore.

const firebaseConfig = {
  apiKey: "AIzaSyDXNbKNDxSkD_fs1QDC7m5bi_I5E2sd8Rc",
  authDomain: "academia-sih.firebaseapp.com",
  projectId: "academia-sih",
  storageBucket: "academia-sih.firebasestorage.app",
  messagingSenderId: "368314480898",
  appId: "1:368314480898:web:4bf0996e6d142917a5ea1b",
  measurementId: "G-3Z0N26996K"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();