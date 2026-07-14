import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado", data: null }, { status: 401 });
  }
  return NextResponse.json({ success: true, message: "Usuario encontrado", data: user });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Solicitud inválida" }, { status: 400 });
  }

  const values = body as { apellido?: unknown; nombre?: unknown; telefono?: unknown };
  const nombre = typeof values.nombre === "string" ? values.nombre.trim() : "";
  const apellido = typeof values.apellido === "string" ? values.apellido.trim() : "";
  const telefono = typeof values.telefono === "string" ? values.telefono.trim() : "";

  if (!nombre || !apellido) {
    return NextResponse.json({ success: false, message: "Nombre y apellido son obligatorios." }, { status: 400 });
  }
  if (nombre.length > 80 || apellido.length > 80 || telefono.length > 25) {
    return NextResponse.json({ success: false, message: "Uno de los campos excede la longitud permitida." }, { status: 400 });
  }
  if (telefono && !/^[0-9+()\-\s]{7,25}$/.test(telefono)) {
    return NextResponse.json({ success: false, message: "Ingresa un teléfono válido." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update({ apellido, nombre, telefono: telefono || null })
    .eq("id", user.id)
    .select("id,nombre,apellido,correo,telefono,estado")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, message: "No fue posible actualizar la información." }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Información actualizada correctamente.", data });
}
