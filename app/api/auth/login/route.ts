import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { firebaseUid } = await request.json();

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", firebaseUid)
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "Usuario no encontrado",
          data: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Login correcto",
      data,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Error interno",
        data: null,
      },
      { status: 500 }
    );
  }
}