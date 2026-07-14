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

const plans = [
  {
    badge: "Para conocer Fiscalix",
    beneficios: [
      "Acceso a una cuenta de usuario final.",
      "Registro de una empresa o actividad económica.",
      "Registro limitado de ingresos.",
      "Registro limitado de gastos.",
      "Consulta básica de historial financiero.",
      "Dashboard financiero básico.",
      "Clasificación básica de ingresos y gastos.",
      "Acceso a notificaciones generales.",
      "Acceso desde navegador web en computadora, tableta o celular.",
    ],
    descripcion:
      "Dirigido a usuarios que desean conocer la plataforma o llevar un control financiero básico de forma limitada.",
    estado: "activo",
    limitaciones: [
      "1 usuario.",
      "1 empresa o actividad económica.",
      "Hasta 30 ingresos registrados por mes.",
      "Hasta 30 gastos registrados por mes.",
      "Sin reportes avanzados.",
      "Sin exportación de información.",
      "Sin carga masiva de comprobantes.",
      "Sin soporte prioritario.",
    ],
    limite_empresas: 1,
    limite_usuarios: 1,
    nombre: "Plan Free",
    objetivo:
      "Permite probar las funciones esenciales de Fiscalix antes de contratar un plan de pago.",
    orden: 1,
    precio_anual: 0,
    precio_mensual: 0,
  },
  {
    badge: "Control fiscal básico",
    beneficios: [
      "Todo lo del Plan Free.",
      "Registro ilimitado de ingresos.",
      "Registro ilimitado de gastos y costos.",
      "Administración de una empresa o actividad económica.",
      "Dashboard financiero completo.",
      "Clasificación de ingresos, gastos y costos por categorías.",
      "Consulta de historial financiero completo.",
      "Registro y organización de comprobantes.",
      "Indicadores financieros básicos.",
      "Estimaciones fiscales informativas.",
      "Recordatorios fiscales básicos.",
      "Reportes financieros mensuales.",
      "Soporte estándar por correo electrónico.",
    ],
    descripcion:
      "Dirigido a personas físicas, profesionistas independientes, emprendedores pequeños o usuarios que necesitan organizar ingresos, gastos y comprobantes.",
    estado: "activo",
    limitaciones: [
      "1 usuario principal.",
      "1 empresa o actividad económica.",
      "Hasta 200 comprobantes o documentos registrados por mes.",
      "Exportación básica de reportes en PDF.",
      "Sin usuarios adicionales.",
      "Sin reportes comparativos avanzados.",
      "Sin integraciones bancarias avanzadas.",
    ],
    limite_empresas: 1,
    limite_usuarios: 1,
    nombre: "Plan Básico",
    objetivo:
      "Ofrece control financiero y fiscal básico para usuarios independientes o con una operación pequeña.",
    orden: 2,
    precio_anual: 1499,
    precio_mensual: 149,
  },
  {
    badge: "Más análisis y reportes",
    beneficios: [
      "Todo lo del Plan Básico.",
      "Administración de hasta 3 empresas o actividades económicas.",
      "Hasta 3 usuarios por cuenta.",
      "Roles básicos de usuario.",
      "Dashboard financiero avanzado.",
      "Reportes financieros comparativos por periodo.",
      "Reportes fiscales informativos.",
      "Exportación de reportes en PDF y Excel, cuando la función esté disponible.",
      "Carga y administración ampliada de comprobantes.",
      "Notificaciones y recordatorios fiscales personalizados.",
      "Control de ingresos, gastos y costos por empresa.",
      "Indicadores de utilidad, egresos e ingresos por periodo.",
      "Historial financiero completo.",
      "Soporte estándar con prioridad media.",
    ],
    descripcion:
      "Dirigido a pequeños negocios, comercios, emprendedores con mayor movimiento financiero o usuarios que necesitan más reportes y herramientas de análisis.",
    estado: "activo",
    limitaciones: [
      "Hasta 3 usuarios.",
      "Hasta 3 empresas o actividades económicas.",
      "Hasta 1,000 comprobantes o documentos registrados por mes.",
      "Acceso a reportes comparativos.",
      "Acceso a exportación de información.",
      "Sin personalización avanzada de módulos.",
      "Sin soporte prioritario empresarial.",
    ],
    limite_empresas: 3,
    limite_usuarios: 3,
    nombre: "Plan Plus",
    objetivo:
      "Brinda herramientas más completas para administrar más de una actividad económica y analizar mejor la operación.",
    orden: 3,
    precio_anual: 2999,
    precio_mensual: 299,
  },
  {
    badge: "Operación multiempresa",
    beneficios: [
      "Todo lo del Plan Plus.",
      "Administración de hasta 10 empresas o unidades de negocio.",
      "Hasta 10 usuarios por cuenta.",
      "Roles y permisos avanzados.",
      "Acceso para administrador, contador y usuarios operativos.",
      "Dashboard financiero y fiscal avanzado.",
      "Reportes financieros y fiscales ampliados.",
      "Reportes comparativos por empresa y por periodo.",
      "Exportación avanzada de información.",
      "Administración avanzada de comprobantes.",
      "Notificaciones fiscales y administrativas personalizadas.",
      "Preparación para integraciones con servicios externos.",
      "Acceso a métricas generales de operación.",
      "Soporte prioritario por correo electrónico o canal definido por Fiscalix.",
      "Mayor capacidad de almacenamiento documental, sujeto a la infraestructura contratada.",
    ],
    descripcion:
      "Dirigido a pequeñas empresas, despachos, comercios con mayor operación o usuarios que necesitan administrar varios usuarios, empresas, reportes e información financiera.",
    estado: "activo",
    limitaciones: [
      "Hasta 10 usuarios.",
      "Hasta 10 empresas o unidades de negocio.",
      "Hasta 5,000 comprobantes o documentos registrados por mes.",
      "Acceso a roles y permisos avanzados.",
      "Acceso a reportes avanzados.",
      "Acceso a funciones empresariales disponibles.",
    ],
    limite_empresas: 10,
    limite_usuarios: 10,
    nombre: "Plan Empresarial",
    objetivo:
      "Entrega las funciones más completas para negocios que requieren control multiempresa, múltiples usuarios y permisos diferenciados.",
    orden: 4,
    precio_anual: 5999,
    precio_mensual: 599,
  },
];

loadLocalEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

for (const plan of plans) {
  const { data: existing, error: findError } = await supabase
    .from("planes")
    .select("id")
    .eq("nombre", plan.nombre)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  const query = existing?.id
    ? supabase.from("planes").update(plan).eq("id", existing.id)
    : supabase.from("planes").insert(plan);

  const { error } = await query;
  if (error) throw new Error(`No se pudo guardar ${plan.nombre}: ${error.message}`);
}

const [{ count: planes }, { count: empresas }, { count: suscripciones }] = await Promise.all([
  supabase.from("planes").select("*", { count: "exact", head: true }),
  supabase.from("empresas").select("*", { count: "exact", head: true }),
  supabase.from("suscripciones").select("*", { count: "exact", head: true }),
]);

console.log(JSON.stringify({ empresas, planes, suscripciones }, null, 2));
