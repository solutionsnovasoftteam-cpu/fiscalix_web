import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TARGET_EMAIL = process.argv[2] ?? process.env.FISCALIX_DEMO_USER_EMAIL ?? "juan@lasc.com";
const TARGET_COMPANY_RFC = "LASC900101JLA";
const TARGET_COMPANY_NAME = "Juan Lascurain Servicios";

function loadEnvFile(path) {
  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value.replace(/\\n/g, "\n");
  }
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function monthDate(monthOffset, day) {
  const date = new Date();
  date.setMonth(date.getMonth() + monthOffset, day);
  return date.toISOString().slice(0, 10);
}

function isMissingSchemaError(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("pgrst205") ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("42p01")
  );
}

function isMissingColumnError(error, columnName) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("42703") || text.includes(columnName.toLowerCase());
}

async function ensureNoError(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function getSingle(table, queryBuilder, context) {
  const result = await queryBuilder(supabase.from(table)).maybeSingle();
  return ensureNoError(result, context);
}

async function tableExists(table) {
  const result = await supabase.from(table).select("*").limit(1);
  if (!result.error) return true;
  if (isMissingSchemaError(result.error)) return false;
  throw new Error(`Validando tabla ${table}: ${result.error.message}`);
}

async function insertOrUpdate(table, existing, payload, context) {
  if (existing) {
    return ensureNoError(await supabase.from(table).update(payload).eq("id", existing.id).select("*"), `Actualizando ${context}`);
  }

  return ensureNoError(await supabase.from(table).insert({ id: randomUUID(), ...payload }).select("*"), `Creando ${context}`);
}

async function ensureRole(user) {
  const role = await getSingle(
    "roles",
    (table) => table.select("id,nombre").eq("nombre", "cliente_fiscalix"),
    "Buscando rol cliente_fiscalix",
  );

  if (!role) {
    console.warn("ROLE_SKIPPED no existe el rol cliente_fiscalix");
    return;
  }

  const existing = await getSingle(
    "usuario_rol",
    (table) => table.select("id").eq("usuario_id", user.id).eq("rol_id", role.id),
    "Buscando rol del usuario",
  );

  if (!existing) {
    await ensureNoError(
      await supabase.from("usuario_rol").insert({
        id: randomUUID(),
        rol_id: role.id,
        usuario_id: user.id,
      }),
      "Asignando rol cliente_fiscalix",
    );
  }
}

async function ensureCompany(user) {
  const linkedCompany = await getSingle(
    "empresa_usuario",
    (table) => table.select("empresas(id,nombre_comercial,rfc,estado)").eq("usuario_id", user.id).limit(1),
    "Buscando empresa ligada al usuario",
  );

  let company = Array.isArray(linkedCompany?.empresas) ? linkedCompany.empresas[0] : linkedCompany?.empresas;

  if (!company) {
    company = await getSingle(
      "empresas",
      (table) => table.select("id,nombre_comercial,rfc,estado").eq("rfc", TARGET_COMPANY_RFC),
      "Buscando empresa de Juan por RFC",
    );
  }

  const companyPayload = {
    estado: "activo",
    nombre_comercial: company?.nombre_comercial || TARGET_COMPANY_NAME,
    rfc: company?.rfc || TARGET_COMPANY_RFC,
  };

  const [savedCompany] = await insertOrUpdate("empresas", company, companyPayload, "empresa de Juan");

  const membership = await getSingle(
    "empresa_usuario",
    (table) => table.select("id").eq("empresa_id", savedCompany.id).eq("usuario_id", user.id),
    "Buscando relación usuario-empresa",
  );

  if (!membership) {
    await ensureNoError(
      await supabase.from("empresa_usuario").insert({
        id: randomUUID(),
        empresa_id: savedCompany.id,
        usuario_id: user.id,
      }),
      "Relacionando usuario con empresa",
    );
  }

  return savedCompany;
}

async function ensureFiscalData(company) {
  if (!(await tableExists("empresa_fiscal"))) {
    console.warn("FISCAL_SKIPPED no existe empresa_fiscal");
    return;
  }

  const regime =
    (await getSingle(
      "regimenes_fiscales",
      (table) => table.select("id,clave_sat,nombre").eq("clave_sat", "612"),
      "Buscando régimen 612",
    )) ??
    (await getSingle(
      "regimenes_fiscales",
      (table) => table.select("id,clave_sat,nombre").eq("clave_sat", "601"),
      "Buscando régimen 601",
    )) ??
    (await getSingle(
      "regimenes_fiscales",
      (table) => table.select("id,clave_sat,nombre").limit(1),
      "Buscando cualquier régimen fiscal",
    ));

  const existing = await getSingle(
    "empresa_fiscal",
    (table) => table.select("id").eq("empresa_id", company.id),
    "Buscando datos fiscales de la empresa",
  );

  await insertOrUpdate(
    "empresa_fiscal",
    existing,
    {
      empresa_id: company.id,
      regimen_id: regime?.id ?? null,
      rfc: company.rfc || TARGET_COMPANY_RFC,
    },
    "datos fiscales de Juan",
  );
}

async function ensureObligations(company) {
  if (!(await tableExists("obligaciones_fiscales"))) {
    console.warn("OBLIGATIONS_SKIPPED no existe obligaciones_fiscales");
    return;
  }

  const obligations = [
    {
      activa: true,
      descripcion: "Declaración y pago de IVA del periodo mensual.",
      nombre: "Declaración mensual IVA",
      periodicidad: "Mensual",
    },
    {
      activa: true,
      descripcion: "Pago provisional de ISR correspondiente al mes en curso.",
      nombre: "Pago provisional ISR",
      periodicidad: "Mensual",
    },
    {
      activa: true,
      descripcion: "Revisión de facturación y conciliación del periodo.",
      nombre: "Revisión de facturación",
      periodicidad: "Mensual",
    },
  ];

  for (const obligation of obligations) {
    const existing = await getSingle(
      "obligaciones_fiscales",
      (table) => table.select("id").eq("empresa_id", company.id).eq("nombre", obligation.nombre),
      `Buscando obligación ${obligation.nombre}`,
    );

    await insertOrUpdate(
      "obligaciones_fiscales",
      existing,
      { empresa_id: company.id, ...obligation },
      `obligación ${obligation.nombre}`,
    );
  }
}

async function ensureCategory(category) {
  const existing = await getSingle(
    "categorias_financieras",
    (table) => table.select("id,nombre,tipo").eq("nombre", category.nombre).eq("tipo", category.tipo),
    `Buscando categoría ${category.nombre}`,
  );

  if (existing) return existing;

  const payload = { ...category, activo: true };
  const result = await supabase.from("categorias_financieras").insert({ id: randomUUID(), ...payload }).select("id,nombre,tipo").single();

  if (isMissingColumnError(result.error, "activo")) {
    return ensureNoError(
      await supabase.from("categorias_financieras").insert({ id: randomUUID(), ...category }).select("id,nombre,tipo").single(),
      `Creando categoría ${category.nombre}`,
    );
  }

  return ensureNoError(result, `Creando categoría ${category.nombre}`);
}

async function ensureFinancialRows(user, company) {
  const categories = await Promise.all([
    ensureCategory({ descripcion: "Ingresos por servicios profesionales.", nombre: "Servicios", tipo: "ingreso" }),
    ensureCategory({ descripcion: "Consultoría y asesoría especializada.", nombre: "Consultoría", tipo: "ingreso" }),
    ensureCategory({ descripcion: "Gastos por renta y espacios de trabajo.", nombre: "Renta", tipo: "gasto" }),
    ensureCategory({ descripcion: "Servicios administrativos y contables.", nombre: "Servicios administrativos", tipo: "gasto" }),
    ensureCategory({ descripcion: "Materiales y suministros de operación.", nombre: "Insumos", tipo: "gasto" }),
  ]);

  const categoryByKey = new Map(categories.map((category) => [`${category.tipo}:${category.nombre}`, category.id]));

  const incomes = [
    ["Servicio mensual de asesoría fiscal", 18500, monthDate(0, 6), "Servicios"],
    ["Consultoría administrativa", 24600, monthDate(0, 14), "Consultoría"],
    ["Proyecto de regularización contable", 32900, monthDate(-1, 18), "Consultoría"],
    ["Servicio de seguimiento fiscal", 16400, monthDate(-2, 10), "Servicios"],
    ["Implementación de control documental", 27800, monthDate(-3, 20), "Servicios"],
  ];

  const expenses = [
    ["Renta de oficina", 7200, monthDate(0, 7), "Renta"],
    ["Servicios contables externos", 5400, monthDate(0, 15), "Servicios administrativos"],
    ["Papelería e insumos", 1850, monthDate(-1, 12), "Insumos"],
    ["Internet y telefonía", 2100, monthDate(-2, 8), "Servicios administrativos"],
    ["Archivo y mensajería", 1650, monthDate(-3, 22), "Servicios administrativos"],
  ];

  for (const [concepto, monto, fechaIngreso, categoryName] of incomes) {
    const existing = await getSingle(
      "ingresos",
      (table) => table.select("id").eq("empresa_id", company.id).eq("concepto", concepto),
      `Buscando ingreso ${concepto}`,
    );

    const payload = {
      categoria_id: categoryByKey.get(`ingreso:${categoryName}`) ?? null,
      concepto,
      empresa_id: company.id,
      fecha_ingreso: fechaIngreso,
      monto,
      usuario_id: user.id,
    };

    const result = existing
      ? await supabase.from("ingresos").update(payload).eq("id", existing.id)
      : await supabase.from("ingresos").insert({ id: randomUUID(), ...payload });

    if (isMissingColumnError(result.error, "usuario_id")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.usuario_id;
      await ensureNoError(
        existing
          ? await supabase.from("ingresos").update(fallbackPayload).eq("id", existing.id)
          : await supabase.from("ingresos").insert({ id: randomUUID(), ...fallbackPayload }),
        `Guardando ingreso ${concepto}`,
      );
    } else {
      await ensureNoError(result, `Guardando ingreso ${concepto}`);
    }
  }

  for (const [concepto, monto, fechaGasto, categoryName] of expenses) {
    const existing = await getSingle(
      "gastos",
      (table) => table.select("id").eq("empresa_id", company.id).eq("concepto", concepto),
      `Buscando gasto ${concepto}`,
    );

    const payload = {
      categoria_id: categoryByKey.get(`gasto:${categoryName}`) ?? null,
      concepto,
      empresa_id: company.id,
      fecha_gasto: fechaGasto,
      monto,
      usuario_id: user.id,
    };

    const result = existing
      ? await supabase.from("gastos").update(payload).eq("id", existing.id)
      : await supabase.from("gastos").insert({ id: randomUUID(), ...payload });

    if (isMissingColumnError(result.error, "usuario_id")) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.usuario_id;
      await ensureNoError(
        existing
          ? await supabase.from("gastos").update(fallbackPayload).eq("id", existing.id)
          : await supabase.from("gastos").insert({ id: randomUUID(), ...fallbackPayload }),
        `Guardando gasto ${concepto}`,
      );
    } else {
      await ensureNoError(result, `Guardando gasto ${concepto}`);
    }
  }
}

async function ensureSubscription(company) {
  if (!(await tableExists("suscripciones"))) {
    console.warn("SUBSCRIPTION_SKIPPED no existe suscripciones");
    return null;
  }

  const plan =
    (await getSingle(
      "planes",
      (table) => table.select("id,nombre,precio_mensual,estado,orden").eq("estado", "activo").ilike("nombre", "%plus%").limit(1),
      "Buscando plan Plus",
    )) ??
    (await getSingle(
      "planes",
      (table) => table.select("id,nombre,precio_mensual,estado,orden").eq("estado", "activo").order("orden", { ascending: false }).limit(1),
      "Buscando plan activo",
    ));

  const existing = await getSingle(
    "suscripciones",
    (table) => table.select("id").eq("empresa_id", company.id),
    "Buscando suscripción de Juan",
  );

  const payload = {
    empresa_id: company.id,
    estado: "activa",
    estado_pago: "pagado_exito_mes",
    fecha_inicio: monthDate(-4, 1),
    fecha_proxima_facturacion: isoDate(14),
    fecha_ultimo_pago: isoDate(-16),
    monto_mensual: plan?.precio_mensual ?? 0,
    notas_facturacion: "Pago acreditado con éxito durante el mes actual.",
    plan_id: plan?.id ?? null,
  };

  const result = existing
    ? await supabase.from("suscripciones").update(payload).eq("id", existing.id)
    : await supabase.from("suscripciones").insert({ id: randomUUID(), ...payload });

  if (result.error && (isMissingColumnError(result.error, "estado_pago") || isMissingColumnError(result.error, "monto_mensual"))) {
    const basicPayload = {
      empresa_id: company.id,
      plan_id: plan?.id ?? null,
    };

    await ensureNoError(
      existing
        ? await supabase.from("suscripciones").update(basicPayload).eq("id", existing.id)
        : await supabase.from("suscripciones").insert({ id: randomUUID(), ...basicPayload }),
      "Guardando suscripción básica de Juan",
    );
  } else {
    await ensureNoError(result, "Guardando suscripción de Juan");
  }

  return plan;
}

async function ensurePayroll(company) {
  if (!(await tableExists("empleados_nomina")) || !(await tableExists("nominas"))) {
    console.warn("PAYROLL_SKIPPED no existen empleados_nomina/nominas");
    return { employees: 0, payrolls: 0 };
  }

  const employees = [
    ["Laura Méndez", "Coordinadora administrativa", "Administración", 24500, "activo"],
    ["Oscar Núñez", "Analista contable", "Finanzas", 21800, "activo"],
    ["Mónica Rivas", "Ejecutiva de cuenta", "Comercial", 19600, "activo"],
    ["Diego Salas", "Auxiliar operativo", "Operaciones", 17200, "activo"],
  ];

  for (const [nombre, puesto, departamento, sueldoMensual, estado] of employees) {
    const existing = await getSingle(
      "empleados_nomina",
      (table) => table.select("id").eq("empresa_id", company.id).eq("nombre", nombre),
      `Buscando empleado ${nombre}`,
    );

    await insertOrUpdate(
      "empleados_nomina",
      existing,
      {
        departamento,
        empresa_id: company.id,
        estado,
        nombre,
        puesto,
        sueldo_mensual: sueldoMensual,
      },
      `empleado ${nombre}`,
    );
  }

  const totalSalaries = employees.reduce((sum, employee) => sum + Number(employee[3]), 0);
  const payrolls = [
    {
      deducciones: 18750,
      descargado: false,
      empleados: employees.length,
      estado: "pagado",
      fecha_pago: isoDate(-9),
      folio: "NOM-JL-2026-07-1",
      percepciones: totalSalaries / 2,
      periodo: "01 – 15 Jul 2026",
      total_pagado: totalSalaries / 2 - 18750,
    },
    {
      deducciones: 18940,
      descargado: false,
      empleados: employees.length,
      estado: "borrador",
      fecha_pago: isoDate(7),
      folio: "NOM-JL-2026-07-2",
      percepciones: totalSalaries / 2,
      periodo: "16 – 31 Jul 2026",
      total_pagado: totalSalaries / 2 - 18940,
    },
  ];

  for (const payroll of payrolls) {
    const existing = await getSingle(
      "nominas",
      (table) => table.select("id").eq("empresa_id", company.id).eq("folio", payroll.folio),
      `Buscando nómina ${payroll.folio}`,
    );

    await insertOrUpdate("nominas", existing, { empresa_id: company.id, ...payroll }, `nómina ${payroll.folio}`);
  }

  return { employees: employees.length, payrolls: payrolls.length };
}

loadEnvFile(".env.local");

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const user = await getSingle(
  "usuarios",
  (table) => table.select("id,nombre,apellido,correo,telefono,estado").eq("correo", TARGET_EMAIL),
  `Buscando usuario ${TARGET_EMAIL}`,
);

if (!user) throw new Error(`No encontré el usuario ${TARGET_EMAIL} en public.usuarios.`);

if (user.estado !== "activo") {
  await ensureNoError(await supabase.from("usuarios").update({ estado: "activo" }).eq("id", user.id), "Activando usuario");
}

await ensureRole(user);
const company = await ensureCompany(user);
await ensureFiscalData(company);
await ensureObligations(company);
await ensureFinancialRows(user, company);
const plan = await ensureSubscription(company);
const payroll = await ensurePayroll(company);

console.log(JSON.stringify({
  empresa: company.nombre_comercial,
  empresa_id: company.id,
  gastos: 5,
  ingresos: 5,
  nomina: payroll,
  plan: plan?.nombre ?? "Sin plan detectado",
  status: "seed_completed",
  usuario: TARGET_EMAIL,
}, null, 2));
