"use client";

import React, { createContext, useContext, ReactNode } from 'react';

interface FontContextType {
  fontFamily: string;
  fontFamilyMedium: string;
  fontFamilySemiBold: string;
  fontFamilyBold: string;
}

const FontContext = createContext<FontContextType | undefined>(undefined);

export const FontProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const fontFamily = 'var(--font-inter)';
  const fontFamilyMedium = 'var(--font-inter)';
  const fontFamilySemiBold = 'var(--font-inter)';
  const fontFamilyBold = 'var(--font-inter)';

  return (
    <FontContext.Provider value={{ fontFamily, fontFamilyMedium, fontFamilySemiBold, fontFamilyBold }}>
      {children}
    </FontContext.Provider>
  );
};

export const useFont = () => {
  const context = useContext(FontContext);
  if (!context) {
    throw new Error('useFont must be used within a FontProvider');
  }
  return context;
};