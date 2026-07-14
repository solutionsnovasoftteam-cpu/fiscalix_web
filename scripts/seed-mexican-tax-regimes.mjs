import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2];
}

const regimes = [
  ["601", "General de Ley Personas Morales"],
  ["603", "Personas Morales con Fines no Lucrativos"],
  ["605", "Sueldos y Salarios e Ingresos Asimilados a Salarios"],
  ["606", "Arrendamiento"],
  ["608", "Demás ingresos"],
  ["610", "Residentes en el Extranjero sin Establecimiento Permanente en México"],
  ["611", "Ingresos por Dividendos (socios y accionistas)"],
  ["612", "Personas Físicas con Actividades Empresariales y Profesionales"],
  ["614", "Ingresos por intereses"],
  ["615", "Ingresos por obtención de premios"],
  ["616", "Sin obligaciones fiscales"],
  ["620", "Sociedades Cooperativas de Producción que optan por diferir sus ingresos"],
  ["621", "Incorporación Fiscal"],
  ["622", "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras"],
  ["623", "Opcional para Grupos de Sociedades"],
  ["624", "Coordinados"],
  ["625", "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas"],
  ["626", "Régimen Simplificado de Confianza"],
].map(([clave_sat, nombre]) => ({ clave_sat, nombre }));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

for (const regime of regimes) {
  const { data: existing, error: findError } = await supabase
    .from("regimenes_fiscales")
    .select("id")
    .eq("clave_sat", regime.clave_sat)
    .maybeSingle();
  if (findError) throw new Error(`No se pudo consultar ${regime.clave_sat}: ${findError.message}`);

  const { error } = existing
    ? await supabase.from("regimenes_fiscales").update(regime).eq("id", existing.id)
    : await supabase.from("regimenes_fiscales").insert(regime);
  if (error) throw new Error(`No se pudo guardar ${regime.clave_sat}: ${error.message}`);
}

const { count, error } = await supabase.from("regimenes_fiscales").select("*", { count: "exact", head: true });
if (error) throw new Error(error.message);
console.log(JSON.stringify({ catalogo: "regimenes_fiscales", registros: count }, null, 2));
