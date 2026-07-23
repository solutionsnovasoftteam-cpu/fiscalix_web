import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { SettingsHub, type SettingsCompany, type SettingsInitialData } from "@/app/settings/settings-hub";

type Relation<T> = T | T[] | null;

type CompanyRow = {
  id: string;
  nombre_comercial: string | null;
  rfc: string | null;
};

type FiscalRow = {
  rfc: string | null;
  regimenes_fiscales: Relation<{ clave_sat: string | null; nombre: string | null }>;
};

function firstRelation<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function fallback(value: string | null | undefined) {
  return value?.trim() || "Pendiente de registrar";
}

function formatRegime(fiscal: FiscalRow | null) {
  const regime = firstRelation(fiscal?.regimenes_fiscales);
  return [regime?.clave_sat, regime?.nombre].filter(Boolean).join(" - ") || "Pendiente de registrar";
}

async function getPrimaryCompanyId(userId: string, isAdmin: boolean) {
  const { data: memberships } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", userId)
    .limit(1);

  const membershipCompany = memberships?.[0]?.empresa_id;
  if (membershipCompany) return membershipCompany as string;

  if (!isAdmin) return null;

  const { data: company } = await supabase
    .from("empresas")
    .select("id")
    .neq("estado", "suspendida")
    .order("nombre_comercial", { ascending: true })
    .limit(1)
    .maybeSingle();

  return company?.id ?? null;
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const companyId = await getPrimaryCompanyId(user.id, canViewAdminDashboard(user));
  const [companyResult, fiscalResult] = companyId
    ? await Promise.all([
      supabase
        .from("empresas")
        .select("id,nombre_comercial,rfc")
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("empresa_fiscal")
        .select("rfc,regimenes_fiscales(clave_sat,nombre)")
        .eq("empresa_id", companyId)
        .maybeSingle(),
    ])
    : [
      { data: null as CompanyRow | null, error: null },
      { data: null as FiscalRow | null, error: null },
    ];

  const company = companyResult.data as CompanyRow | null;
  const fiscal = fiscalResult.data as FiscalRow | null;
  const initialCompany: SettingsCompany = {
    address: "Pendiente de registrar",
    commercialName: fallback(company?.nombre_comercial),
    email: fallback(user.correo),
    legalName: fallback(company?.nombre_comercial),
    phone: fallback(user.telefono),
    regime: formatRegime(fiscal),
    rfc: fallback(fiscal?.rfc || company?.rfc),
  };

  const now = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const initialData: SettingsInitialData = {
    activity: [
      {
        action: "Consulta",
        date: now,
        description: company
          ? "Información de empresa cargada desde Supabase."
          : "No hay empresa vinculada para cargar configuración empresarial.",
        id: "settings-supabase-load",
        module: "Configuraciones",
        user: `${user.nombre} ${user.apellido ?? ""}`.trim(),
      },
    ],
    company: initialCompany,
    userName: `${user.nombre} ${user.apellido ?? ""}`.trim() || "Tú",
  };

  return (
    <AppShell activeHref="/settings" user={user}>
      <SettingsHub initialData={initialData} />
    </AppShell>
  );
}
