import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value.replace(/\\n/g, "\n");
  }
}

loadEnvFile(".env.local");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ARMADO_EMAIL = "arm@nova.com";
const DEMO_RFC = "NDF260722AB1";
const DEMO_COMPANY = {
  estado: "activo",
  nombre_comercial: "Nova Demo Fiscalix",
  rfc: DEMO_RFC,
};

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

async function ensureNoError(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function getSingle(table, queryBuilder, context) {
  const result = await queryBuilder(supabase.from(table)).maybeSingle();
  return ensureNoError(result, context);
}

async function ensureArmando() {
  const user = await getSingle(
    "usuarios",
    (table) => table.select("id,nombre,apellido,correo,estado").eq("correo", ARMADO_EMAIL),
    "Buscando usuario Armando",
  );

  if (!user) throw new Error(`No encontré el usuario ${ARMADO_EMAIL} en public.usuarios.`);

  if (user.estado !== "activo") {
    await ensureNoError(
      await supabase.from("usuarios").update({ estado: "activo" }).eq("id", user.id),
      "Activando usuario Armando",
    );
  }

  const adminRole = await getSingle(
    "roles",
    (table) => table.select("id,nombre").eq("nombre", "administrador"),
    "Buscando rol administrador",
  );

  if (adminRole) {
    const existingRole = await getSingle(
      "usuario_rol",
      (table) => table.select("id").eq("usuario_id", user.id).eq("rol_id", adminRole.id),
      "Buscando rol de Armando",
    );

    if (!existingRole) {
      await ensureNoError(
        await supabase.from("usuario_rol").insert({
          id: randomUUID(),
          rol_id: adminRole.id,
          usuario_id: user.id,
        }),
        "Asignando rol administrador a Armando",
      );
    }
  }

  return user;
}

async function ensureDemoCompany(armando) {
  let company = await getSingle(
    "empresas",
    (table) => table.select("id,nombre_comercial,rfc,estado").eq("rfc", DEMO_RFC),
    "Buscando empresa demo",
  );

  if (!company) {
    const [inserted] = await ensureNoError(
      await supabase.from("empresas").insert({
        id: randomUUID(),
        ...DEMO_COMPANY,
      }).select("id,nombre_comercial,rfc,estado"),
      "Creando empresa demo",
    );
    company = inserted;
  } else {
    const [updated] = await ensureNoError(
      await supabase
        .from("empresas")
        .update(DEMO_COMPANY)
        .eq("id", company.id)
        .select("id,nombre_comercial,rfc,estado"),
      "Actualizando empresa demo",
    );
    company = updated;
  }

  const membership = await getSingle(
    "empresa_usuario",
    (table) => table.select("id").eq("empresa_id", company.id).eq("usuario_id", armando.id),
    "Buscando membresía Armando-empresa",
  );

  if (!membership) {
    await ensureNoError(
      await supabase.from("empresa_usuario").insert({
        id: randomUUID(),
        empresa_id: company.id,
        usuario_id: armando.id,
      }),
      "Vinculando Armando con empresa demo",
    );
  }

  const regime = await getSingle(
    "regimenes_fiscales",
    (table) => table.select("id,clave_sat,nombre").eq("clave_sat", "601"),
    "Buscando régimen 601",
  ) ?? await getSingle(
    "regimenes_fiscales",
    (table) => table.select("id,clave_sat,nombre").limit(1),
    "Buscando cualquier régimen fiscal",
  );

  const fiscal = await getSingle(
    "empresa_fiscal",
    (table) => table.select("id").eq("empresa_id", company.id),
    "Buscando datos fiscales de empresa demo",
  );

  const fiscalPayload = {
    empresa_id: company.id,
    regimen_id: regime?.id ?? null,
    rfc: DEMO_RFC,
  };

  if (fiscal) {
    await ensureNoError(
      await supabase.from("empresa_fiscal").update(fiscalPayload).eq("id", fiscal.id),
      "Actualizando fiscal demo",
    );
  } else {
    await ensureNoError(
      await supabase.from("empresa_fiscal").insert({ id: randomUUID(), ...fiscalPayload }),
      "Creando fiscal demo",
    );
  }

  return company;
}

async function ensureObligations(company) {
  const obligations = [
    {
      nombre: "Declaración mensual IVA",
      periodicidad: "Mensual",
      descripcion: "Presentación y pago de IVA correspondiente al mes en curso.",
      activa: true,
    },
    {
      nombre: "Pago provisional ISR",
      periodicidad: "Mensual",
      descripcion: "Pago provisional de ISR con base en ingresos acumulados.",
      activa: true,
    },
    {
      nombre: "Retenciones de nómina",
      periodicidad: "Quincenal",
      descripcion: "Revisión de ISR retenido por salarios.",
      activa: true,
    },
    {
      nombre: "Declaración informativa DIOT",
      periodicidad: "Mensual",
      descripcion: "Información de operaciones con terceros.",
      activa: true,
    },
  ];

  for (const obligation of obligations) {
    const existing = await getSingle(
      "obligaciones_fiscales",
      (table) => table.select("id").eq("empresa_id", company.id).eq("nombre", obligation.nombre),
      `Buscando obligación ${obligation.nombre}`,
    );

    if (existing) {
      await ensureNoError(
        await supabase.from("obligaciones_fiscales").update(obligation).eq("id", existing.id),
        `Actualizando obligación ${obligation.nombre}`,
      );
    } else {
      await ensureNoError(
        await supabase.from("obligaciones_fiscales").insert({
          id: randomUUID(),
          empresa_id: company.id,
          ...obligation,
        }),
        `Creando obligación ${obligation.nombre}`,
      );
    }
  }
}

async function categoryId(tipo, fallbackName) {
  const exact = await getSingle(
    "categorias_financieras",
    (table) => table.select("id,nombre,tipo").eq("tipo", tipo).ilike("nombre", fallbackName),
    `Buscando categoría ${fallbackName}`,
  );
  if (exact) return exact.id;

  const any = await getSingle(
    "categorias_financieras",
    (table) => table.select("id,nombre,tipo").eq("tipo", tipo).limit(1),
    `Buscando cualquier categoría ${tipo}`,
  );
  return any?.id ?? null;
}

async function ensureFinancialRows(company) {
  const incomeCategory = await categoryId("ingreso", "%servicio%");
  const expenseCategory = await categoryId("gasto", "%servicio%");

  const incomes = [
    ["Demo Fiscalix · Servicio de consultoría fiscal", 48500, monthDate(0, 4)],
    ["Demo Fiscalix · Implementación contable", 72600, monthDate(0, 12)],
    ["Demo Fiscalix · Suscripción anual cliente", 38400, monthDate(-1, 16)],
    ["Demo Fiscalix · Asesoría CFDI", 21200, monthDate(-2, 9)],
    ["Demo Fiscalix · Regularización contable", 57800, monthDate(-3, 19)],
    ["Demo Fiscalix · Diagnóstico fiscal", 16900, monthDate(-4, 6)],
  ];

  const expenses = [
    ["Demo Fiscalix · Servicios contables externos", 12800, monthDate(0, 5)],
    ["Demo Fiscalix · Licencias de software", 9400, monthDate(0, 13)],
    ["Demo Fiscalix · Honorarios legales", 15800, monthDate(-1, 18)],
    ["Demo Fiscalix · Papelería y archivo", 3200, monthDate(-2, 10)],
    ["Demo Fiscalix · Infraestructura cloud", 18450, monthDate(-3, 21)],
    ["Demo Fiscalix · Capacitación fiscal", 7600, monthDate(-4, 8)],
  ];

  for (const [concepto, monto, fecha_ingreso] of incomes) {
    const existing = await getSingle(
      "ingresos",
      (table) => table.select("id").eq("empresa_id", company.id).eq("concepto", concepto),
      `Buscando ingreso ${concepto}`,
    );

    const payload = {
      categoria_id: incomeCategory,
      concepto,
      empresa_id: company.id,
      fecha_ingreso,
      monto,
    };

    if (existing) {
      await ensureNoError(await supabase.from("ingresos").update(payload).eq("id", existing.id), `Actualizando ingreso ${concepto}`);
    } else {
      await ensureNoError(await supabase.from("ingresos").insert({ id: randomUUID(), ...payload }), `Creando ingreso ${concepto}`);
    }
  }

  for (const [concepto, monto, fecha_gasto] of expenses) {
    const existing = await getSingle(
      "gastos",
      (table) => table.select("id").eq("empresa_id", company.id).eq("concepto", concepto),
      `Buscando gasto ${concepto}`,
    );

    const payload = {
      categoria_id: expenseCategory,
      concepto,
      empresa_id: company.id,
      fecha_gasto,
      monto,
    };

    if (existing) {
      await ensureNoError(await supabase.from("gastos").update(payload).eq("id", existing.id), `Actualizando gasto ${concepto}`);
    } else {
      await ensureNoError(await supabase.from("gastos").insert({ id: randomUUID(), ...payload }), `Creando gasto ${concepto}`);
    }
  }
}

async function ensureSubscription(company) {
  const plan = await getSingle(
    "planes",
    (table) => table.select("id,nombre,precio_mensual,estado,orden").eq("estado", "activo").order("orden", { ascending: false }).limit(1),
    "Buscando plan activo",
  ) ?? await getSingle(
    "planes",
    (table) => table.select("id,nombre,precio_mensual,estado,orden").order("precio_mensual", { ascending: false }).limit(1),
    "Buscando cualquier plan",
  );

  const subscription = await getSingle(
    "suscripciones",
    (table) => table.select("id").eq("empresa_id", company.id),
    "Buscando suscripción demo",
  );

  const payload = {
    empresa_id: company.id,
    estado: "activa",
    estado_pago: "proxima_a_pagar",
    fecha_inicio: monthDate(-5, 1),
    fecha_proxima_facturacion: isoDate(8),
    fecha_ultimo_pago: isoDate(-22),
    monto_mensual: plan?.precio_mensual ?? 0,
    notas_facturacion: "Cuenta demo vinculada al administrador Armando para validar paneles.",
    plan_id: plan?.id ?? null,
  };

  if (subscription) {
    await ensureNoError(await supabase.from("suscripciones").update(payload).eq("id", subscription.id), "Actualizando suscripción demo");
  } else {
    await ensureNoError(await supabase.from("suscripciones").insert({ id: randomUUID(), ...payload }), "Creando suscripción demo");
  }
}

async function ensureIntegrations() {
  const integrations = [
    { nombre: "SAT (CFDI)", tipo: "Facturación", estado: "active", partner: "sat" },
    { nombre: "CONTPAQi", tipo: "Contabilidad", estado: "active", partner: "contpaqi" },
    { nombre: "BBVA México", tipo: "Bancos", estado: "active", partner: "bbva" },
    { nombre: "Google Drive", tipo: "Almacenamiento", estado: "active", partner: "gdrive" },
    { nombre: "PayPal", tipo: "Pagos", estado: "pending", partner: "paypal" },
    { nombre: "Mailchimp", tipo: "Otros", estado: "pending", partner: "mailchimp" },
    { nombre: "Amazon S3", tipo: "Almacenamiento", estado: "inactive", partner: "s3" },
  ];

  for (const integration of integrations) {
    const existing = await getSingle(
      "integraciones",
      (table) => table.select("id").eq("partner", integration.partner),
      `Buscando integración ${integration.partner}`,
    );

    if (existing) {
      await ensureNoError(await supabase.from("integraciones").update(integration).eq("id", existing.id), `Actualizando integración ${integration.partner}`);
    } else {
      await ensureNoError(await supabase.from("integraciones").insert({ id: randomUUID(), ...integration }), `Creando integración ${integration.partner}`);
    }
  }
}

function isMissingTableError(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return text.includes("pgrst205") || text.includes("schema cache");
}

async function ensurePayrollIfTablesExist(company) {
  const employeeProbe = await supabase.from("empleados_nomina").select("*").limit(1);
  const payrollProbe = await supabase.from("nominas").select("*").limit(1);

  if (isMissingTableError(employeeProbe.error) || isMissingTableError(payrollProbe.error)) {
    console.log("PAYROLL_SKIPPED missing empleados_nomina/nominas tables");
    return;
  }
  if (employeeProbe.error) throw new Error(`Validando tabla empleados_nomina: ${employeeProbe.error.message}`);
  if (payrollProbe.error) throw new Error(`Validando tabla nominas: ${payrollProbe.error.message}`);

  const employees = [
    ["Ana Torres", "Gerente RH", "Recursos Humanos", 32000, "activo"],
    ["Luis Pérez", "Contador", "Finanzas", 28500, "activo"],
    ["María González", "Diseñadora", "Marketing", 25000, "activo"],
    ["Carlos Ruiz", "Desarrollador", "TI", 35000, "activo"],
    ["Elena Vargas", "Asistente Admin", "Operaciones", 18500, "activo"],
    ["Roberto Díaz", "Analista", "Finanzas", 22000, "activo"],
  ];

  for (const [nombre, puesto, departamento, sueldo_mensual, estado] of employees) {
    const existing = await getSingle(
      "empleados_nomina",
      (table) => table.select("id").eq("empresa_id", company.id).eq("nombre", nombre),
      `Buscando empleado ${nombre}`,
    );

    const payload = {
      departamento,
      empresa_id: company.id,
      estado,
      nombre,
      puesto,
      sueldo_mensual,
    };

    if (existing) {
      await ensureNoError(await supabase.from("empleados_nomina").update(payload).eq("id", existing.id), `Actualizando empleado ${nombre}`);
    } else {
      await ensureNoError(await supabase.from("empleados_nomina").insert({ id: randomUUID(), ...payload }), `Creando empleado ${nombre}`);
    }
  }

  const payrollRuns = [
    {
      deducciones: 43200,
      empleados: employees.length,
      estado: "pagado",
      fecha_pago: isoDate(-7),
      folio: "NOM-DEMO-2026-07-1",
      percepciones: 193200,
      periodo: "01 – 15 Jul 2026",
      total_pagado: 150000,
    },
    {
      deducciones: 44800,
      empleados: employees.length,
      estado: "borrador",
      fecha_pago: isoDate(8),
      folio: "NOM-DEMO-2026-07-2",
      percepciones: 194800,
      periodo: "16 – 31 Jul 2026",
      total_pagado: 150000,
    },
  ];

  for (const run of payrollRuns) {
    const existing = await getSingle(
      "nominas",
      (table) => table.select("id").eq("empresa_id", company.id).eq("folio", run.folio),
      `Buscando nómina ${run.folio}`,
    );

    const payload = {
      descargado: false,
      empresa_id: company.id,
      ...run,
    };

    if (existing) {
      await ensureNoError(await supabase.from("nominas").update(payload).eq("id", existing.id), `Actualizando nómina ${run.folio}`);
    } else {
      await ensureNoError(await supabase.from("nominas").insert({ id: randomUUID(), ...payload }), `Creando nómina ${run.folio}`);
    }
  }
}

const armando = await ensureArmando();
const company = await ensureDemoCompany(armando);
await ensureObligations(company);
await ensureFinancialRows(company);
await ensureSubscription(company);
await ensureIntegrations();
await ensurePayrollIfTablesExist(company);

console.log(JSON.stringify({
  company: company.nombre_comercial,
  companyId: company.id,
  status: "seed_completed",
  user: ARMADO_EMAIL,
}, null, 2));
