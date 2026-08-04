import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPrefs, setPrefs } from '../utils/settingsStore';
import { themes, DEFAULT_THEME_KEY } from './themes';

const THEME_KEY = '@sibyl_theme';

const ThemeContext = createContext({
  theme: themes[DEFAULT_THEME_KEY],
  themeKey: DEFAULT_THEME_KEY,
  setThemeKey: () => {},
  appFont: 'playfair',
  setAppFont: () => {},
});

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKeyState] = useState(DEFAULT_THEME_KEY);
  const [appFont, setAppFontState] = useState('playfair');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      getPrefs()
    ]).then(([savedTheme, prefs]) => {
      if (savedTheme && themes[savedTheme]) setThemeKeyState(savedTheme);
      if (prefs && prefs.appFont) setAppFontState(prefs.appFont);
      setLoaded(true);
    });
  }, []);

  const setThemeKey = (key) => {
    setThemeKeyState(key);
    AsyncStorage.setItem(THEME_KEY, key);
  };

  const setAppFont = async (font) => {
    setAppFontState(font);
    await setPrefs({ appFont: font });
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme: themes[themeKey], themeKey, setThemeKey, appFont, setAppFont }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
