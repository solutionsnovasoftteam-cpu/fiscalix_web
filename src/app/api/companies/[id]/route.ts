import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/companies/[id]">
) {
  // Acepta tanto la sesión web como el Bearer Token de Flutter.
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json(
      { message: "No autorizado" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  // Validar que el usuario tenga acceso a la empresa.
  const { data: membership, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("id")
    .eq("empresa_id", id)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error(
      "Error al validar acceso a empresa:",
      membershipError.message
    );

    return NextResponse.json(
      {
        message:
          "No fue posible validar el acceso a esta empresa.",
      },
      { status: 500 }
    );
  }

  if (!membership) {
    return NextResponse.json(
      {
        message:
          "No tienes permiso para editar esta empresa.",
      },
      { status: 403 }
    );
  }

  // Leer body.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const values = body as {
    nombreComercial?: unknown;
    rfc?: unknown;
  };

  const nombreComercial =
    typeof values.nombreComercial === "string"
      ? values.nombreComercial.trim()
      : "";

  const rfc =
    typeof values.rfc === "string"
      ? values.rfc.trim().toUpperCase()
      : "";

  // Validaciones.
  if (!nombreComercial || !rfc) {
    return NextResponse.json(
      {
        message:
          "Empresa y RFC son obligatorios.",
      },
      { status: 400 }
    );
  }

  const rfcNormalizado = rfc.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-ZÑ&0-9]{12,13}$/.test(rfcNormalizado)) {
    return NextResponse.json(
      {
        message:
          "El RFC debe tener 12 o 13 caracteres y una homoclave válida.",
      },
      { status: 400 }
    );
  }

  // Buscar información fiscal actual de la empresa.
  const {
    data: currentFiscal,
    error: currentFiscalError,
  } = await supabase
    .from("empresa_fiscal")
    .select("id")
    .eq("empresa_id", id)
    .maybeSingle();

  if (currentFiscalError) {
    return NextResponse.json(
      {
        message:
          "No fue posible consultar la información fiscal.",
      },
      { status: 500 }
    );
  }

  // Actualizar empresa.
  const { error: companyError } = await supabase
    .from("empresas")
    .update({
      nombre_comercial: nombreComercial,
      rfc: rfcNormalizado,
    })
    .eq("id", id);

  if (companyError) {
    console.error(
      "Error al actualizar empresa:",
      companyError.message
    );

    return NextResponse.json(
      {
        message:
          "No fue posible actualizar la empresa.",
      },
      { status: 500 }
    );
  }

  // Actualizar RFC fiscal si existe registro.
  if (currentFiscal) {
    const { error: fiscalError } = await supabase
      .from("empresa_fiscal")
      .update({
        actualizado_por: user.id,
        rfc: rfcNormalizado,
      })
      .eq("id", currentFiscal.id);

    if (fiscalError) {
      console.error(
        "Error al actualizar información fiscal:",
        fiscalError.message
      );

      return NextResponse.json(
        {
          message:
            "La empresa se actualizó, pero no fue posible guardar su RFC fiscal.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    message:
      "Información de la empresa actualizada correctamente.",
  });
}