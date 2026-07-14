export type FiscalixPlan = {
  annualAmount?: number | null;
  annualPrice: string;
  badge: string;
  companyLimit?: number | null;
  databaseId?: string;
  description: string;
  id: string;
  includes: string[];
  limits: string[];
  monthlyAmount?: number;
  monthlyPrice: string;
  name: string;
  objective: string;
  order?: number | null;
  source?: "base" | "database";
  status?: string | null;
  userLimit?: number | null;
};

export type PlanDbRow = {
  badge?: string | null;
  beneficios?: unknown;
  descripcion?: string | null;
  estado: string | null;
  id: string;
  limitaciones?: unknown;
  limite_empresas: number | null;
  limite_usuarios: number | null;
  nombre: string;
  objetivo?: string | null;
  orden?: number | null;
  precio_anual?: number | string | null;
  precio_mensual: number | string;
};

export const basicPlanSelect = "id,nombre,precio_mensual,limite_empresas,limite_usuarios,estado";

export const extendedPlanSelect = [
  "id",
  "nombre",
  "precio_mensual",
  "limite_empresas",
  "limite_usuarios",
  "estado",
  "descripcion",
  "precio_anual",
  "beneficios",
  "limitaciones",
  "badge",
  "objetivo",
  "orden",
].join(",");

export const fiscalixPlans: FiscalixPlan[] = [
  {
    annualAmount: 0,
    annualPrice: "$0.00 MXN",
    badge: "Para conocer Fiscalix",
    companyLimit: 1,
    description:
      "Dirigido a usuarios que desean conocer la plataforma o llevar un control financiero básico de forma limitada.",
    id: "free",
    includes: [
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
    limits: [
      "1 usuario.",
      "1 empresa o actividad económica.",
      "Hasta 30 ingresos registrados por mes.",
      "Hasta 30 gastos registrados por mes.",
      "Sin reportes avanzados.",
      "Sin exportación de información.",
      "Sin carga masiva de comprobantes.",
      "Sin soporte prioritario.",
    ],
    monthlyAmount: 0,
    monthlyPrice: "$0.00 MXN",
    name: "Plan Free",
    objective:
      "Permite probar las funciones esenciales de Fiscalix antes de contratar un plan de pago.",
    order: 1,
    userLimit: 1,
  },
  {
    annualAmount: 1499,
    annualPrice: "$1,499.00 MXN",
    badge: "Control fiscal básico",
    companyLimit: 1,
    description:
      "Dirigido a personas físicas, profesionistas independientes, emprendedores pequeños o usuarios que necesitan organizar ingresos, gastos y comprobantes.",
    id: "basico",
    includes: [
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
    limits: [
      "1 usuario principal.",
      "1 empresa o actividad económica.",
      "Hasta 200 comprobantes o documentos registrados por mes.",
      "Exportación básica de reportes en PDF.",
      "Sin usuarios adicionales.",
      "Sin reportes comparativos avanzados.",
      "Sin integraciones bancarias avanzadas.",
    ],
    monthlyAmount: 149,
    monthlyPrice: "$149.00 MXN",
    name: "Plan Básico",
    objective:
      "Ofrece control financiero y fiscal básico para usuarios independientes o con una operación pequeña.",
    order: 2,
    userLimit: 1,
  },
  {
    annualAmount: 2999,
    annualPrice: "$2,999.00 MXN",
    badge: "Más análisis y reportes",
    companyLimit: 3,
    description:
      "Dirigido a pequeños negocios, comercios, emprendedores con mayor movimiento financiero o usuarios que necesitan más reportes y herramientas de análisis.",
    id: "plus",
    includes: [
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
    limits: [
      "Hasta 3 usuarios.",
      "Hasta 3 empresas o actividades económicas.",
      "Hasta 1,000 comprobantes o documentos registrados por mes.",
      "Acceso a reportes comparativos.",
      "Acceso a exportación de información.",
      "Sin personalización avanzada de módulos.",
      "Sin soporte prioritario empresarial.",
    ],
    monthlyAmount: 299,
    monthlyPrice: "$299.00 MXN",
    name: "Plan Plus",
    objective:
      "Brinda herramientas más completas para administrar más de una actividad económica y analizar mejor la operación.",
    order: 3,
    userLimit: 3,
  },
  {
    annualAmount: 5999,
    annualPrice: "$5,999.00 MXN",
    badge: "Operación multiempresa",
    companyLimit: 10,
    description:
      "Dirigido a pequeñas empresas, despachos, comercios con mayor operación o usuarios que necesitan administrar varios usuarios, empresas, reportes e información financiera.",
    id: "empresarial",
    includes: [
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
    limits: [
      "Hasta 10 usuarios.",
      "Hasta 10 empresas o unidades de negocio.",
      "Hasta 5,000 comprobantes o documentos registrados por mes.",
      "Acceso a roles y permisos avanzados.",
      "Acceso a reportes avanzados.",
      "Acceso a funciones empresariales disponibles.",
    ],
    monthlyAmount: 599,
    monthlyPrice: "$599.00 MXN",
    name: "Plan Empresarial",
    objective:
      "Entrega las funciones más completas para negocios que requieren control multiempresa, múltiples usuarios y permisos diferenciados.",
    order: 4,
    userLimit: 10,
  },
];

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const defaultLimitsByPlan: Record<string, { companyLimit: number | null; userLimit: number | null }> = {
  basico: { companyLimit: 1, userLimit: 1 },
  empresarial: { companyLimit: 10, userLimit: 10 },
  free: { companyLimit: 1, userLimit: 1 },
  plus: { companyLimit: 3, userLimit: 3 },
};

function normalizePlanKey(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("empresarial")) return "empresarial";
  if (normalized.includes("basico")) return "basico";
  if (normalized.includes("plus")) return "plus";
  if (normalized.includes("free")) return "free";
  return normalized.replace(/^plan\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function asNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[$,\sA-Z]+/gi, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asOptionalNumber(value: number | string | null | undefined) {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = asNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPrice(value: number | string) {
  return `${moneyFormatter.format(asNumber(value))} MXN`;
}

function asTextArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items : fallback;
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return asTextArray(parsed, fallback);
    } catch {
      const items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (items.length) return items;
    }
  }

  return fallback;
}

function dynamicLimits(row: PlanDbRow, base: FiscalixPlan | undefined, key: string) {
  const defaults = defaultLimitsByPlan[key] ?? {
    companyLimit: row.limite_empresas,
    userLimit: row.limite_usuarios,
  };

  return [
    `Hasta ${row.limite_empresas ?? defaults.companyLimit ?? "—"} empresa(s) o actividad(es) económica(s).`,
    `Hasta ${row.limite_usuarios ?? defaults.userLimit ?? "—"} usuario(s) por cuenta.`,
    ...(base?.limits ?? []),
  ];
}

export function isMissingPlanColumnError(error: { code?: string; message?: string; details?: string } | null) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("schema cache") || text.includes("column");
}

export function planMonthlyAmount(plan: FiscalixPlan) {
  return plan.monthlyAmount ?? asNumber(plan.monthlyPrice);
}

export function mergePlansWithDbRows(rows: PlanDbRow[]): FiscalixPlan[] {
  const baseByKey = new Map(fiscalixPlans.map((plan) => [normalizePlanKey(plan.name), plan]));
  const mergedByKey = new Map<string, FiscalixPlan>();

  for (const row of rows) {
    const key = normalizePlanKey(row.nombre);
    const base = baseByKey.get(key);
    const defaults = defaultLimitsByPlan[key] ?? { companyLimit: row.limite_empresas, userLimit: row.limite_usuarios };
    const annualAmount = asOptionalNumber(row.precio_anual);

    mergedByKey.set(key, {
      ...(base ?? {
        annualPrice: "No registrado",
        badge: "Plan configurado",
        description: "Plan registrado en la tabla planes de Supabase.",
        id: key || row.id,
        includes: ["Plan disponible para asignarse a empresas desde suscripciones."],
        limits: [],
        objective: "Configuración comercial administrada desde Supabase.",
      }),
      annualAmount: annualAmount ?? base?.annualAmount ?? null,
      annualPrice: annualAmount === null ? (base?.annualPrice ?? "No registrado") : formatPrice(annualAmount),
      badge: row.badge?.trim() || base?.badge || "Plan configurado",
      companyLimit: row.limite_empresas ?? defaults.companyLimit,
      databaseId: row.id,
      description: row.descripcion?.trim() || base?.description || "Plan registrado en la tabla planes de Supabase.",
      id: base?.id ?? key ?? row.id,
      includes: asTextArray(row.beneficios, base?.includes ?? ["Plan disponible para asignarse a empresas desde suscripciones."]),
      limits: asTextArray(row.limitaciones, dynamicLimits(row, base, key)),
      monthlyAmount: asNumber(row.precio_mensual),
      monthlyPrice: formatPrice(row.precio_mensual),
      name: row.nombre,
      objective: row.objetivo?.trim() || base?.objective || "Configuración comercial administrada desde Supabase.",
      order: row.orden ?? base?.order ?? null,
      source: "database" as const,
      status: row.estado,
      userLimit: row.limite_usuarios ?? defaults.userLimit,
    });
  }

  const knownPlans = fiscalixPlans.map((base) => {
    const key = normalizePlanKey(base.name);
    const defaults = defaultLimitsByPlan[key];
    return mergedByKey.get(key) ?? {
      ...base,
      companyLimit: defaults?.companyLimit ?? null,
      monthlyAmount: asNumber(base.monthlyPrice),
      source: "base" as const,
      status: "activo",
      userLimit: defaults?.userLimit ?? null,
    };
  });

  const knownKeys = new Set(fiscalixPlans.map((plan) => normalizePlanKey(plan.name)));
  const extraPlans = Array.from(mergedByKey.entries())
    .filter(([key]) => !knownKeys.has(key))
    .map(([, plan]) => plan);

  return [...knownPlans, ...extraPlans].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}
