"use client";

import { useEffect } from "react";
import {
  normalizeUserPreferences,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

const THEME_STORAGE_KEY = "fiscalix-theme";
const PREFERENCES_STORAGE_KEY = "fiscalix-user-preferences";

function applyTheme(theme: UserPreferences["theme"]) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
  document.body.dataset.theme = theme;
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.style.colorScheme = theme;
}

export function UserPreferencesApplier({ preferences }: { preferences?: UserPreferences }) {
  useEffect(() => {
    const normalizedPreferences = normalizeUserPreferences(preferences);
    applyTheme(normalizedPreferences.theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizedPreferences.theme);
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizedPreferences));
  }, [preferences]);

  return null;
}
