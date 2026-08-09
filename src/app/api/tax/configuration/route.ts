import { canAccessCompany } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import {
  cleanOptionalText,
  fiscalFailure,
  fiscalSuccess,
  isUuid,
  type FiscalActivityContract,
  type FiscalCompatibilityStatus,
  type FiscalObligationSuggestionContract,
} from "@/lib/fiscalApi";
import { supabase } from "@/lib/supabase";
import type { FiscalixUser } from "@/models/User";

type ActivityRow = {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  requiere_revision: boolean;
};

type AdditionalRegimeRow = {
  regimen_id: string;
  estado_revision: FiscalCompatibilityStatus;
  condicion_aceptada: boolean;
};

type CompatibilityRow = {
  regimen_origen_id: string;
  regimen_destino_id: string;
  resultado: Exclude<FiscalCompatibilityStatus, "pendiente">;
  condicion: string | null;
};

type SuggestionRow = {
  id: string;
  regimen_id: string;
  clave: string;
  nombre: string;
  descripcion: string | null;
  impuesto: string | null;
  periodicidad: string | null;
  requerida: boolean;
  condicion: string | null;
};

type DecisionRow = { sugerencia_id: string; estado: "pendiente" | "confirmada" | "rechazada" };

async function authorizeCompany(user: FiscalixUser, companyId: string) {
  const access = await canAccessCompany(user, companyId);
  if (access.error) return fiscalFailure("DATABASE_ERROR", "No fue posible validar el acceso a la empresa.", 500);
  if (!access.allowed) return fiscalFailure("ACCESS_DENIED", "No tienes acceso a esta empresa.", 403);
  return null;
}

async function loadConfiguration(companyId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("empresa_fiscal")
    .select("id,regimen_id")
    .eq("empresa_id", companyId)
    .maybeSingle();
  if (profileError) return { error: profileError.message, data: null };

  const [catalogResult, selectedResult, additionalResult, decisionsResult] = await Promise.all([
    supabase
      .from("actividades_economicas")
      .select("id,clave,nombre,descripcion,requiere_revision")
      .eq("tipo_persona", "fisica")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("empresa_actividad_fiscal")
      .select("actividad_id,descripcion_personalizada,principal")
      .eq("empresa_id", companyId)
      .eq("activa", true),
    supabase
      .from("empresa_regimen_adicional")
      .select("regimen_id,estado_revision,condicion_aceptada")
      .eq("empresa_id", companyId)
      .eq("activo", true),
    supabase
      .from("empresa_obligacion_confirmacion")
      .select("sugerencia_id,estado")
      .eq("empresa_id", companyId),
  ]);

  const firstError = catalogResult.error || selectedResult.error || additionalResult.error || decisionsResult.error;
  if (firstError) return { error: firstError.message, data: null };

  const additional = (additionalResult.data ?? []) as AdditionalRegimeRow[];
  const regimeIds = [profile?.regimen_id, ...additional.map((item) => item.regimen_id)].filter(Boolean) as string[];
  const [suggestionsResult, compatibilityResult] = await Promise.all([
    regimeIds.length
      ? supabase
          .from("regimen_obligacion_sugerida")
          .select("id,regimen_id,clave,nombre,descripcion,impuesto,periodicidad,requerida,condicion")
          .in("regimen_id", regimeIds)
          .eq("activo", true)
          .order("nombre")
      : Promise.resolve({ data: [] as SuggestionRow[], error: null }),
    profile?.regimen_id
      ? supabase
          .from("regimen_compatibilidad")
          .select("regimen_origen_id,regimen_destino_id,resultado,condicion")
          .or(`regimen_origen_id.eq.${profile.regimen_id},regimen_destino_id.eq.${profile.regimen_id}`)
          .eq("activo", true)
      : Promise.resolve({ data: [] as CompatibilityRow[], error: null }),
  ]);
  if (suggestionsResult.error || compatibilityResult.error) {
    return { error: suggestionsResult.error?.message ?? compatibilityResult.error?.message ?? "Error fiscal", data: null };
  }

  const decisions = new Map(
    ((decisionsResult.data ?? []) as DecisionRow[]).map((item) => [item.sugerencia_id, item.estado]),
  );
  const activities = (catalogResult.data ?? []) as ActivityRow[];
  const suggestions = (suggestionsResult.data ?? []) as SuggestionRow[];

  return {
    error: null,
    data: {
      configured: Boolean(profile),
      primaryRegimeId: profile?.regimen_id ?? null,
      activitiesCatalog: activities.map((item): FiscalActivityContract => ({
        id: item.id,
        code: item.clave,
        name: item.nombre,
        description: item.descripcion,
        requiresReview: item.requiere_revision,
      })),
      selectedActivities: selectedResult.data ?? [],
      additionalRegimes: additional,
      compatibilityRules: (compatibilityResult.data ?? []) as CompatibilityRow[],
      obligationSuggestions: suggestions.map((item): FiscalObligationSuggestionContract => ({
        id: item.id,
        regimeId: item.regimen_id,
        code: item.clave,
        name: item.nombre,
        description: item.descripcion,
        tax: item.impuesto,
        periodicity: item.periodicidad,
        required: item.requerida,
        condition: item.condicion,
        decision: decisions.get(item.id) ?? "pendiente",
      })),
    },
  };
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);
  const companyId = new URL(request.url).searchParams.get("companyId")?.trim() ?? "";
  if (!isUuid(companyId)) return fiscalFailure("INVALID_REQUEST", "companyId debe ser un UUID válido.", 400);
  const accessFailure = await authorizeCompany(user, companyId);
  if (accessFailure) return accessFailure;
  const result = await loadConfiguration(companyId);
  if (result.error) {
    return fiscalFailure("DATABASE_ERROR", "No fue posible consultar la configuración fiscal avanzada. Ejecuta la migración de la etapa 4.", 500);
  }
  return fiscalSuccess(result.data);
}

export async function PUT(request: Request) {
  const user = await getApiUser(request);
  if (!user) return fiscalFailure("AUTH_REQUIRED", "Debes iniciar sesión.", 401);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fiscalFailure("INVALID_REQUEST", "El cuerpo JSON no es válido.", 400);
  }

  const companyId = cleanOptionalText(body.companyId) ?? "";
  const activityIds = Array.isArray(body.activityIds) ? body.activityIds.filter((value): value is string => typeof value === "string") : [];
  const additionalRegimeIds = Array.isArray(body.additionalRegimeIds)
    ? body.additionalRegimeIds.filter((value): value is string => typeof value === "string")
    : [];
  const acceptedConditions = Array.isArray(body.acceptedConditions)
    ? body.acceptedConditions.filter((value): value is string => typeof value === "string")
    : [];
  const obligationDecisions = Array.isArray(body.obligationDecisions)
    ? body.obligationDecisions.filter((value): value is { suggestionId: string; state: string } => {
        if (!value || typeof value !== "object") return false;
        const item = value as Record<string, unknown>;
        return typeof item.suggestionId === "string" && typeof item.state === "string";
      })
    : [];

  if (!isUuid(companyId)) return fiscalFailure("INVALID_REQUEST", "companyId debe ser un UUID válido.", 400);
  if (activityIds.length > 10 || additionalRegimeIds.length > 10 || obligationDecisions.length > 50) {
    return fiscalFailure("INVALID_REQUEST", "La configuración excede el número permitido de elementos.", 400);
  }
  if ([...activityIds, ...additionalRegimeIds, ...acceptedConditions, ...obligationDecisions.map((item) => item.suggestionId)].some((id) => !isUuid(id))) {
    return fiscalFailure("INVALID_REQUEST", "Los identificadores deben ser UUID válidos.", 400);
  }
  if (obligationDecisions.some((item) => !["pendiente", "confirmada", "rechazada"].includes(item.state))) {
    return fiscalFailure("INVALID_REQUEST", "El estado de una obligación no es válido.", 400);
  }

  const accessFailure = await authorizeCompany(user, companyId);
  if (accessFailure) return accessFailure;
  const { data: profile, error: profileError } = await supabase
    .from("empresa_fiscal")
    .select("id,regimen_id")
    .eq("empresa_id", companyId)
    .maybeSingle();
  if (profileError) return fiscalFailure("DATABASE_ERROR", "No fue posible consultar el perfil fiscal.", 500);
  if (!profile) return fiscalFailure("INVALID_REQUEST", "Primero configura el régimen fiscal principal.", 400);

  const uniqueActivities = [...new Set(activityIds)];
  const uniqueAdditional = [...new Set(additionalRegimeIds)].filter((id) => id !== profile.regimen_id);
  const uniqueAcceptedConditions = [...new Set(acceptedConditions)];
  const uniqueDecisions = [...new Map(obligationDecisions.map((item) => [item.suggestionId, item])).values()];
  if (uniqueAcceptedConditions.some((id) => !uniqueAdditional.includes(id))) {
    return fiscalFailure("INVALID_REQUEST", "Solo puedes aceptar condiciones de regímenes seleccionados.", 400);
  }
  if (uniqueActivities.length) {
    const { data, error } = await supabase
      .from("actividades_economicas")
      .select("id")
      .in("id", uniqueActivities)
      .eq("tipo_persona", "fisica")
      .eq("activo", true);
    if (error || (data ?? []).length !== uniqueActivities.length) {
      return fiscalFailure("INVALID_REQUEST", "Una actividad económica no está disponible.", 400);
    }
  }
  if (uniqueAdditional.length) {
    const { data, error } = await supabase
      .from("regimenes_fiscales")
      .select("id")
      .in("id", uniqueAdditional)
      .eq("tipo_persona", "fisica")
      .eq("activo", true)
      .eq("seleccionable_nuevo", true);
    if (error || (data ?? []).length !== uniqueAdditional.length) {
      return fiscalFailure("INVALID_REQUEST", "Un régimen adicional no está disponible.", 400);
    }
  }

  const { data: ruleRows, error: rulesError } = uniqueAdditional.length
    ? await supabase
        .from("regimen_compatibilidad")
        .select("regimen_origen_id,regimen_destino_id,resultado,condicion")
        .or(`regimen_origen_id.eq.${profile.regimen_id},regimen_destino_id.eq.${profile.regimen_id}`)
        .eq("activo", true)
    : { data: [] as CompatibilityRow[], error: null };
  if (rulesError) return fiscalFailure("DATABASE_ERROR", "No fue posible validar la compatibilidad fiscal.", 500);

  const rules = (ruleRows ?? []) as CompatibilityRow[];
  const resolved = uniqueAdditional.map((regimeId) => {
    const rule = rules.find((item) =>
      (item.regimen_origen_id === profile.regimen_id && item.regimen_destino_id === regimeId)
      || (item.regimen_destino_id === profile.regimen_id && item.regimen_origen_id === regimeId));
    return {
      regimeId,
      result: rule?.resultado ?? "revision_profesional" as FiscalCompatibilityStatus,
      condition: rule?.condicion ?? null,
    };
  });
  const incompatible = resolved.find((item) => item.result === "incompatible");
  if (incompatible) {
    return fiscalFailure("INVALID_REQUEST", "La combinación de regímenes seleccionada es incompatible.", 400, { regimeId: incompatible.regimeId });
  }
  const missingAcceptance = resolved.find((item) => item.result === "condicionado" && !uniqueAcceptedConditions.includes(item.regimeId));
  if (missingAcceptance) {
    return fiscalFailure("INVALID_REQUEST", "Debes aceptar la condición de la combinación fiscal.", 400, {
      regimeId: missingAcceptance.regimeId,
      condition: missingAcceptance.condition,
    });
  }

  const { error: clearActivitiesError } = await supabase.from("empresa_actividad_fiscal").delete().eq("empresa_id", companyId);
  if (clearActivitiesError) return fiscalFailure("DATABASE_ERROR", "No fue posible actualizar las actividades.", 500);
  if (uniqueActivities.length) {
    const { error } = await supabase.from("empresa_actividad_fiscal").insert(uniqueActivities.map((activityId, index) => ({
      empresa_id: companyId,
      empresa_fiscal_id: profile.id,
      actividad_id: activityId,
      principal: index === 0,
      creado_por: user.id,
      actualizado_por: user.id,
    })));
    if (error) return fiscalFailure("DATABASE_ERROR", "No fue posible guardar las actividades.", 500);
  }

  const { error: clearRegimesError } = await supabase.from("empresa_regimen_adicional").delete().eq("empresa_id", companyId);
  if (clearRegimesError) return fiscalFailure("DATABASE_ERROR", "No fue posible actualizar los regímenes adicionales.", 500);
  if (resolved.length) {
    const { error } = await supabase.from("empresa_regimen_adicional").insert(resolved.map((item) => ({
      empresa_id: companyId,
      empresa_fiscal_id: profile.id,
      regimen_id: item.regimeId,
      estado_revision: item.result,
      condicion_aceptada: item.result === "condicionado" && uniqueAcceptedConditions.includes(item.regimeId),
      creado_por: user.id,
      actualizado_por: user.id,
    })));
    if (error) return fiscalFailure("DATABASE_ERROR", "No fue posible guardar los regímenes adicionales.", 500);
  }

  if (uniqueDecisions.length) {
    const allowedRegimeIds = [profile.regimen_id, ...uniqueAdditional];
    const { data: validSuggestions, error } = await supabase
      .from("regimen_obligacion_sugerida")
      .select("id,regimen_id")
      .in("id", uniqueDecisions.map((item) => item.suggestionId))
      .in("regimen_id", allowedRegimeIds)
      .eq("activo", true);
    if (error || (validSuggestions ?? []).length !== uniqueDecisions.length) {
      return fiscalFailure("INVALID_REQUEST", "Una obligación sugerida no corresponde a los regímenes seleccionados.", 400);
    }
    const now = new Date().toISOString();
    const { error: decisionsError } = await supabase.from("empresa_obligacion_confirmacion").upsert(
      uniqueDecisions.map((item) => ({
        empresa_id: companyId,
        sugerencia_id: item.suggestionId,
        estado: item.state,
        confirmado_por: item.state === "pendiente" ? null : user.id,
        confirmado_at: item.state === "pendiente" ? null : now,
      })),
      { onConflict: "empresa_id,sugerencia_id" },
    );
    if (decisionsError) return fiscalFailure("DATABASE_ERROR", "No fue posible guardar las decisiones de obligaciones.", 500);
  }

  const saved = await loadConfiguration(companyId);
  if (saved.error) return fiscalFailure("DATABASE_ERROR", "La configuración se guardó, pero no pudo recuperarse.", 500);
  return fiscalSuccess(saved.data);
}

export async function PATCH(request: Request) {
  return PUT(request);
}
