export type FiscalixTheme = "dark" | "light";
export type FiscalixCurrency = "MXN" | "USD" | "EUR";
export type FiscalixLanguage = "es" | "en";
export type FiscalixDateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type FiscalixTimeFormat = "24h" | "12h";

export type UserPreferences = {
  currency: FiscalixCurrency;
  dateFormat: FiscalixDateFormat;
  language: FiscalixLanguage;
  theme: FiscalixTheme;
  timeFormat: FiscalixTimeFormat;
  timezone: string;
};

export const defaultUserPreferences: UserPreferences = {
  currency: "MXN",
  dateFormat: "DD/MM/YYYY",
  language: "es",
  theme: "dark",
  timeFormat: "24h",
  timezone: "America/Mexico_City",
};

export const userPreferenceOptions = {
  currencies: [
    { label: "MXN - Peso Mexicano", value: "MXN" },
    { label: "USD - Dólar estadounidense", value: "USD" },
    { label: "EUR - Euro", value: "EUR" },
  ],
  dateFormats: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
  languages: [
    { label: "Español", value: "es" },
    { label: "English", value: "en" },
  ],
  themes: [
    { label: "Oscuro", value: "dark" },
    { label: "Claro", value: "light" },
  ],
  timeFormats: [
    { label: "24 horas", value: "24h" },
    { label: "12 horas", value: "12h" },
  ],
  timezones: ["America/Mexico_City", "America/Tijuana", "America/Cancun"],
} as const;

const fallbackExchangeRatesToMxn: Record<FiscalixCurrency, number> = {
  EUR: 20.1,
  MXN: 1,
  USD: 18.5,
};

function numericEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function currencyRateToMxn(currency: FiscalixCurrency) {
  if (currency === "USD") {
    return numericEnv(process.env.NEXT_PUBLIC_FISCALIX_USD_MXN_RATE, fallbackExchangeRatesToMxn.USD);
  }
  if (currency === "EUR") {
    return numericEnv(process.env.NEXT_PUBLIC_FISCALIX_EUR_MXN_RATE, fallbackExchangeRatesToMxn.EUR);
  }

  return fallbackExchangeRatesToMxn.MXN;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

export function normalizeUserPreferences(value: unknown): UserPreferences {
  const input = value && typeof value === "object" ? value as Partial<Record<keyof UserPreferences, unknown>> : {};

  return {
    currency: oneOf(
      input.currency,
      userPreferenceOptions.currencies.map((option) => option.value),
      defaultUserPreferences.currency,
    ),
    dateFormat: oneOf(input.dateFormat, userPreferenceOptions.dateFormats, defaultUserPreferences.dateFormat),
    language: oneOf(
      input.language,
      userPreferenceOptions.languages.map((option) => option.value),
      defaultUserPreferences.language,
    ),
    theme: oneOf(
      input.theme,
      userPreferenceOptions.themes.map((option) => option.value),
      defaultUserPreferences.theme,
    ),
    timeFormat: oneOf(
      input.timeFormat,
      userPreferenceOptions.timeFormats.map((option) => option.value),
      defaultUserPreferences.timeFormat,
    ),
    timezone: oneOf(input.timezone, userPreferenceOptions.timezones, defaultUserPreferences.timezone),
  };
}

export function preferencesLocale(preferences: UserPreferences) {
  return preferences.language === "en" ? "en-US" : "es-MX";
}

export function convertMxnToPreferenceCurrency(value: number, preferences: UserPreferences) {
  return value / currencyRateToMxn(preferences.currency);
}

export function convertPreferenceCurrencyToMxn(value: number, preferences: UserPreferences) {
  return value * currencyRateToMxn(preferences.currency);
}

export function exchangeRateLabel(preferences: UserPreferences) {
  if (preferences.currency === "MXN") return "Los importes se guardan y muestran en MXN.";

  return `Los importes se guardan en MXN y se muestran con tipo de cambio informativo: 1 ${preferences.currency} = ${currencyRateToMxn(preferences.currency).toFixed(2)} MXN.`;
}

function parseLocalDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function formatPreferenceMoney(value: number, preferences: UserPreferences) {
  const convertedValue = convertMxnToPreferenceCurrency(value, preferences);

  return new Intl.NumberFormat(preferencesLocale(preferences), {
    currency: preferences.currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(convertedValue);
}

export function formatPreferenceDate(value: string | null | undefined, preferences: UserPreferences, fallback = "Sin fecha") {
  const date = parseLocalDate(value);
  if (!date) return value || fallback;

  const year = date.getFullYear();
  const month = twoDigits(date.getMonth() + 1);
  const day = twoDigits(date.getDate());

  if (preferences.dateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (preferences.dateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function formatPreferenceDateTime(value: string | null | undefined, preferences: UserPreferences, fallback = "Fecha no disponible") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(preferencesLocale(preferences), {
    day: "2-digit",
    hour: "2-digit",
    hour12: preferences.timeFormat === "12h",
    minute: "2-digit",
    month: "short",
    timeZone: preferences.timezone,
    year: "numeric",
  }).format(date);
}

export function formatPreferenceMonth(value: Date, preferences: UserPreferences, long = false) {
  return new Intl.DateTimeFormat(preferencesLocale(preferences), {
    month: long ? "long" : "short",
    timeZone: preferences.timezone,
    year: long ? "numeric" : undefined,
  }).format(value).replace(".", "");
}
