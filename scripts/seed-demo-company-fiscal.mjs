import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2];
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: regimes, error: regimeError } = await supabase.from("regimenes_fiscales").select("id,clave_sat").in("clave_sat", ["601", "612", "626"]).order("clave_sat");
if (regimeError || !regimes?.length) throw new Error(regimeError?.message ?? "No hay regímenes para asignar.");

const { data: companies, error: companyError } = await supabase.from("empresas").select("id,nombre_comercial,rfc").ilike("rfc", "CLI%").order("nombre_comercial");
if (companyError) throw new Error(companyError.message);

let processed = 0;
for (const [index, company] of (companies ?? []).entries()) {
  const rfc = `DEM010101${String(index + 1).padStart(3, "0")}`;
  const regime = regimes[index % regimes.length];
  const { error: updateError } = await supabase.from("empresas").update({ rfc }).eq("id", company.id);
  if (updateError) throw new Error(`No se pudo actualizar ${company.nombre_comercial}: ${updateError.message}`);

  const { data: fiscal, error: findError } = await supabase.from("empresa_fiscal").select("id").eq("empresa_id", company.id).maybeSingle();
  if (findError) throw new Error(findError.message);
  const payload = { empresa_id: company.id, regimen_id: regime.id, rfc };
  const { error } = fiscal
    ? await supabase.from("empresa_fiscal").update(payload).eq("id", fiscal.id)
    : await supabase.from("empresa_fiscal").insert(payload);
  if (error) throw new Error(`No se pudo crear información fiscal para ${company.nombre_comercial}: ${error.message}`);
  processed += 1;
}

console.log(JSON.stringify({ empresas_demo_actualizadas: processed, nota: "RFC sintéticos para entorno de demostración; no representan contribuyentes reales." }, null, 2));
