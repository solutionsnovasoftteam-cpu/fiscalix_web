import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function POST(request: Request) {
  
  try {
    const body = await request.json();
    console.log(body)
    const { firebaseUid, nombre, apellido, correo, telefono } = body;

    if (!firebaseUid || !nombre || !apellido || !correo || !telefono) {
      return NextResponse.json(
        {
          success: false,
          message: "Faltan datos obligatorios",
          data: null,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("usuarios")
      .insert({
        id: firebaseUid,
        nombre,
        apellido,
        correo,
        telefono,
        estado: "activo",
      })
      .select();

    if (error) {
      console.error("Error de Supabase:", error);

      return NextResponse.json(
        {
          success: false,
          message: error.message,
          details: error,
          data: null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Usuario registrado correctamente",
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en /api/auth/register:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Error interno del servidor",
        data: null,
      },
      { status: 500 }
    );
  }
}