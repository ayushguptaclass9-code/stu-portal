// Reusable authentication functions. Never duplicated across pages.
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup,
  sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile,
  deleteUser, reauthenticateWithCredential, reauthenticateWithPopup, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, googleProvider } from './firebase-config.js';
import { ensureRoleProfileDoc } from './database.js';

export const ROLE_HOME = {
  student: 'student/dashboard.html',
  academician: 'academy/dashboard.html',
  industry: 'industry/dashboard.html',
  institution: 'institution/dashboard.html'
};

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Login failed. Please check your email and password.',
  'auth/user-not-found': 'No account found with this email. Please register first.',
  'auth/wrong-password': 'Login failed. Please check your email and password.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/operation-not-allowed': 'Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.',
  'auth/configuration-not-found': 'Authentication is not configured for this project. Enable Email/Password and Google sign-in in the Firebase Console.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Popup blocked by the browser. Please allow popups and try again.',
  'auth/unauthorized-domain': 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/network-request-failed': 'No internet connection. Please check your network.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/requires-recent-login': 'Please log in again before performing this action.',
  // Firestore errors surfaced through auth flows:
  'permission-denied': 'Database permission denied. Publish firestore.rules in Firebase Console → Firestore → Rules (README §5), then refresh and try again.',
  'unauthenticated': 'Your session has expired. Please log in again.',
  'unavailable': 'Database is temporarily unavailable. Please try again.',
  'failed-precondition': 'Firestore database not found. Create it in Firebase Console → Firestore Database.'
};
export function authErrorMessage(error) {
  return AUTH_ERRORS[error?.code] || 'Something went wrong. Please try again.';
}

export async function registerUser({ name, email, password, role, orgName = '' }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      name, email, role, profileImage: '', createdAt: serverTimestamp()
    });
    await ensureRoleProfileDoc(role, cred.user, { name, orgName });
    return cred.user;
  } catch (e) { throw new Error(authErrorMessage(e)); }
}

export async function loginUser(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (e) { throw new Error(authErrorMessage(e)); }
}

/** Returns { user, isNew }. When isNew, caller must collect a role and call completeGoogleRegistration. */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const snap = await getDoc(doc(db, 'users', result.user.uid));
    return { user: result.user, isNew: !snap.exists() };
  } catch (e) { throw new Error(authErrorMessage(e)); }
}

export async function completeGoogleRegistration(user, role, orgName = '') {
  const name = role === 'industry' || role === 'institution' ? orgName : (user.displayName || orgName || 'New User');
  await setDoc(doc(db, 'users', user.uid), {
    name, email: user.email, role, profileImage: user.photoURL || '', createdAt: serverTimestamp()
  });
  await ensureRoleProfileDoc(role, user, { name, orgName });
}

export async function logoutUser() { await signOut(auth); }

export async function resetPassword(email) {
  try { await sendPasswordResetEmail(auth, email); }
  catch (e) { throw new Error(authErrorMessage(e)); }
}

export function watchAuth(callback) { return onAuthStateChanged(auth, callback); }
export const getCurrentUser = () => new Promise(res => {
  const unsub = onAuthStateChanged(auth, u => { unsub(); res(u); });
});

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

/** Deletes auth account + best-effort Firestore cleanup (requires recent login). */
export async function deleteCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in.');
  try {
    await deleteUser(user);
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      if (user.providerData[0]?.providerId === 'google.com') {
        await reauthenticateWithPopup(user, googleProvider);
      } else {
        const pw = prompt('Please re-enter your password to confirm account deletion:');
        if (!pw) throw new Error('Account deletion cancelled.');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
      }
      await deleteUser(user);
    } else throw new Error(authErrorMessage(e));
  }
  await Promise.allSettled([
    deleteDoc(doc(db, 'users', user.uid)),
    deleteDoc(doc(db, 'students', user.uid)),
    deleteDoc(doc(db, 'academicianProfiles', user.uid)),
    deleteDoc(doc(db, 'companies', user.uid)),
    deleteDoc(doc(db, 'institutionProfiles', user.uid))
  ]);
}