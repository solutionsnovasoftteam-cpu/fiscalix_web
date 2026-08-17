import { NextResponse } from "next/server";
import { canAccessCompany } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import { createNotificationOncePerDay } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SuggestionRow = {
  descripcion: string | null;
  id: string;
  nombre: string | null;
  periodicidad: string | null;
};

type ObligationRow = {
  completada_at: string | null;
  empresa_id: string;
  estado: "completada" | "pendiente";
  fecha_vencimiento: string;
  id: string;
  periodo_clave: string;
  sugerencia_id: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextDueDate(periodicity: string | null, today = new Date()) {
  const normalized = periodicity?.toLowerCase() ?? "mensual";
  const dueDate = new Date(today.getFullYear(), today.getMonth(), 17);
  if (dueDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }

  if (normalized.includes("trimestral")) dueDate.setMonth(dueDate.getMonth() + 2);
  if (normalized.includes("semestral")) dueDate.setMonth(dueDate.getMonth() + 5);
  if (normalized.includes("anual")) return new Date(today.getFullYear() + 1, 0, 31);
  return dueDate;
}

function statusFor(row: ObligationRow, today = new Date()) {
  if (row.estado === "completada") return "completada";
  const dueDate = new Date(`${row.fecha_vencimiento}T12:00:00`);
  const daysUntilDue = Math.round((dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  if (daysUntilDue < 0) return "vencida";
  if (daysUntilDue <= 7) return "por_vencer";
  return "proxima";
}

async function synchronizeObligations(companyId: string) {
  const { data: confirmations, error: confirmationsError } = await supabase
    .from("empresa_obligacion_confirmacion")
    .select("sugerencia_id,estado")
    .eq("empresa_id", companyId);
  if (confirmationsError) throw new Error(confirmationsError.message);

  const [{ data: profile, error: profileError }, { data: additionalRegimes, error: additionalRegimesError }] = await Promise.all([
    supabase.from("empresa_fiscal").select("regimen_id").eq("empresa_id", companyId).maybeSingle(),
    supabase.from("empresa_regimen_adicional").select("regimen_id").eq("empresa_id", companyId).eq("activo", true),
  ]);
  if (profileError || additionalRegimesError) {
    throw new Error(profileError?.message ?? additionalRegimesError?.message ?? "No fue posible cargar los regímenes fiscales.");
  }

  const regimeIds = [
    profile?.regimen_id as string | undefined,
    ...(additionalRegimes ?? []).map((regime) => regime.regimen_id as string),
  ].filter((id): id is string => Boolean(id));
  if (!regimeIds.length) return;

  const { data: suggestions, error: suggestionsError } = await supabase
    .from("regimen_obligacion_sugerida")
    .select("id,clave,regimen_id,periodicidad")
    .in("regimen_id", regimeIds)
    .eq("activo", true);
  if (suggestionsError) throw new Error(suggestionsError.message);

  const decisionBySuggestionId = new Map(
    (confirmations ?? []).map((confirmation) => [
      confirmation.sugerencia_id as string,
      confirmation.estado as string,
    ]),
  );
  const uniqueSuggestions = new Map<string, { id: string; clave: string | null; periodicidad: string | null }>();
  for (const suggestion of (suggestions ?? []) as Array<{ id: string; clave: string | null; periodicidad: string | null }>) {
    if (decisionBySuggestionId.get(suggestion.id) !== "rechazada") {
      uniqueSuggestions.set(suggestion.clave ?? suggestion.id, suggestion);
    }
  }

  const now = new Date();
  const instances = [...uniqueSuggestions.values()].map((suggestion) => {
    const dueDate = nextDueDate(suggestion.periodicidad, now);
    return {
      empresa_id: companyId,
      sugerencia_id: suggestion.id,
      periodo_clave: monthKey(dueDate),
      fecha_vencimiento: dateKey(dueDate),
      estado: "pendiente",
      updated_at: new Date().toISOString(),
    };
  });

  if (!instances.length) return;
  const { error } = await supabase
    .from("empresa_obligacion_periodo")
    .upsert(instances, { onConflict: "empresa_id,sugerencia_id,periodo_clave", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

function normalize(row: ObligationRow, suggestion: SuggestionRow) {
  return {
    id: row.id,
    companyId: row.empresa_id,
    suggestionId: row.sugerencia_id,
    title: suggestion.nombre ?? "Obligación fiscal",
    description: suggestion.descripcion,
    periodicity: suggestion.periodicidad ?? "Mensual",
    periodKey: row.periodo_clave,
    dueDate: row.fecha_vencimiento,
    status: statusFor(row),
    completedAt: row.completada_at,
  };
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

  const companyId = new URL(request.url).searchParams.get("companyId")?.trim() ?? "";
  if (!isUuid(companyId)) return NextResponse.json({ message: "companyId debe ser un UUID válido." }, { status: 400 });

  const access = await canAccessCompany(user, companyId);
  if (access.error) return NextResponse.json({ message: "No fue posible validar el acceso a la empresa." }, { status: 500 });
  if (!access.allowed) return NextResponse.json({ message: "No tienes acceso a esta empresa." }, { status: 403 });

  try {
    await synchronizeObligations(companyId);
    const { data: rows, error } = await supabase
      .from("empresa_obligacion_periodo")
      .select("id,empresa_id,sugerencia_id,periodo_clave,fecha_vencimiento,estado,completada_at")
      .eq("empresa_id", companyId)
      .order("fecha_vencimiento", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);

    const obligationRows = (rows ?? []) as ObligationRow[];
    const suggestionIds = [...new Set(obligationRows.map((row) => row.sugerencia_id))];
    const { data: suggestions, error: suggestionsError } = suggestionIds.length
      ? await supabase.from("regimen_obligacion_sugerida").select("id,nombre,descripcion,periodicidad").in("id", suggestionIds)
      : { data: [], error: null };
    if (suggestionsError) throw new Error(suggestionsError.message);

    const suggestionsById = new Map(((suggestions ?? []) as SuggestionRow[]).map((suggestion) => [suggestion.id, suggestion]));
    return NextResponse.json({
      obligations: obligationRows
        .map((row) => {
          const suggestion = suggestionsById.get(row.sugerencia_id);
          return suggestion ? normalize(row, suggestion) : null;
        })
        .filter(Boolean),
    });
  } catch (error) {
    console.error("Error al consultar obligaciones fiscales:", error);
    return NextResponse.json({ message: "No fue posible cargar las obligaciones fiscales. Ejecuta la migración de etapa 8." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

  const obligationId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!isUuid(obligationId)) return NextResponse.json({ message: "id debe ser un UUID válido." }, { status: 400 });

  try {
    const { data: row, error: lookupError } = await supabase
      .from("empresa_obligacion_periodo")
      .select("id,empresa_id,sugerencia_id,periodo_clave,fecha_vencimiento,estado,completada_at")
      .eq("id", obligationId)
      .maybeSingle();
    if (lookupError || !row) return NextResponse.json({ message: "No se encontró la obligación." }, { status: 404 });

    const obligation = row as ObligationRow;
    const access = await canAccessCompany(user, obligation.empresa_id);
    if (access.error || !access.allowed) return NextResponse.json({ message: "No tienes acceso a esta obligación." }, { status: 403 });

    const completedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("empresa_obligacion_periodo")
      .update({ estado: "completada", completada_at: completedAt, completada_por: user.id, updated_at: completedAt })
      .eq("id", obligationId)
      .select("id,empresa_id,sugerencia_id,periodo_clave,fecha_vencimiento,estado,completada_at")
      .single();
    if (updateError) throw new Error(updateError.message);

    const { data: suggestion, error: suggestionError } = await supabase
      .from("regimen_obligacion_sugerida")
      .select("id,nombre,descripcion,periodicidad")
      .eq("id", obligation.sugerencia_id)
      .single();
    if (suggestionError) throw new Error(suggestionError.message);

    const normalized = normalize(updated as ObligationRow, suggestion as SuggestionRow);
    await createNotificationOncePerDay({
      userId: user.id,
      title: "Obligación fiscal completada",
      message: `${normalized.title} del periodo ${normalized.periodKey} fue marcada como completada.`,
      type: "success",
      url: `/tax/obligations?id=${normalized.id}`,
    });
    return NextResponse.json({ obligation: normalized });
  } catch (error) {
    console.error("Error al completar obligación fiscal:", error);
    return NextResponse.json({ message: "No fue posible completar la obligación fiscal." }, { status: 500 });
  }
}
