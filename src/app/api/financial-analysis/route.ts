import { NextResponse } from "next/server";
import { getCompanyIfAccessible } from "@/lib/access-control";
import { getApiUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type AnalysisRequest = {
  companyId?: unknown;
  force?: unknown;
  period?: unknown;
};

type SavedAnalysisRow = {
  analisis: GeminiAnalysis;
  updated_at: string;
};

type MovementRow = {
  monto: number | string | null;
  estado: string | null;
  deducible?: boolean | null;
  categorias_financieras?: { nombre?: string | null } | { nombre?: string | null }[] | null;
};

type AnalysisFinding = {
  action: "estimation" | "movements" | "reports";
  description: string;
  title: string;
  type: "info" | "positive" | "warning";
};

type GeminiAnalysis = {
  findings: AnalysisFinding[];
  recommendations: string[];
  summary: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isCancelled(status: string | null) {
  return status?.trim().toLowerCase() === "cancelado";
}

function monthRange(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const [year, month] = period.split("-").map(Number);
  if (!year || month < 1 || month > 12) return null;

  const start = `${period}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  const end = next.toISOString().slice(0, 10);
  return { end, start };
}

function previousPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidate = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return candidate.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function parseGeminiAnalysis(value: string): GeminiAnalysis | null {
  try {
    const parsed = JSON.parse(value.replace(/^```json\s*|\s*```$/g, "")) as Partial<GeminiAnalysis>;
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.findings) || !Array.isArray(parsed.recommendations)) {
      return null;
    }

    const findings = parsed.findings
      .filter((finding): finding is AnalysisFinding => Boolean(
        finding &&
        typeof finding.title === "string" &&
        typeof finding.description === "string" &&
        ["info", "positive", "warning"].includes(finding.type) &&
        ["estimation", "movements", "reports"].includes(finding.action),
      ))
      .slice(0, 4);
    const recommendations = parsed.recommendations
      .filter((recommendation): recommendation is string => typeof recommendation === "string" && recommendation.trim().length > 0)
      .slice(0, 4);

    return { findings, recommendations, summary: parsed.summary.trim() };
  } catch {
    return null;
  }
}

async function getSavedAnalysis(companyId: string, period: string) {
  return supabase
    .from("analisis_financieros_ia")
    .select("analisis,updated_at")
    .eq("empresa_id", companyId)
    .eq("periodo_clave", period)
    .maybeSingle() as unknown as { data: SavedAnalysisRow | null; error: { message: string } | null };
}

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });

  const url = new URL(request.url);
  const companyId = cleanText(url.searchParams.get("companyId"));
  const period = cleanText(url.searchParams.get("period"));
  if (!companyId || !monthRange(period)) {
    return NextResponse.json({ message: "Empresa y periodo YYYY-MM son obligatorios." }, { status: 400 });
  }

  const { company, error: accessError } = await getCompanyIfAccessible(user, companyId);
  if (accessError) return NextResponse.json({ message: "No fue posible validar la empresa." }, { status: 500 });
  if (!company) return NextResponse.json({ message: "No tienes acceso a esta empresa." }, { status: 403 });

  const { data, error } = await getSavedAnalysis(companyId, period);
  if (error) {
    console.error("No fue posible consultar el análisis guardado:", error.message);
    return NextResponse.json({ analysis: null, period });
  }
  if (!data) return NextResponse.json({ analysis: null, period });

  return NextResponse.json({ analysis: data.analisis, generatedAt: data.updated_at, period });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ message: "No autorizado." }, { status: 401 });

  let body: AnalysisRequest;
  try {
    body = (await request.json()) as AnalysisRequest;
  } catch {
    return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });
  }

  const companyId = cleanText(body.companyId);
  const period = cleanText(body.period);
  const force = body.force == true;
  const range = monthRange(period);
  if (!companyId || !range) {
    return NextResponse.json({ message: "Empresa y periodo YYYY-MM son obligatorios." }, { status: 400 });
  }

  const { company, error: accessError } = await getCompanyIfAccessible(user, companyId);
  if (accessError) return NextResponse.json({ message: "No fue posible validar la empresa." }, { status: 500 });
  if (!company) return NextResponse.json({ message: "No tienes acceso a esta empresa." }, { status: 403 });

  if (!force) {
    const { data, error } = await getSavedAnalysis(companyId, period);
    if (error) console.error("No fue posible consultar el análisis guardado:", error.message);
    if (data) return NextResponse.json({ analysis: data.analisis, generatedAt: data.updated_at, period, saved: true });
  }

  const previousRange = monthRange(previousPeriod(period));
  if (!previousRange) return NextResponse.json({ message: "No fue posible determinar el periodo anterior." }, { status: 400 });

  const [incomeResult, expenseResult, previousIncomeResult, previousExpenseResult] = await Promise.all([
    supabase.from("ingresos").select("monto,estado,categorias_financieras(nombre)").eq("empresa_id", companyId).gte("fecha_ingreso", range.start).lt("fecha_ingreso", range.end),
    supabase.from("gastos").select("monto,estado,deducible,categorias_financieras(nombre)").eq("empresa_id", companyId).gte("fecha_gasto", range.start).lt("fecha_gasto", range.end),
    supabase.from("ingresos").select("monto,estado").eq("empresa_id", companyId).gte("fecha_ingreso", previousRange.start).lt("fecha_ingreso", previousRange.end),
    supabase.from("gastos").select("monto,estado").eq("empresa_id", companyId).gte("fecha_gasto", previousRange.start).lt("fecha_gasto", previousRange.end),
  ]);

  const queryError = incomeResult.error || expenseResult.error || previousIncomeResult.error || previousExpenseResult.error;
  if (queryError) return NextResponse.json({ message: "No fue posible obtener los movimientos para el análisis." }, { status: 500 });

  const incomes = ((incomeResult.data ?? []) as MovementRow[]).filter((row) => !isCancelled(row.estado));
  const expenses = ((expenseResult.data ?? []) as MovementRow[]).filter((row) => !isCancelled(row.estado));
  const previousIncomes = ((previousIncomeResult.data ?? []) as MovementRow[]).filter((row) => !isCancelled(row.estado));
  const previousExpenses = ((previousExpenseResult.data ?? []) as MovementRow[]).filter((row) => !isCancelled(row.estado));
  const incomeTotal = incomes.reduce((total, row) => total + asAmount(row.monto), 0);
  const expenseTotal = expenses.reduce((total, row) => total + asAmount(row.monto), 0);
  const deductibleTotal = expenses
    .filter((row) => row.deducible)
    .reduce((total, row) => total + asAmount(row.monto), 0);
  const previousIncomeTotal = previousIncomes.reduce((total, row) => total + asAmount(row.monto), 0);
  const previousExpenseTotal = previousExpenses.reduce((total, row) => total + asAmount(row.monto), 0);
  const categories = new Map<string, number>();

  for (const expense of expenses) {
    const categoryValue = Array.isArray(expense.categorias_financieras)
      ? expense.categorias_financieras[0]?.nombre
      : expense.categorias_financieras?.nombre;
    const category = categoryValue?.trim() || "Sin categoría";
    categories.set(category, (categories.get(category) ?? 0) + asAmount(expense.monto));
  }

  const topExpenseCategories = Array.from(categories.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, amount]) => ({ amount, name }));

  if (incomeTotal === 0 && expenseTotal === 0) {
    return NextResponse.json({ message: "Registra ingresos o gastos del periodo antes de solicitar un análisis." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ message: "El análisis con IA no está configurado en el servidor." }, { status: 503 });
  }

  // Lista en cascada de modelos a intentar en orden de preferencia
  const preferredModel = process.env.GEMINI_MODEL?.trim();
  const fallbackModels = [
    ...(preferredModel ? [preferredModel] : []),
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  const candidateModels = Array.from(new Set(fallbackModels));

  const context = {
    companyName: company.nombre_comercial || "Empresa",
    currentPeriod: { deductibleExpenses: deductibleTotal, expenses: expenseTotal, incomes: incomeTotal, net: incomeTotal - expenseTotal, period, topExpenseCategories },
    previousPeriod: { expenses: previousExpenseTotal, incomes: previousIncomeTotal, net: previousIncomeTotal - previousExpenseTotal },
  };
  const prompt = [
    "Eres un asistente de análisis financiero para un proyecto académico mexicano.",
    "Analiza exclusivamente los datos agregados proporcionados. No inventes cifras, obligaciones fiscales ni asesoría profesional.",
    "Da prioridad a flujo de efectivo, variaciones entre periodos, gastos deducibles y concentración por categoría. Mantén recomendaciones prácticas y prudentes.",
    "Responde en español y devuelve solamente JSON válido con summary, findings y recommendations.",
    "findings debe contener hasta 4 objetos con type (info, positive o warning), action (movements, estimation o reports), title y description. recommendations debe contener hasta 4 textos breves y accionables.",
    JSON.stringify(context),
  ].join("\n\n");

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 12000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  let geminiResponse: Response | null = null;
  let lastUsedModel = candidateModels[0];

  // Recorre la lista de modelos candidatos
  for (const model of candidateModels) {
    lastUsedModel = model;

    // Intenta hasta 2 veces por modelo en caso de errores temporales de red/servidor
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        geminiResponse = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
            }),
          },
        );

        // Si es exitoso, salimos inmediatamente
        if (geminiResponse.ok) {
          break;
        }

        // Si el modelo no existe o no está disponible para tu clave (404/400), pasa al siguiente candidato inmediatamente
        if (geminiResponse.status === 404 || geminiResponse.status === 400) {
          console.warn(`Modelo ${model} no disponible (${geminiResponse.status}). Probando siguiente opción...`);
          break;
        }
      } catch (error) {
        console.warn(`Error de red con el modelo ${model} (intento ${attempt + 1}):`, error);
      }

      // Esperar 1 segundo si fue saturación o caída temporal (503 / 429) antes del reintento
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (geminiResponse?.ok) {
      break;
    }
  }

  if (!geminiResponse) {
    return NextResponse.json({ message: "No fue posible conectar con ningún modelo de Gemini tras varios intentos." }, { status: 502 });
  }

  const geminiPayload = await geminiResponse.json().catch(() => null);
  if (!geminiResponse.ok) {
    const providerMessage = geminiPayload && typeof geminiPayload === "object" && "error" in geminiPayload
      ? (geminiPayload.error as { message?: unknown }).message
      : null;
    console.error("Error de Gemini al generar análisis:", {
      message: typeof providerMessage === "string" ? providerMessage : "Sin detalle del proveedor.",
      model: lastUsedModel,
      status: geminiResponse.status,
    });

    const message = geminiResponse.status === 401 || geminiResponse.status === 403
      ? "Gemini rechazó la clave de API configurada en el servidor."
      : geminiResponse.status === 404
        ? `El modelo Gemini configurado (${lastUsedModel}) no está disponible para esta clave.`
        : geminiResponse.status === 429
          ? "Gemini alcanzó el límite de cuota. Intenta de nuevo más tarde."
          : geminiResponse.status === 503
            ? "El servicio de Gemini no está disponible temporalmente. Intenta nuevamente."
            : "Gemini no pudo generar el análisis. Revisa el registro del backend para más detalle.";
    return NextResponse.json({ message }, { status: 502 });
  }

  const analysis = parseGeminiAnalysis(extractGeminiText(geminiPayload));
  if (!analysis) {
    return NextResponse.json({ message: "Gemini devolvió un análisis con formato inválido." }, { status: 502 });
  }

  const { data: saved, error: saveError } = await supabase
    .from("analisis_financieros_ia")
    .upsert(
      {
        analisis: analysis,
        empresa_id: companyId,
        periodo_clave: period,
        updated_at: new Date().toISOString(),
        usuario_id: user.id,
      },
      { onConflict: "empresa_id,periodo_clave" },
    )
    .select("updated_at")
    .single();
  if (saveError || !saved) {
    console.error("El análisis se generó, pero no pudo guardarse:", saveError?.message);
    return NextResponse.json({ analysis, generatedAt: new Date().toISOString(), period, saved: false });
  }

  return NextResponse.json({ analysis, generatedAt: saved.updated_at, period, saved: false });
}