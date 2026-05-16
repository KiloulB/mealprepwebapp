"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeId = 'standard' | 'feminine';

interface ThemeTokens {
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentBorder: string;
  shadowAccent: string;
  bgBase: string;
  bgPage: string;
  bgCard: string;
  bgCard2: string;
  bgCard3: string;
  borderSep: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  tokens: ThemeTokens;
  swatchColors: string[];
  accentRgb: string;
}

export const THEMES: Theme[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Oranje accent — het originele Peak thema',
    tokens: {
      accent: '#FC9158',
      accentHover: '#f07d3f',
      accentMuted: 'rgba(252, 145, 88, 0.12)',
      accentBorder: 'rgba(252, 145, 88, 0.28)',
      shadowAccent: '0 4px 20px rgba(252, 145, 88, 0.22)',
      bgBase: '#111113',
      bgPage: '#18181A',
      bgCard: '#232325',
      bgCard2: '#2C2C2E',
      bgCard3: '#3A3A3C',
      borderSep: '#2e2e30',
    },
    swatchColors: ['#FC9158', '#f07d3f', 'rgba(252,145,88,0.55)', 'rgba(252,145,88,0.25)'],
    accentRgb: '252, 145, 88',
  },
  {
    id: 'feminine',
    name: 'Feminine',
    description: 'Roze accent — zachte vrouwelijke tinten',
    tokens: {
      accent: '#D4728E',
      accentHover: '#BC5876',
      accentMuted: 'rgba(212, 114, 142, 0.12)',
      accentBorder: 'rgba(212, 114, 142, 0.28)',
      shadowAccent: '0 4px 20px rgba(212, 114, 142, 0.22)',
      bgBase: '#1e161f',
      bgPage: '#281e29',
      bgCard: '#342835',
      bgCard2: '#3e303f',
      bgCard3: '#4a3a4b',
      borderSep: '#3a2a3b',
    },
    swatchColors: ['#281e29', '#342835', '#D4728E', '#BC5876'],
    accentRgb: '212, 114, 142',
  },
];

function applyThemeVars(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.tokens.accent);
  root.style.setProperty('--accent-hover', theme.tokens.accentHover);
  root.style.setProperty('--accent-rgb', theme.accentRgb);
  root.style.setProperty('--accent-muted', theme.tokens.accentMuted);
  root.style.setProperty('--accent-border', theme.tokens.accentBorder);
  root.style.setProperty('--shadow-accent', theme.tokens.shadowAccent);
  root.style.setProperty('--bg-base', theme.tokens.bgBase);
  root.style.setProperty('--bg-page', theme.tokens.bgPage);
  root.style.setProperty('--bg-card', theme.tokens.bgCard);
  root.style.setProperty('--bg-card-2', theme.tokens.bgCard2);
  root.style.setProperty('--bg-card-3', theme.tokens.bgCard3);
  root.style.setProperty('--border-sep', theme.tokens.borderSep);
}

interface ThemeContextType {
  theme: Theme;
  themes: Theme[];
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'peak_theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(THEMES[0]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const found = saved ? THEMES.find(t => t.id === saved) : null;
    const active = found ?? THEMES[0];
    setThemeState(active);
    applyThemeVars(active);
  }, []);

  const setTheme = (id: ThemeId) => {
    const found = THEMES.find(t => t.id === id) ?? THEMES[0];
    setThemeState(found);
    applyThemeVars(found);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
