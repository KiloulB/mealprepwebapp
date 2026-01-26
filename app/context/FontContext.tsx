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
  const fontFamily = 'Arial, sans-serif';
  const fontFamilyMedium = 'Arial, sans-serif';
  const fontFamilySemiBold = 'Arial, sans-serif';
  const fontFamilyBold = 'Arial, sans-serif';

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