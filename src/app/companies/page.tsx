import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  nombre_comercial: string | null;
  rfc: string | null;
  estado: string | null;
};

type FiscalInfo = {
  id: string;
  empresa_id: string;
  rfc: string | null;
  regimen_id: string | null;
  regimenes_fiscales: { clave_sat: string | null; nombre: string | null } | { clave_sat: string | null; nombre: string | null }[] | null;
};

type TaxObligation = {
  id: string;
  empresa_id: string;
  nombre: string | null;
  periodicidad: string | null;
  descripcion: string | null;
  activa: boolean | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function fallback(value: string | null | undefined) {
  return value?.trim() || "Pendiente de registrar";
}

function regimenLabel(fiscal: FiscalInfo | undefined) {
  const regimen = firstRelation(fiscal?.regimenes_fiscales);
  if (!regimen) return "Pendiente de registrar";
  return [regimen.clave_sat, regimen.nombre].filter(Boolean).join(" · ") || "Pendiente de registrar";
}

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id);

  const companyIds = [...new Set((memberships ?? []).map((item) => item.empresa_id).filter(Boolean))] as string[];

  const [companiesResult, fiscalResult, obligationsResult] = companyIds.length
    ? await Promise.all([
        supabase.from("empresas").select("id,nombre_comercial,rfc,estado").in("id", companyIds).order("nombre_comercial", { ascending: true }),
        supabase.from("empresa_fiscal").select("id,empresa_id,rfc,regimen_id,regimenes_fiscales(clave_sat,nombre)").in("empresa_id", companyIds),
        supabase.from("obligaciones_fiscales").select("id,empresa_id,nombre,periodicidad,descripcion,activa").in("empresa_id", companyIds),
      ])
    : [
        { data: [] as Company[], error: null },
        { data: [] as FiscalInfo[], error: null },
        { data: [] as TaxObligation[], error: null },
      ];

  const companies = (companiesResult.data ?? []) as Company[];
  const fiscalRecords = (fiscalResult.data ?? []) as FiscalInfo[];
  const obligations = (obligationsResult.data ?? []) as TaxObligation[];
  const selectedCompany = companies[0];
  const selectedFiscal = selectedCompany ? fiscalRecords.find((record) => record.empresa_id === selectedCompany.id) : undefined;
  const selectedObligations = selectedCompany ? obligations.filter((obligation) => obligation.empresa_id === selectedCompany.id) : [];
  const activeObligations = selectedObligations.filter((obligation) => obligation.activa !== false);
  const hasError = membershipError || companiesResult.error || fiscalResult.error || obligationsResult.error;

  return (
    <AppShell activeHref="/companies" user={user}>
      <main className="companies-content">
        <header className="companies-header">
          <div>
            <h1>Mi empresa</h1>
            <span>Información de tu empresa registrada en la base de datos.</span>
          </div>
          <button className="primary-button compact" type="button"><Icon name="edit" /> Editar información</button>
        </header>

        {hasError && (
          <section className="companies-alert" role="alert">
            <strong>No fue posible cargar toda la información de empresa.</strong>
            <span>Revisa la conexión con Supabase o los permisos de las tablas empresariales.</span>
          </section>
        )}

        <section className="companies-summary-grid">
          <article>
            <small>Empresa</small>
            <strong>{fallback(selectedCompany?.nombre_comercial)}</strong>
          </article>
          <article>
            <small>RFC</small>
            <strong>{fallback(selectedFiscal?.rfc || selectedCompany?.rfc)}</strong>
          </article>
          <article>
            <small>Régimen fiscal</small>
            <strong>{regimenLabel(selectedFiscal)}</strong>
          </article>
          <article>
            <small>Estado</small>
            <strong>{fallback(selectedCompany?.estado)}</strong>
          </article>
        </section>

        {selectedCompany ? (
          <section className="company-card">
            <div className="company-card-heading">
              <h2><Icon name="corporate_fare" />Información fiscal</h2>
              {companies.length > 1 && <small>{companies.length} empresas vinculadas</small>}
            </div>

            <div className="company-info-grid">
              <div className="company-info-list">
                <div><span>Nombre comercial</span><strong>{fallback(selectedCompany.nombre_comercial)}</strong></div>
                <div><span>RFC de empresa</span><strong>{fallback(selectedCompany.rfc)}</strong></div>
                <div><span>RFC fiscal</span><strong>{fallback(selectedFiscal?.rfc)}</strong></div>
                <div><span>Régimen fiscal</span><strong>{regimenLabel(selectedFiscal)}</strong></div>
              </div>

              <div className="company-info-list">
                <div><span>Estado</span><strong>{fallback(selectedCompany.estado)}</strong></div>
                <div><span>Obligaciones registradas</span><strong>{selectedObligations.length}</strong></div>
                <div><span>Obligaciones activas</span><strong>{activeObligations.length}</strong></div>
                <div><span>Empresas vinculadas a tu usuario</span><strong>{companies.length}</strong></div>
              </div>
            </div>
          </section>
        ) : (
          <section className="company-card company-empty">
            <span aria-hidden="true"><Icon name="business" /></span>
            <strong>No hay empresa vinculada a tu usuario</strong>
            <small>Cuando exista un registro en empresa_usuario y empresas, aparecerá aquí automáticamente.</small>
          </section>
        )}

        {activeObligations.length > 0 && (
          <section className="company-card obligations-card">
            <div className="company-card-heading">
              <h2><Icon name="fact_check" />Obligaciones fiscales</h2>
            </div>
            <div className="obligations-list">
              {activeObligations.map((obligation) => (
                <article key={obligation.id}>
                  <strong>{fallback(obligation.nombre)}</strong>
                  <span>{fallback(obligation.periodicidad)}</span>
                  {obligation.descripcion && <p>{obligation.descripcion}</p>}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
