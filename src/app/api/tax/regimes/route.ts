import { getApiUser } from "@/lib/auth";
import {
  fiscalFailure,
  fiscalSuccess,
  type FiscalRegimeContract,
} from "@/lib/fiscalApi";
import { supabase } from "@/lib/supabase";

type RegimeRow = {
  id: string;
  clave_sat: string;
  nombre: string;
  descripcion: string | null;
  tipo_persona: string;
  seleccionable_nuevo: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
};

function toContract(row: RegimeRow): FiscalRegimeContract {
  return {
    id: row.id,
    satCode: row.clave_sat,
    name: row.nombre,
    description: row.descripcion,
    personType: "fisica",
    selectableForNewProfiles: row.seleccionable_nuevo,
    validFrom: row.vigencia_desde,
    validUntil: row.vigencia_hasta,
  };
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);
  }

  const { data, error } = await supabase
    .from("regimenes_fiscales")
    .select(
      "id,clave_sat,nombre,descripcion,tipo_persona,seleccionable_nuevo,vigencia_desde,vigencia_hasta",
    )
    .eq("activo", true)
    .eq("tipo_persona", "fisica")
    .order("clave_sat", { ascending: true });

  if (error) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "No fue posible consultar los regímenes fiscales.",
      500,
    );
  }

  return fiscalSuccess({ regimes: ((data ?? []) as RegimeRow[]).map(toContract) });
}
