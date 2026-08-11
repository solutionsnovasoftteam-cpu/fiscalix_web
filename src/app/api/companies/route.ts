import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return NextResponse.json(
      { message: "No autorizado" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("empresa_usuario")
    .select(`
      empresa_id,
      empresas (
        id,
        nombre_comercial,
        rfc,
        estado
      )
    `)
    .eq("usuario_id", user.id);

  if (error) {
    console.error(
      "Error al obtener las empresas del usuario:",
      error.message
    );

    return NextResponse.json(
      {
        message: "No fue posible obtener las empresas del usuario.",
      },
      { status: 500 }
    );
  }

  const companies = (data ?? [])
    .map((item) => {
      const empresa = Array.isArray(item.empresas)
        ? item.empresas[0]
        : item.empresas;

      if (!empresa) return null;

      return {
        id: empresa.id,
        nombreComercial: empresa.nombre_comercial,
        rfc: empresa.rfc ?? "",
        estado: empresa.estado ?? "activo",
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    companies,
  });
}