import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type IncomeRow = {
  id: string;
  concepto: string;
  monto: number | string;
  fecha_ingreso: string;
  empresa_id: string | null;
  categoria_id: string | null;
  empresas: { nombre_comercial: string | null } | { nombre_comercial: string | null }[] | null;
  categorias_financieras: { nombre: string | null; tipo: string | null } | { nombre: string | null; tipo: string | null }[] | null;
};

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function asNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function categoryLabel(income: IncomeRow) {
  return firstRelation(income.categorias_financieras)?.nombre || "Sin categoría";
}

export default async function IncomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("ingresos")
    .select("id,concepto,monto,fecha_ingreso,empresa_id,categoria_id,empresas(nombre_comercial),categorias_financieras(nombre,tipo)")
    .order("fecha_ingreso", { ascending: false })
    .limit(50);

  const incomes = (data ?? []) as IncomeRow[];
  const total = incomes.reduce((sum, income) => sum + asNumber(income.monto), 0);
  const average = incomes.length ? total / incomes.length : 0;
  const categories = new Set(incomes.map((income) => income.categoria_id).filter(Boolean)).size;
  const uncategorized = incomes.filter((income) => !income.categoria_id).length;

  return (
    <AppShell activeHref="/income" user={user}>
      <main className="income-content">
        <header className="income-header">
          <div>
            <h1>Ingresos</h1>
            <span>Gestiona todos los ingresos registrados en tu base de datos.</span>
          </div>
          <div className="income-actions">
            <button type="button">Exportar <Icon name="keyboard_arrow_down" /></button>
            <button className="primary-button compact" type="button">Nuevo ingreso <Icon name="add" /></button>
          </div>
        </header>

        {error && (
          <section className="income-alert" role="alert">
            <strong>No fue posible cargar los ingresos.</strong>
            <span>Revisa la conexión con Supabase o los permisos de la tabla ingresos.</span>
          </section>
        )}

        <section className="income-stat-grid">
          <article>
            <span><Icon name="attach_money" /></span>
            <div>
              <small>Ingresos totales</small>
              <strong>{moneyFormatter.format(total)}</strong>
              <p>Calculado desde la tabla ingresos</p>
            </div>
          </article>
          <article>
            <span><Icon name="receipt_long" /></span>
            <div>
              <small>Total de ingresos</small>
              <strong>{incomes.length}</strong>
              <p>{incomes.length === 1 ? "registro" : "registros"}</p>
            </div>
          </article>
          <article>
            <span><Icon name="calculate" /></span>
            <div>
              <small>Promedio por ingreso</small>
              <strong>{moneyFormatter.format(average)}</strong>
              <p>{incomes.length ? "Promedio real registrado" : "Sin registros"}</p>
            </div>
          </article>
          <article>
            <span><Icon name="category" /></span>
            <div>
              <small>Categorías usadas</small>
              <strong>{categories}</strong>
              <p>{uncategorized ? `${uncategorized} sin categoría` : "Sin pendientes de categoría"}</p>
            </div>
          </article>
        </section>

        <section className="income-table-card">
          <div className="income-toolbar">
            <div className="income-tabs" aria-label="Filtros de ingresos">
              <button className="active" type="button">Todos</button>
              <button type="button">Categorizados</button>
              <button type="button">Sin categoría</button>
            </div>
            <div className="income-tools">
              <label>
                <Icon name="search" />
                <input placeholder="Buscar ingresos..." type="search" />
              </label>
              <button type="button"><Icon name="filter_list" /> Filtrar</button>
            </div>
          </div>

          <div className="income-table-scroll">
            <table className="income-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Empresa</th>
                  <th>Monto</th>
                  <th>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {incomes.length ? (
                  incomes.map((income) => (
                    <tr key={income.id}>
                      <td>{formatDate(income.fecha_ingreso)}</td>
                      <td>{income.concepto}</td>
                      <td>{firstRelation(income.empresas)?.nombre_comercial || "Sin empresa"}</td>
                      <td>{moneyFormatter.format(asNumber(income.monto))}</td>
                      <td><span className="income-category"><Icon name="trending_up" /> {categoryLabel(income)}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="income-empty">
                        <span><Icon name="trending_up" /></span>
                        <strong>No hay ingresos registrados</strong>
                        <small>Cuando registres ingresos en Supabase, aparecerán aquí automáticamente.</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
