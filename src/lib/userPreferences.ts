import "server-only";

import { supabase } from "@/lib/supabase";
import {
  defaultUserPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

type UserPreferencesRow = {
  formato_fecha?: string | null;
  formato_hora?: string | null;
  idioma?: string | null;
  moneda?: string | null;
  tema?: string | null;
  zona_horaria?: string | null;
};

function rowToPreferences(row: UserPreferencesRow | null | undefined): UserPreferences {
  if (!row) return defaultUserPreferences;

  return normalizeUserPreferences({
    currency: row.moneda,
    dateFormat: row.formato_fecha,
    language: row.idioma,
    theme: row.tema,
    timeFormat: row.formato_hora,
    timezone: row.zona_horaria,
  });
}

function preferencesToRow(userId: string, preferences: UserPreferences) {
  return {
    actualizado_en: new Date().toISOString(),
    formato_fecha: preferences.dateFormat,
    formato_hora: preferences.timeFormat,
    idioma: preferences.language,
    moneda: preferences.currency,
    tema: preferences.theme,
    usuario_id: userId,
    zona_horaria: preferences.timezone,
  };
}

function isMissingPreferencesTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.message?.toLowerCase().includes("usuario_preferencias");
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("usuario_preferencias")
    .select("moneda,zona_horaria,idioma,formato_fecha,formato_hora,tema")
    .eq("usuario_id", userId)
    .maybeSingle();

  if (error) {
    if (!isMissingPreferencesTable(error)) {
      console.error("Error al cargar preferencias del usuario:", error.message);
    }
    return defaultUserPreferences;
  }

  return rowToPreferences(data);
}

export async function saveUserPreferences(userId: string, preferences: UserPreferences) {
  const normalizedPreferences = normalizeUserPreferences(preferences);
  const { data, error } = await supabase
    .from("usuario_preferencias")
    .upsert(preferencesToRow(userId, normalizedPreferences), { onConflict: "usuario_id" })
    .select("moneda,zona_horaria,idioma,formato_fecha,formato_hora,tema")
    .single();

  if (error) {
    throw new Error(isMissingPreferencesTable(error)
      ? "La tabla usuario_preferencias no existe. Ejecuta scripts/user-preferences-schema.sql en Supabase."
      : error.message);
  }

  return rowToPreferences(data);
}

export async function ensureDefaultUserPreferences(userId: string) {
  const { error } = await supabase
    .from("usuario_preferencias")
    .upsert(preferencesToRow(userId, defaultUserPreferences), { ignoreDuplicates: true, onConflict: "usuario_id" });

  if (error && !isMissingPreferencesTable(error)) {
    console.error("No fue posible crear preferencias por defecto:", error.message);
  }
}
