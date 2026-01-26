"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

interface User {
  uid: string;
  email?: string;
  displayName?: string;
}

interface MacroTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface UserContextType {
  authUser: User | null;
  macroTargets: MacroTargets | null;
  setAuthUser: (user: User | null) => void;
  setMacroTargets: (targets: MacroTargets | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>({
    kcal: 2000,
    protein: 150,
    fat: 80,
    carbs: 250,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setAuthUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || undefined,
          displayName: firebaseUser.displayName || undefined,
        });
      } else {
        setAuthUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ authUser, macroTargets, setAuthUser, setMacroTargets, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};