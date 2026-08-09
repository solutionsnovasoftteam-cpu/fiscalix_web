import { canAccessCompany } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import {
  cleanOptionalText,
  FISCAL_PERIODICITIES,
  fiscalFailure,
  fiscalSuccess,
  isIsoDate,
  isUuid,
  type FiscalProfileContract,
  type FiscalRegimeContract,
} from "@/lib/fiscalApi";
import { supabase } from "@/lib/supabase";
import type { FiscalixUser } from "@/models/User";

type ProfileRow = {
  id: string;
  empresa_id: string;
  usuario_id: string;
  regimen_id: string;
  tipo_persona: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  periodicidad: string | null;
  activo: boolean;
  updated_at: string | null;
};

type RegimeRow = {
  id: string;
  clave_sat: string;
  nombre: string;
  descripcion: string | null;
  tipo_persona: string;
  activo: boolean;
  seleccionable_nuevo: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
};

function regimeContract(row: RegimeRow): FiscalRegimeContract {
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

async function loadProfile(companyId: string): Promise<{
  error: string | null;
  profile: FiscalProfileContract | null;
}> {
  const { data: profile, error: profileError } = await supabase
    .from("empresa_fiscal")
    .select(
      "id,empresa_id,usuario_id,regimen_id,tipo_persona,fecha_inicio,fecha_fin,periodicidad,activo,updated_at",
    )
    .eq("empresa_id", companyId)
    .maybeSingle();

  if (profileError) return { error: profileError.message, profile: null };
  if (!profile) return { error: null, profile: null };

  const row = profile as ProfileRow;
  const { data: regime, error: regimeError } = await supabase
    .from("regimenes_fiscales")
    .select(
      "id,clave_sat,nombre,descripcion,tipo_persona,activo,seleccionable_nuevo,vigencia_desde,vigencia_hasta",
    )
    .eq("id", row.regimen_id)
    .maybeSingle();

  if (regimeError || !regime) {
    return { error: regimeError?.message ?? "Régimen fiscal no encontrado.", profile: null };
  }

  return {
    error: null,
    profile: {
      id: row.id,
      companyId: row.empresa_id,
      userId: row.usuario_id,
      regimeId: row.regimen_id,
      personType: "fisica",
      startDate: row.fecha_inicio,
      endDate: row.fecha_fin,
      periodicity: row.periodicidad,
      active: row.activo,
      updatedAt: row.updated_at,
      regime: regimeContract(regime as RegimeRow),
    },
  };
}

async function authorizeCompany(user: FiscalixUser, companyId: string) {
  const access = await canAccessCompany(user, companyId);
  if (access.error) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "No fue posible validar el acceso a la empresa.",
      500,
    );
  }
  if (!access.allowed) {
    return fiscalFailure("ACCESS_DENIED", "No tienes acceso a esta empresa.", 403);
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);

  const companyId = new URL(request.url).searchParams.get("companyId")?.trim();
  if (!companyId) {
    return fiscalFailure("INVALID_REQUEST", "companyId es obligatorio.", 400);
  }
  if (!isUuid(companyId)) {
    return fiscalFailure("INVALID_REQUEST", "companyId debe ser un UUID válido.", 400);
  }

  const accessFailure = await authorizeCompany(user, companyId);
  if (accessFailure) return accessFailure;

  const result = await loadProfile(companyId);
  if (result.error) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "No fue posible consultar el perfil fiscal.",
      500,
    );
  }

  return fiscalSuccess({ configured: Boolean(result.profile), profile: result.profile });
}

export async function PUT(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fiscalFailure("INVALID_REQUEST", "El cuerpo JSON no es válido.", 400);
  }

  const values = body as Record<string, unknown>;
  const companyId = cleanOptionalText(values.companyId);
  const regimeId = cleanOptionalText(values.regimeId);
  const startDate = cleanOptionalText(values.startDate);
  const endDate = cleanOptionalText(values.endDate);
  const periodicity = cleanOptionalText(values.periodicity)?.toLowerCase() ?? null;

  if (!companyId || !regimeId || !startDate) {
    return fiscalFailure(
      "INVALID_REQUEST",
      "companyId, regimeId y startDate son obligatorios.",
      400,
    );
  }
  if (!isUuid(companyId) || !isUuid(regimeId)) {
    return fiscalFailure(
      "INVALID_REQUEST",
      "companyId y regimeId deben ser UUID válidos.",
      400,
    );
  }
  if (!isIsoDate(startDate) || (endDate !== null && !isIsoDate(endDate))) {
    return fiscalFailure(
      "INVALID_REQUEST",
      "Las fechas deben utilizar el formato YYYY-MM-DD.",
      400,
    );
  }
  if (endDate && endDate < startDate) {
    return fiscalFailure(
      "INVALID_REQUEST",
      "endDate no puede ser anterior a startDate.",
      400,
    );
  }
  if (
    periodicity !== null &&
    !FISCAL_PERIODICITIES.includes(
      periodicity as (typeof FISCAL_PERIODICITIES)[number],
    )
  ) {
    return fiscalFailure(
      "INVALID_REQUEST",
      `periodicity debe ser: ${FISCAL_PERIODICITIES.join(", ")}.`,
      400,
    );
  }

  const accessFailure = await authorizeCompany(user, companyId);
  if (accessFailure) return accessFailure;

  const { data: currentProfile, error: currentError } = await supabase
    .from("empresa_fiscal")
    .select("id,regimen_id,usuario_id")
    .eq("empresa_id", companyId)
    .maybeSingle();
  if (currentError) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "No fue posible consultar el perfil fiscal actual.",
      500,
    );
  }

  const { data: regime, error: regimeError } = await supabase
    .from("regimenes_fiscales")
    .select(
      "id,clave_sat,nombre,descripcion,tipo_persona,activo,seleccionable_nuevo,vigencia_desde,vigencia_hasta",
    )
    .eq("id", regimeId)
    .maybeSingle();

  if (regimeError) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "No fue posible validar el régimen fiscal.",
      500,
    );
  }
  if (!regime) {
    return fiscalFailure("NOT_FOUND", "El régimen fiscal no existe.", 404);
  }

  const regimeRow = regime as RegimeRow;
  if (!regimeRow.activo || regimeRow.tipo_persona !== "fisica") {
    return fiscalFailure(
      "INVALID_REQUEST",
      "El régimen no está disponible para personas físicas.",
      400,
    );
  }
  if (!regimeRow.seleccionable_nuevo && currentProfile?.regimen_id !== regimeId) {
    return fiscalFailure(
      "INVALID_REQUEST",
      "Este régimen solo puede conservarse en perfiles existentes.",
      400,
    );
  }
  if (
    (regimeRow.vigencia_desde && startDate < regimeRow.vigencia_desde) ||
    (regimeRow.vigencia_hasta && startDate > regimeRow.vigencia_hasta)
  ) {
    return fiscalFailure(
      "INVALID_REQUEST",
      "El régimen no está vigente para la fecha de inicio indicada.",
      400,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    empresa_id: companyId,
    usuario_id: currentProfile?.usuario_id ?? user.id,
    regimen_id: regimeId,
    tipo_persona: "fisica",
    fecha_inicio: startDate,
    fecha_fin: endDate,
    periodicidad: periodicity,
    activo: endDate === null || endDate >= today,
    actualizado_por: user.id,
  };

  const { error: saveError } = currentProfile
    ? await supabase.from("empresa_fiscal").update(payload).eq("id", currentProfile.id)
    : await supabase
        .from("empresa_fiscal")
        .insert({ ...payload, creado_por: user.id });

  if (saveError) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "No fue posible guardar el perfil fiscal.",
      500,
    );
  }

  const saved = await loadProfile(companyId);
  if (saved.error || !saved.profile) {
    return fiscalFailure(
      "DATABASE_ERROR",
      "El perfil se guardó, pero no fue posible recuperar el resultado.",
      500,
    );
  }

  return fiscalSuccess({ configured: true, profile: saved.profile });
}

export async function PATCH(request: Request) {
  return PUT(request);
}
