import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const firebaseUid = searchParams.get("uid");

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", firebaseUid)
    .single();

  if (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        data: null,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Usuario encontrado",
    data,
  });
}