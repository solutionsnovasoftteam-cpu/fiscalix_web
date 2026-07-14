import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envFile = readFileSync(".env.local", "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    process.env[key.trim()] = rawValue;
  }
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function money(base, index, multiplier = 1) {
  return Math.round((base + (index * 137.5)) * multiplier * 100) / 100;
}

const DEMO_PREFIX = "[Demo Fiscalix]";

const incomeCategories = [
  { descripcion: "Ingresos por servicios profesionales o técnicos.", nombre: "Servicios", tipo: "ingreso" },
  { descripcion: "Ventas de productos o mercancías.", nombre: "Ventas", tipo: "ingreso" },
  { descripcion: "Consultorías, asesorías o proyectos especiales.", nombre: "Consultoría", tipo: "ingreso" },
];

const expenseCategories = [
  { descripcion: "Gastos de operación recurrentes.", nombre: "Operación", tipo: "gasto" },
  { descripcion: "Pago de renta, coworking u oficina.", nombre: "Renta", tipo: "gasto" },
  { descripcion: "Servicios administrativos, contables o profesionales.", nombre: "Servicios administrativos", tipo: "gasto" },
  { descripcion: "Materiales, papelería e insumos.", nombre: "Insumos", tipo: "gasto" },
  { descripcion: "Publicidad, diseño y adquisición de clientes.", nombre: "Marketing", tipo: "gasto" },
];

const incomeTemplates = [
  { category: "Servicios", concept: "Servicio mensual a cliente recurrente", daysAgo: 4, multiplier: 1.2 },
  { category: "Ventas", concept: "Venta de producto fiscal", daysAgo: 11, multiplier: 0.82 },
  { category: "Consultoría", concept: "Consultoría administrativa", daysAgo: 18, multiplier: 1.48 },
  { category: "Servicios", concept: "Implementación y capacitación", daysAgo: 27, multiplier: 1.05 },
];

const expenseTemplates = [
  { category: "Renta", concept: "Renta de oficina", daysAgo: 3, multiplier: 0.72 },
  { category: "Servicios administrativos", concept: "Servicios contables", daysAgo: 8, multiplier: 0.38 },
  { category: "Insumos", concept: "Papelería e insumos", daysAgo: 14, multiplier: 0.18 },
  { category: "Operación", concept: "Internet y telefonía", daysAgo: 21, multiplier: 0.23 },
  { category: "Marketing", concept: "Campaña digital", daysAgo: 29, multiplier: 0.31 },
];

loadLocalEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function ensureCategory(category) {
  const { data: existing, error: findError } = await supabase
    .from("categorias_financieras")
    .select("id,nombre,tipo")
    .eq("nombre", category.nombre)
    .eq("tipo", category.tipo)
    .maybeSingle();

  if (findError) throw new Error(`No se pudo consultar categoría ${category.nombre}: ${findError.message}`);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("categorias_financieras")
    .insert({ ...category, activo: true })
    .select("id,nombre,tipo")
    .single();

  if (error) throw new Error(`No se pudo crear categoría ${category.nombre}: ${error.message}`);
  return data;
}

const categoryRows = await Promise.all([...incomeCategories, ...expenseCategories].map(ensureCategory));
const categoriesByKey = new Map(categoryRows.map((category) => [`${category.tipo}:${category.nombre}`, category]));

const { data: companies, error: companiesError } = await supabase
  .from("empresas")
  .select("id,nombre_comercial,rfc,estado")
  .eq("estado", "activo")
  .order("nombre_comercial", { ascending: true });

if (companiesError) throw new Error(`No se pudieron consultar empresas: ${companiesError.message}`);

const today = new Date();
const summary = [];

for (const [companyIndex, company] of (companies ?? []).entries()) {
  const { count: existingDemoIncome, error: incomeCountError } = await supabase
    .from("ingresos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", company.id)
    .ilike("concepto", `${DEMO_PREFIX}%`);

  if (incomeCountError) throw new Error(`No se pudieron contar ingresos demo: ${incomeCountError.message}`);

  const { count: existingDemoExpenses, error: expenseCountError } = await supabase
    .from("gastos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", company.id)
    .ilike("concepto", `${DEMO_PREFIX}%`);

  if (expenseCountError) throw new Error(`No se pudieron contar gastos demo: ${expenseCountError.message}`);

  let insertedIncome = 0;
  let insertedExpenses = 0;
  const baseIncome = 8400 + (companyIndex * 725);
  const baseExpense = 2600 + (companyIndex * 215);

  if (!existingDemoIncome) {
    const ingresos = incomeTemplates.map((template, templateIndex) => ({
      categoria_id: categoriesByKey.get(`ingreso:${template.category}`)?.id ?? null,
      concepto: `${DEMO_PREFIX} ${template.concept}`,
      empresa_id: company.id,
      fecha_ingreso: addDays(today, -(template.daysAgo + (companyIndex % 4))),
      monto: money(baseIncome, templateIndex, template.multiplier),
    }));

    const { error } = await supabase.from("ingresos").insert(ingresos);
    if (error) throw new Error(`No se pudieron insertar ingresos de ${company.nombre_comercial}: ${error.message}`);
    insertedIncome = ingresos.length;
  }

  if (!existingDemoExpenses) {
    const gastos = expenseTemplates.map((template, templateIndex) => ({
      categoria_id: categoriesByKey.get(`gasto:${template.category}`)?.id ?? null,
      concepto: `${DEMO_PREFIX} ${template.concept}`,
      empresa_id: company.id,
      fecha_gasto: addDays(today, -(template.daysAgo + (companyIndex % 5))),
      monto: money(baseExpense, templateIndex, template.multiplier),
    }));

    const { error } = await supabase.from("gastos").insert(gastos);
    if (error) throw new Error(`No se pudieron insertar gastos de ${company.nombre_comercial}: ${error.message}`);
    insertedExpenses = gastos.length;
  }

  summary.push({
    empresa: company.nombre_comercial,
    gastos_insertados: insertedExpenses,
    ingresos_insertados: insertedIncome,
  });
}

const [{ count: ingresos }, { count: gastos }] = await Promise.all([
  supabase.from("ingresos").select("*", { count: "exact", head: true }),
  supabase.from("gastos").select("*", { count: "exact", head: true }),
]);

console.log(JSON.stringify({
  empresas_procesadas: summary.length,
  registros_totales: { gastos, ingresos },
  resumen: summary,
}, null, 2));
