"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  uid: string;
  // Add other user properties as needed
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
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>({ uid: 'mock-user' }); // Mock user
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>({
    kcal: 2000,
    protein: 150,
    fat: 80,
    carbs: 250,
  });

  return (
    <UserContext.Provider value={{ authUser, macroTargets, setAuthUser, setMacroTargets }}>
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