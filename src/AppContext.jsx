import { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, or, query, where } from 'firebase/firestore';
import { useAuth } from './AuthContext.jsx';
import { db } from './firebase.js';

const AppContext = createContext(null);

function mapAuthUser(user) {
  if (!user) return null;
  return {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Account holder',
    email: user.email || '',
    riskStatus: 'GREEN',
    creditLimit: 500,
  };
}

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [currentUserRole, setCurrentUserRole] = useState('borrower');
  const [userData, setUserData] = useState(() => mapAuthUser(user));
  const [userProfile, setUserProfile] = useState(null);
  const [userProfileLoading, setUserProfileLoading] = useState(true);
  const [userProfileError, setUserProfileError] = useState('');
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(true);
  const [loansError, setLoansError] = useState('');

  useEffect(() => {
    setUserData(mapAuthUser(user));
    if (!user) {
      setCurrentUserRole('borrower');
      setUserProfile(null);
      setUserProfileLoading(false);
      return undefined;
    }

    setUserProfileLoading(true);
    setUserProfileError('');
    return onSnapshot(doc(db, 'users', user.uid), (profileSnapshot) => {
      const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
      setUserProfile(profile);
      if (profile) {
        setUserData((currentUser) => ({
          ...currentUser,
          id: user.uid,
          name: profile.name || user.displayName || currentUser.name,
          email: profile.email || user.email || currentUser.email,
          riskStatus: profile.riskStatus || currentUser.riskStatus,
          creditLimit: Number(profile.creditLimit) || 500,
          status: profile.status || 'pending',
        }));
      }
      setUserProfileLoading(false);
    }, (error) => {
      setUserProfileError(error.message || 'Unable to load account approval status.');
      setUserProfileLoading(false);
    });
  }, [user]);

  useEffect(() => {
    setLoans([]);
    setLoansError('');
    if (!user) {
      setLoansLoading(false);
      return undefined;
    }

    setLoansLoading(true);
    const loansCollection = collection(db, 'loans');
    const loansQuery = currentUserRole === 'lender'
      ? query(loansCollection, where('status', '==', 'active'))
      : query(loansCollection, or(
        where('borrowerId', '==', user.uid),
        where('borrowerEmail', '==', user.email ?? ''),
      ));

    return onSnapshot(loansQuery, (snapshot) => {
      const nextLoans = snapshot.docs
        .map((loanDocument) => ({ ...loanDocument.data(), id: loanDocument.id }))
        .sort((first, second) => {
          const firstCreated = first.createdAt?.toMillis?.() ?? 0;
          const secondCreated = second.createdAt?.toMillis?.() ?? 0;
          return secondCreated - firstCreated;
        });
      setLoans(nextLoans);
      setLoansLoading(false);
    }, (error) => {
      setLoansError(error.message || 'Unable to load loan records.');
      setLoansLoading(false);
    });
  }, [currentUserRole, user]);

  const toggleUserRole = () => {
    setCurrentUserRole((role) => (role === 'borrower' ? 'lender' : 'borrower'));
  };

  const setRiskStatus = (riskStatus) => {
    setUserData((user) => ({ ...user, riskStatus }));
  };

  const value = {
    currentUserRole,
    setCurrentUserRole,
    toggleUserRole,
    userData,
    userProfile,
    userProfileLoading,
    userProfileError,
    setRiskStatus,
    loans,
    loansLoading,
    loansError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}