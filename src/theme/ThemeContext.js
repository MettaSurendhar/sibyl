import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, DEFAULT_THEME_KEY } from './themes';

const THEME_KEY = '@sibyl_theme';

const ThemeContext = createContext({
  theme: themes[DEFAULT_THEME_KEY],
  themeKey: DEFAULT_THEME_KEY,
  setThemeKey: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState(DEFAULT_THEME_KEY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved && themes[saved]) setThemeKeyState(saved);
      setLoaded(true);
    });
  }, []);

  const setThemeKey = (key) => {
    setThemeKeyState(key);
    AsyncStorage.setItem(THEME_KEY, key);
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme: themes[themeKey], themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
