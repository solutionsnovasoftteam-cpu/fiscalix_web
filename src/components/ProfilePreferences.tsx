"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { createTranslator } from "@/lib/i18n";
import {
  currencyRateToMxn,
  normalizeUserPreferences,
  userPreferenceOptions,
  type FiscalixCurrency,
  type FiscalixLanguage,
  type FiscalixTheme,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

const THEME_STORAGE_KEY = "fiscalix-theme";
const PREFERENCES_STORAGE_KEY = "fiscalix-user-preferences";

function applyTheme(theme: FiscalixTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
  document.body.dataset.theme = theme;
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function persistLocalPreferences(preferences: UserPreferences) {
  applyTheme(preferences.theme);
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function ProfilePreferences({ initialPreferences }: { initialPreferences?: UserPreferences }) {
  const router = useRouter();
  const normalizedInitialPreferences = useMemo(
    () => normalizeUserPreferences(initialPreferences),
    [initialPreferences],
  );
  const [preferences, setPreferences] = useState<UserPreferences>(normalizedInitialPreferences);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const t = createTranslator(preferences.language);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPreferences(normalizedInitialPreferences);
      persistLocalPreferences(normalizedInitialPreferences);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [normalizedInitialPreferences]);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2800);
  }

  async function savePreferences(nextPreferences: UserPreferences, previousPreferences: UserPreferences) {
    setSaving(true);
    setFeedback(t("common.saving"));
    try {
      const response = await fetch("/api/user-preferences", {
        body: JSON.stringify(nextPreferences),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        preferences?: UserPreferences;
        success?: boolean;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || t("preferences.saveError"));
      }

      const savedPreferences = normalizeUserPreferences(payload.preferences ?? nextPreferences);
      setPreferences(savedPreferences);
      persistLocalPreferences(savedPreferences);
      notify(t("preferences.saved"));
      router.refresh();
    } catch (error) {
      setPreferences(previousPreferences);
      persistLocalPreferences(previousPreferences);
      notify(error instanceof Error ? error.message : t("preferences.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function updatePreference<Key extends keyof UserPreferences>(key: Key, value: UserPreferences[Key]) {
    const previousPreferences = preferences;
    const nextPreferences = normalizeUserPreferences({ ...preferences, [key]: value });
    setPreferences(nextPreferences);
    persistLocalPreferences(nextPreferences);
    void savePreferences(nextPreferences, previousPreferences);
  }

  function changeTheme(nextTheme: FiscalixTheme) {
    updatePreference("theme", nextTheme);
  }

  const exchangeLabel = preferences.currency === "MXN"
    ? t("preferences.exchangeMxn")
    : t("preferences.exchangeConverted", {
      currency: preferences.currency,
      rate: currencyRateToMxn(preferences.currency).toFixed(2),
    });

  return (
    <article className="profile-card profile-preferences-card">
      <div className="profile-card-heading">
        <h2><Icon name="tune" />{t("preferences.title")}</h2>
        {feedback && <small className="profile-preferences-feedback" role="status">{feedback}</small>}
      </div>
      <div className="settings-prefs profile-preferences-form">
        <label>
          <span><Icon name="attach_money" /> {t("preferences.currency")}</span>
          <select
            disabled={saving}
            onChange={(event) => updatePreference("currency", event.target.value as FiscalixCurrency)}
            value={preferences.currency}
          >
            {userPreferenceOptions.currencies.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span><Icon name="person" /> {t("preferences.language")}</span>
          <select
            disabled={saving}
            onChange={(event) => updatePreference("language", event.target.value as FiscalixLanguage)}
            value={preferences.language}
          >
            {userPreferenceOptions.languages.map((option) => (
              <option key={option.value} value={option.value}>{t(option.value === "en" ? "language.en" : "language.es")}</option>
            ))}
          </select>
        </label>
        <p className="profile-preferences-rate">{exchangeLabel}</p>
        <div className="settings-theme">
          <span>{t("preferences.theme")}</span>
          <div className="settings-theme-options">
            <button
              aria-pressed={preferences.theme === "dark"}
              className={preferences.theme === "dark" ? "is-active" : undefined}
              disabled={saving}
              onClick={() => changeTheme("dark")}
              type="button"
            >
              {t("preferences.dark")}
            </button>
            <button
              aria-pressed={preferences.theme === "light"}
              className={preferences.theme === "light" ? "is-active" : undefined}
              disabled={saving}
              onClick={() => changeTheme("light")}
              type="button"
            >
              {t("preferences.light")}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
