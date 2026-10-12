import { createContext, useContext, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from './firebase.js';
import { db } from './firebase.js';

const AuthContext = createContext(null);

const AUTH_ERROR_MESSAGES = {
  'auth/email-already-in-use': 'That email address is already in use.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/user-not-found': 'No account was found for that email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this Firebase project.',
};

export function getAuthErrorMessage(error, fallback) {
  return AUTH_ERROR_MESSAGES[error?.code] ?? fallback;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (authenticatedUser) => {
    setUser(authenticatedUser);
    setLoading(false);
  }, () => {
    setUser(null);
    setLoading(false);
  }), []);

  async function login(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    setUser(credential.user);
    return credential.user;
  }

  async function register(registration) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      registration.gmailAddress.trim(),
      registration.password,
    );
    if (registration.fullName.trim()) {
      await updateProfile(credential.user, { displayName: registration.fullName.trim() });
    }
    await setDoc(doc(db, 'users', credential.user.uid), {
      uid: credential.user.uid,
      name: registration.fullName.trim(),
      email: credential.user.email,
      phoneNumber: registration.phoneNumber.trim(),
      occupation: registration.occupation,
      monthlySalary: registration.monthlySalary,
      idType: registration.idType,
      idFileName: registration.idFileName,
      selfieTaken: Boolean(registration.selfieTaken),
      creditLimit: Number(registration.startingCreditLimit) || 500,
      riskStatus: 'GREEN',
      role: 'borrower',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    setUser(credential.user);
    return credential.user;
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user), login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}