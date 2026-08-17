import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const obligationsByRegime = {
  "606": [
    ["ISR_MENSUAL", "Pago provisional mensual de ISR", "Registra y presenta el pago provisional de ISR por arrendamiento.", "ISR", "mensual"],
    ["IVA_MENSUAL", "Declaración mensual de IVA", "Determina y presenta el IVA trasladado y acreditable del periodo.", "IVA", "mensual"],
    ["ANUAL", "Declaración anual de personas físicas", "Presenta la declaración anual correspondiente al ejercicio fiscal.", "ISR", "anual"],
  ],
  "612": [
    ["ISR_MENSUAL", "Pago provisional mensual de ISR", "Registra y presenta el pago provisional de ISR del periodo.", "ISR", "mensual"],
    ["IVA_MENSUAL", "Declaración mensual de IVA", "Determina y presenta el IVA trasladado y acreditable del periodo.", "IVA", "mensual"],
    ["ANUAL", "Declaración anual de personas físicas", "Presenta la declaración anual correspondiente al ejercicio fiscal.", "ISR", "anual"],
  ],
  "625": [
    ["ISR_MENSUAL", "Pago provisional mensual de ISR", "Revisa el pago provisional de ISR de ingresos por plataformas.", "ISR", "mensual"],
    ["IVA_MENSUAL", "Declaración mensual de IVA", "Revisa el IVA aplicable a ingresos por plataformas tecnológicas.", "IVA", "mensual"],
    ["ANUAL", "Declaración anual de personas físicas", "Presenta la declaración anual correspondiente al ejercicio fiscal.", "ISR", "anual"],
  ],
  "626": [
    ["RESICO_MENSUAL", "Declaración mensual RESICO", "Presenta la declaración mensual del Régimen Simplificado de Confianza.", "ISR", "mensual"],
    ["IVA_MENSUAL", "Declaración mensual de IVA", "Determina y presenta el IVA trasladado y acreditable del periodo.", "IVA", "mensual"],
    ["ANUAL", "Declaración anual de personas físicas", "Presenta la declaración anual correspondiente al ejercicio fiscal.", "ISR", "anual"],
  ],
};

const regimeCodes = Object.keys(obligationsByRegime);
const { data: regimes, error: regimesError } = await supabase
  .from("regimenes_fiscales")
  .select("id,clave_sat")
  .in("clave_sat", regimeCodes);

if (regimesError) throw new Error(regimesError.message);

const regimeIdByCode = new Map((regimes ?? []).map((regime) => [regime.clave_sat, regime.id]));
const rows = [];

for (const [code, obligations] of Object.entries(obligationsByRegime)) {
  const regimeId = regimeIdByCode.get(code);
  if (!regimeId) continue;

  for (const [clave, nombre, descripcion, impuesto, periodicidad] of obligations) {
    rows.push({
      activo: true,
      clave,
      descripcion,
      impuesto,
      nombre,
      periodicidad,
      regimen_id: regimeId,
      requerida: true,
    });
  }
}

if (!rows.length) {
  throw new Error("No se encontraron los regímenes fiscales requeridos para crear obligaciones.");
}

const { error: upsertError } = await supabase
  .from("regimen_obligacion_sugerida")
  .upsert(rows, { onConflict: "regimen_id,clave" });

if (upsertError) throw new Error(upsertError.message);

console.log(JSON.stringify({
  catalogo: "regimen_obligacion_sugerida",
  obligaciones_guardadas: rows.length,
  nota: "Catálogo base para entorno académico; valida reglas fiscales antes de uso productivo.",
}, null, 2));
