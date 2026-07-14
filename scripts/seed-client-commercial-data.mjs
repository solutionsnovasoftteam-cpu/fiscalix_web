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

function titleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function companyNameForUser(user, index) {
  const name = titleCase(`${user.nombre ?? ""} ${user.apellido ?? ""}`.trim()) || `Cliente ${index + 1}`;
  return `${name} Servicios`;
}

const billingStates = [
  {
    estado_pago: "proxima_a_pagar",
    fecha_proxima_facturacion: 6,
    fecha_ultimo_pago: null,
    notas_facturacion: "Factura próxima a pagar. Enviar recordatorio preventivo.",
  },
  {
    estado_pago: "pago_no_acreditado",
    fecha_proxima_facturacion: -3,
    fecha_ultimo_pago: null,
    notas_facturacion: "No se acreditó su pago. Requiere seguimiento administrativo.",
  },
  {
    estado_pago: "pagado_exito_mes",
    fecha_proxima_facturacion: 25,
    fecha_ultimo_pago: -4,
    notas_facturacion: "Pago acreditado con éxito durante el mes actual.",
  },
  {
    estado_pago: "revision_manual",
    fecha_proxima_facturacion: 11,
    fecha_ultimo_pago: -18,
    notas_facturacion: "Cuenta en revisión manual por ajuste de facturación.",
  },
];

loadLocalEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: clientRelations, error: clientsError } = await supabase
  .from("usuario_rol")
  .select("usuario_id,roles(nombre),usuarios(id,nombre,apellido,correo,telefono,estado)");

if (clientsError) throw new Error(`No se pudieron consultar clientes: ${clientsError.message}`);

const clients = (clientRelations ?? [])
  .filter((row) => row.roles?.nombre === "cliente_fiscalix")
  .map((row) => row.usuarios)
  .filter(Boolean)
  .sort((a, b) => String(a.correo).localeCompare(String(b.correo)));

const { data: plans, error: plansError } = await supabase
  .from("planes")
  .select("id,nombre,precio_mensual,orden")
  .eq("estado", "activo")
  .order("orden", { ascending: true, nullsFirst: false })
  .order("precio_mensual", { ascending: true });

if (plansError) throw new Error(`No se pudieron consultar planes: ${plansError.message}`);
if (!plans?.length) throw new Error("No hay planes activos para asignar.");

const paidPlans = plans.filter((plan) => Number(plan.precio_mensual) > 0);
const assignablePlans = paidPlans.length ? paidPlans : plans;

const extendedSelect = "id,estado,estado_pago,fecha_inicio,fecha_proxima_facturacion,fecha_ultimo_pago,monto_mensual,notas_facturacion";
const { error: extendedColumnError } = await supabase.from("suscripciones").select(extendedSelect).limit(1);
const hasBillingColumns = !extendedColumnError;

const today = new Date();
const results = [];

for (const [index, user] of clients.entries()) {
  const rfc = `CLI${String(index + 1).padStart(9, "0")}`;
  const companyPayload = {
    estado: "activo",
    nombre_comercial: companyNameForUser(user, index),
    rfc,
  };

  const { data: existingCompany, error: companyFindError } = await supabase
    .from("empresas")
    .select("id,nombre_comercial,rfc")
    .eq("rfc", rfc)
    .maybeSingle();

  if (companyFindError) throw new Error(`No se pudo consultar empresa ${rfc}: ${companyFindError.message}`);

  const { data: company, error: companyError } = existingCompany
    ? await supabase.from("empresas").update(companyPayload).eq("id", existingCompany.id).select("id,nombre_comercial,rfc").single()
    : await supabase.from("empresas").insert(companyPayload).select("id,nombre_comercial,rfc").single();

  if (companyError) throw new Error(`No se pudo guardar empresa ${rfc}: ${companyError.message}`);

  const { data: existingCompanyUser, error: companyUserFindError } = await supabase
    .from("empresa_usuario")
    .select("id")
    .eq("empresa_id", company.id)
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (companyUserFindError) throw new Error(`No se pudo consultar empresa_usuario: ${companyUserFindError.message}`);

  if (!existingCompanyUser) {
    const { error } = await supabase.from("empresa_usuario").insert({
      empresa_id: company.id,
      usuario_id: user.id,
    });
    if (error) throw new Error(`No se pudo relacionar empresa con usuario: ${error.message}`);
  }

  const plan = assignablePlans[index % assignablePlans.length];
  const billingState = billingStates[index % billingStates.length];
  const subscriptionBasePayload = {
    empresa_id: company.id,
    plan_id: plan.id,
  };
  const subscriptionExtendedPayload = {
    ...subscriptionBasePayload,
    estado: "activa",
    estado_pago: billingState.estado_pago,
    fecha_inicio: addDays(today, -35 - index),
    fecha_proxima_facturacion: addDays(today, billingState.fecha_proxima_facturacion),
    fecha_ultimo_pago: billingState.fecha_ultimo_pago === null ? null : addDays(today, billingState.fecha_ultimo_pago),
    monto_mensual: Number(plan.precio_mensual),
    notas_facturacion: billingState.notas_facturacion,
  };

  const { data: existingSubscription, error: subscriptionFindError } = await supabase
    .from("suscripciones")
    .select("id")
    .eq("empresa_id", company.id)
    .maybeSingle();

  if (subscriptionFindError) throw new Error(`No se pudo consultar suscripción: ${subscriptionFindError.message}`);

  const subscriptionQuery = existingSubscription
    ? supabase.from("suscripciones").update(hasBillingColumns ? subscriptionExtendedPayload : subscriptionBasePayload).eq("id", existingSubscription.id)
    : supabase.from("suscripciones").insert(hasBillingColumns ? subscriptionExtendedPayload : subscriptionBasePayload);

  const { error: subscriptionError } = await subscriptionQuery;
  if (subscriptionError) throw new Error(`No se pudo guardar suscripción: ${subscriptionError.message}`);

  results.push({
    cliente: user.correo,
    empresa: company.nombre_comercial,
    estado_pago: hasBillingColumns ? billingState.estado_pago : "pendiente_de_migracion",
    plan: plan.nombre,
  });
}

console.log(JSON.stringify({
  clientes_procesados: results.length,
  columnas_facturacion_detectadas: hasBillingColumns,
  resultados: results,
}, null, 2));

if (!hasBillingColumns) {
  console.warn("Faltan columnas de facturación en suscripciones. Ejecuta scripts/subscriptions-billing-schema.sql y vuelve a correr este seed.");
}
