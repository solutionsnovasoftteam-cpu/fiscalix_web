import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PATCH(request: Request, context: RouteContext<"/api/companies/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

  const { id } = await context.params;
  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("id")
    .eq("empresa_id", id)
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (membershipError) {
    console.error("Error al validar acceso a empresa:", membershipError.message);
    return NextResponse.json({ message: "No fue posible validar el acceso a esta empresa." }, { status: 500 });
  }
  if (!membership) return NextResponse.json({ message: "No tienes permiso para editar esta empresa." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 }); }
  const values = body as { nombreComercial?: unknown; regimenId?: unknown; rfc?: unknown };
  const nombreComercial = typeof values.nombreComercial === "string" ? values.nombreComercial.trim() : "";
  const regimenId = typeof values.regimenId === "string" ? values.regimenId.trim() : "";
  const rfc = typeof values.rfc === "string" ? values.rfc.trim().toUpperCase() : "";

  if (!nombreComercial || !regimenId || !rfc) return NextResponse.json({ message: "Empresa, RFC y régimen fiscal son obligatorios." }, { status: 400 });
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) return NextResponse.json({ message: "El RFC debe tener 12 o 13 caracteres y una homoclave válida." }, { status: 400 });

  const { data: currentFiscal, error: currentFiscalError } = await supabase
    .from("empresa_fiscal")
    .select("id,regimen_id,usuario_id")
    .eq("empresa_id", id)
    .maybeSingle();
  if (currentFiscalError) return NextResponse.json({ message: "No fue posible consultar la información fiscal." }, { status: 500 });

  const { data: regime, error: regimeError } = await supabase
    .from("regimenes_fiscales")
    .select("id,tipo_persona,activo,seleccionable_nuevo")
    .eq("id", regimenId)
    .maybeSingle();
  if (regimeError) return NextResponse.json({ message: "No fue posible validar el régimen fiscal." }, { status: 500 });
  if (!regime) return NextResponse.json({ message: "El régimen fiscal seleccionado no existe." }, { status: 400 });
  if (regime.tipo_persona !== "fisica" || regime.activo === false) {
    return NextResponse.json({ message: "El régimen seleccionado no está disponible para personas físicas." }, { status: 400 });
  }
  if (regime.seleccionable_nuevo === false && currentFiscal?.regimen_id !== regimenId) {
    return NextResponse.json({ message: "Este régimen solo puede conservarse en perfiles fiscales existentes." }, { status: 400 });
  }

  const { error: companyError } = await supabase.from("empresas").update({ nombre_comercial: nombreComercial, rfc }).eq("id", id);
  if (companyError) return NextResponse.json({ message: "No fue posible actualizar la empresa." }, { status: 500 });

  const fiscalPayload = {
    activo: true,
    actualizado_por: user.id,
    empresa_id: id,
    regimen_id: regimenId,
    rfc,
    tipo_persona: "fisica",
    usuario_id: currentFiscal?.usuario_id ?? user.id,
  };
  const { error: fiscalError } = currentFiscal
    ? await supabase.from("empresa_fiscal").update(fiscalPayload).eq("id", currentFiscal.id)
    : await supabase.from("empresa_fiscal").insert({ ...fiscalPayload, creado_por: user.id });
  if (fiscalError) return NextResponse.json({ message: "La empresa se actualizó, pero no fue posible guardar su información fiscal." }, { status: 500 });

  return NextResponse.json({ message: "Información fiscal actualizada correctamente." });
}
