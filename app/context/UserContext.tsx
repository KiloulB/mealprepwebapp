"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { subscribeToMacros, subscribeToProfile } from '../firebase/profileService';
import { subscribeMealPrepPlan } from '../firebase/mealPrepService';
import type { MealPrepPlan } from '../types/mealPrep';

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

const DEFAULT_MACROS: MacroTargets = { kcal: 2000, protein: 150, fat: 80, carbs: 250 };

interface UserContextType {
  authUser: User | null;
  macroTargets: MacroTargets;
  mealPrepEnabled: boolean;
  helpModeEnabled: boolean;
  mealPrepPlan: MealPrepPlan | null;
  setAuthUser: (user: User | null) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [macroTargets, setMacroTargets] = useState<MacroTargets>(DEFAULT_MACROS);
  const [mealPrepEnabled, setMealPrepEnabled] = useState(false);
  const [helpModeEnabled, setHelpModeEnabled] = useState(false);
  const [mealPrepPlan, setMealPrepPlan] = useState<MealPrepPlan | null>(null);

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
        setMacroTargets(DEFAULT_MACROS);
        setMealPrepEnabled(false);
        setHelpModeEnabled(false);
        setMealPrepPlan(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    return subscribeToMacros(authUser.uid, (macros) => {
      if (macros) {
        setMacroTargets({
          kcal: macros.kcal ?? DEFAULT_MACROS.kcal,
          protein: macros.protein ?? DEFAULT_MACROS.protein,
          fat: macros.fat ?? DEFAULT_MACROS.fat,
          carbs: macros.carbs ?? DEFAULT_MACROS.carbs,
        });
      } else {
        setMacroTargets(DEFAULT_MACROS);
      }
    });
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    return subscribeToProfile(authUser.uid, (profile) => {
      setMealPrepEnabled(profile.mealPrepEnabled === true);
      setHelpModeEnabled(profile.helpModeEnabled === true);
    });
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !mealPrepEnabled) { setMealPrepPlan(null); return; }
    return subscribeMealPrepPlan(authUser.uid, setMealPrepPlan);
  }, [authUser, mealPrepEnabled]);

  return (
    <UserContext.Provider value={{ authUser, macroTargets, mealPrepEnabled, helpModeEnabled, mealPrepPlan, setAuthUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};
