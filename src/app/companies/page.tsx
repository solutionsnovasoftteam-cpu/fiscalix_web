import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { CompanyFiscalEditor } from "@/components/CompanyFiscalEditor";
import { FiscalRulesEditor } from "@/components/FiscalRulesEditor";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { defaultUserPreferences } from "@/lib/userPreferences.shared";

type Company = {
  id: string;
  nombre_comercial: string | null;
  rfc: string | null;
  estado: string | null;
};

type FiscalInfo = {
  activo: boolean | null;
  fecha_fin: string | null;
  fecha_inicio: string | null;
  id: string;
  empresa_id: string;
  periodicidad: string | null;
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

type FiscalRegime = {
  clave_sat: string;
  descripcion: string | null;
  id: string;
  nombre: string;
  seleccionable_nuevo: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function fallback(value: string | null | undefined, fallbackText = "Pendiente de registrar") {
  return value?.trim() || fallbackText;
}

function regimenLabel(fiscal: FiscalInfo | undefined, fallbackText = "Pendiente de registrar") {
  const regimen = firstRelation(fiscal?.regimenes_fiscales);
  if (!regimen) return fallbackText;
  return [regimen.clave_sat, regimen.nombre].filter(Boolean).join(" · ") || fallbackText;
}

function periodicityLabel(value: string | null | undefined, t: ReturnType<typeof createTranslator>, fallbackText: string) {
  switch (value) {
    case "mensual": return t("company.periodicity.mensual");
    case "bimestral": return t("company.periodicity.bimestral");
    case "trimestral": return t("company.periodicity.trimestral");
    case "semestral": return t("company.periodicity.semestral");
    case "anual": return t("company.periodicity.anual");
    default: return fallbackText;
  }
}

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const preferences = user.preferences ?? defaultUserPreferences;
  const t = createTranslator(preferences.language);

  const { data: memberships, error: membershipError } = await supabase
    .from("empresa_usuario")
    .select("empresa_id")
    .eq("usuario_id", user.id);

  const companyIds = [...new Set((memberships ?? []).map((item) => item.empresa_id).filter(Boolean))] as string[];

  const [companiesResult, fiscalResult, obligationsResult, regimesResult] = await Promise.all([
    companyIds.length
      ? supabase.from("empresas").select("id,nombre_comercial,rfc,estado").in("id", companyIds).order("nombre_comercial", { ascending: true })
      : Promise.resolve({ data: [] as Company[], error: null }),
    companyIds.length
      ? supabase.from("empresa_fiscal").select("id,empresa_id,rfc,regimen_id,fecha_inicio,fecha_fin,periodicidad,activo,regimenes_fiscales(clave_sat,nombre)").in("empresa_id", companyIds)
      : Promise.resolve({ data: [] as FiscalInfo[], error: null }),
    companyIds.length
      ? supabase.from("obligaciones_fiscales").select("id,empresa_id,nombre,periodicidad,descripcion,activa").in("empresa_id", companyIds)
      : Promise.resolve({ data: [] as TaxObligation[], error: null }),
    supabase
      .from("regimenes_fiscales")
      .select("id,clave_sat,nombre,descripcion,seleccionable_nuevo,vigencia_desde,vigencia_hasta")
      .eq("tipo_persona", "fisica")
      .eq("activo", true)
      .order("clave_sat", { ascending: true }),
  ]);

  const companies = (companiesResult.data ?? []) as Company[];
  const fiscalRecords = (fiscalResult.data ?? []) as FiscalInfo[];
  const obligations = (obligationsResult.data ?? []) as TaxObligation[];
  const regimes = (regimesResult.data ?? []) as FiscalRegime[];
  const selectedCompany = companies[0];
  const selectedFiscal = selectedCompany ? fiscalRecords.find((record) => record.empresa_id === selectedCompany.id) : undefined;
  const selectedObligations = selectedCompany ? obligations.filter((obligation) => obligation.empresa_id === selectedCompany.id) : [];
  const activeObligations = selectedObligations.filter((obligation) => obligation.activa !== false);
  const hasError = membershipError || companiesResult.error || fiscalResult.error || obligationsResult.error || regimesResult.error;

  return (
    <AppShell activeHref="/companies" user={user}>
      <main className="companies-content">
        <header className="companies-header">
          <div>
            <h1>{t("company.title")}</h1>
            <span>{t("company.description")}</span>
          </div>
          <CompanyFiscalEditor
            company={selectedCompany ? {
              address: t("profile.pendingRegister"),
              email: fallback(user.correo, t("profile.pendingRegister")),
              fiscalConfigured: Boolean(selectedFiscal?.regimen_id && selectedFiscal?.fecha_inicio),
              fiscalEndDate: selectedFiscal?.fecha_fin ?? "",
              fiscalPeriodicity: selectedFiscal?.periodicidad ?? "mensual",
              fiscalStartDate: selectedFiscal?.fecha_inicio ?? new Date().toISOString().slice(0, 10),
              id: selectedCompany.id,
              legalName: fallback(selectedCompany.nombre_comercial, t("profile.pendingRegister")),
              nombre: selectedCompany.nombre_comercial ?? "",
              phone: fallback(user.telefono, t("profile.pendingRegister")),
              regimeId: selectedFiscal?.regimen_id ?? "",
              rfc: selectedFiscal?.rfc || selectedCompany.rfc || "",
            } : null}
            key={selectedCompany ? `${selectedCompany.id}-${selectedCompany.nombre_comercial ?? ""}-${selectedFiscal?.rfc ?? selectedCompany.rfc ?? ""}-${selectedFiscal?.regimen_id ?? ""}-${selectedFiscal?.fecha_inicio ?? ""}-${selectedFiscal?.fecha_fin ?? ""}-${selectedFiscal?.periodicidad ?? ""}` : "company-editor-empty"}
            language={preferences.language}
            regimes={regimes.map((regime) => ({
              clave: regime.clave_sat,
              description: regime.descripcion ?? "",
              id: regime.id,
              nombre: regime.nombre,
              selectable: regime.seleccionable_nuevo,
              validFrom: regime.vigencia_desde ?? "",
              validUntil: regime.vigencia_hasta ?? "",
            }))}
          />
        </header>

        {hasError && (
          <section className="companies-alert" role="alert">
            <strong>{t("company.loadError")}</strong>
            <span>{t("company.loadErrorHelp")}</span>
          </section>
        )}

        <section className="companies-summary-grid">
          <article>
            <small>{t("company.company")}</small>
            <strong>{fallback(selectedCompany?.nombre_comercial, t("profile.pendingRegister"))}</strong>
          </article>
          <article>
            <small>RFC</small>
            <strong>{fallback(selectedFiscal?.rfc || selectedCompany?.rfc, t("profile.pendingRegister"))}</strong>
          </article>
          <article>
            <small>{t("profile.fiscalRegime")}</small>
            <strong>{regimenLabel(selectedFiscal, t("profile.pendingRegister"))}</strong>
          </article>
          <article>
            <small>{t("company.fiscalProfile")}</small>
            <strong>{selectedFiscal?.regimen_id && selectedFiscal.fecha_inicio ? t("company.profileConfigured") : t("company.profilePending")}</strong>
          </article>
        </section>

        {selectedCompany ? (
          <section className="company-card">
            <div className="company-card-heading">
              <h2><Icon name="corporate_fare" />{t("company.info")}</h2>
              {companies.length > 1 && <small>{t("company.linkedCompanies", { count: companies.length })}</small>}
            </div>

            <div className="company-info-grid">
              <div className="company-info-list">
                <div><span>{t("company.commercialName")}</span><strong>{fallback(selectedCompany.nombre_comercial, t("profile.pendingRegister"))}</strong></div>
                <div><span>{t("company.companyRfc")}</span><strong>{fallback(selectedCompany.rfc, t("profile.pendingRegister"))}</strong></div>
                <div><span>{t("company.fiscalRfc")}</span><strong>{fallback(selectedFiscal?.rfc, t("profile.pendingRegister"))}</strong></div>
                <div><span>{t("profile.fiscalRegime")}</span><strong>{regimenLabel(selectedFiscal, t("profile.pendingRegister"))}</strong></div>
                <div><span>{t("company.startDate")}</span><strong>{fallback(selectedFiscal?.fecha_inicio, t("profile.pendingRegister"))}</strong></div>
                <div><span>{t("company.endDate")}</span><strong>{selectedFiscal?.fecha_fin || t("company.noDateLimit")}</strong></div>
                <div><span>{t("company.periodicity")}</span><strong>{periodicityLabel(selectedFiscal?.periodicidad, t, t("profile.pendingRegister"))}</strong></div>
              </div>

              <div className="company-info-list">
                <div><span>{t("company.status")}</span><strong>{fallback(selectedCompany.estado, t("profile.pendingRegister"))}</strong></div>
                <div><span>{t("company.registeredObligations")}</span><strong>{selectedObligations.length}</strong></div>
                <div><span>{t("company.activeObligations")}</span><strong>{activeObligations.length}</strong></div>
                <div><span>{t("company.linkedToUser")}</span><strong>{companies.length}</strong></div>
              </div>
            </div>
          </section>
        ) : (
          <section className="company-card company-empty">
            <span aria-hidden="true"><Icon name="business" /></span>
            <strong>{t("company.noLinked")}</strong>
            <small>{t("company.noLinkedHelp")}</small>
          </section>
        )}

        {selectedCompany && selectedFiscal?.regimen_id && (
          <FiscalRulesEditor
            companyId={selectedCompany.id}
            regimes={regimes.map((regime) => ({
              id: regime.id,
              label: `${regime.clave_sat} · ${regime.nombre}`,
              selectable: regime.seleccionable_nuevo,
            }))}
          />
        )}

        {activeObligations.length > 0 && (
          <section className="company-card obligations-card">
            <div className="company-card-heading">
              <h2><Icon name="fact_check" />{t("company.fiscalObligations")}</h2>
            </div>
            <div className="obligations-list">
              {activeObligations.map((obligation) => (
                <article key={obligation.id}>
                  <strong>{fallback(obligation.nombre, t("profile.pendingRegister"))}</strong>
                  <span>{fallback(obligation.periodicidad, t("profile.pendingRegister"))}</span>
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
