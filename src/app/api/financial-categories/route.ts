import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type FinancialCategoryRow = {
  id: string;
  nombre: string;
  tipo: string | null;
};

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("categorias_financieras")
    .select("id,nombre,tipo")
    .order("nombre", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, message: "No fue posible consultar las categorías financieras." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { categories: (data ?? []) as FinancialCategoryRow[] },
  });
}
