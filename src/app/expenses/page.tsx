import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type ExpenseRow = {
  id: string;
  concepto: string;
  monto: number | string;
  fecha_gasto: string;
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

function categoryLabel(expense: ExpenseRow) {
  return firstRelation(expense.categorias_financieras)?.nombre || "Sin categoría";
}

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("gastos")
    .select("id,concepto,monto,fecha_gasto,empresa_id,categoria_id,empresas(nombre_comercial),categorias_financieras(nombre,tipo)")
    .order("fecha_gasto", { ascending: false })
    .limit(50);

  const expenses = (data ?? []) as ExpenseRow[];
  const total = expenses.reduce((sum, expense) => sum + asNumber(expense.monto), 0);
  const average = expenses.length ? total / expenses.length : 0;
  const highest = expenses.reduce((max, expense) => Math.max(max, asNumber(expense.monto)), 0);
  const categories = new Set(expenses.map((expense) => expense.categoria_id || categoryLabel(expense))).size;

  return (
    <AppShell activeHref="/expenses" user={user}>
      <main className="expenses-content">
        <header className="expenses-header">
          <div>
            <p>CONTROL DE EGRESOS</p>
            <h1>Gastos</h1>
            <span>Gestiona todos los gastos registrados en tu base de datos.</span>
          </div>
          <div className="expenses-actions">
            <button type="button">Exportar <Icon name="keyboard_arrow_down" /></button>
            <button className="primary-button compact" type="button">Nuevo gasto <Icon name="add" /></button>
          </div>
        </header>

        {error && (
          <section className="expenses-alert" role="alert">
            <strong>No fue posible cargar los gastos.</strong>
            <span>Revisa la conexión con Supabase o los permisos de la tabla gastos.</span>
          </section>
        )}

        <section className="expenses-table-card">
          <div className="expenses-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Empresa</th>
                  <th>Monto</th>
                  <th>Categoría</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length ? (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.fecha_gasto)}</td>
                      <td>{expense.concepto}</td>
                      <td>{firstRelation(expense.empresas)?.nombre_comercial || "Sin empresa"}</td>
                      <td>{moneyFormatter.format(asNumber(expense.monto))}</td>
                      <td><span className="expense-category"><Icon name="category" /> {categoryLabel(expense)}</span></td>
                      <td><button className="expense-menu-button" type="button" aria-label={`Acciones de ${expense.concepto}`}>•••</button></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="expenses-empty">
                        <span><Icon name="trending_down" /></span>
                        <strong>No hay gastos registrados</strong>
                        <small>Cuando registres gastos en Supabase, aparecerán aquí automáticamente.</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="expenses-stat-grid">
          <article>
            <span><Icon name="trending_down" /></span>
            <div>
              <small>Total de gastos</small>
              <strong>{moneyFormatter.format(total)}</strong>
              <p>{expenses.length} registros</p>
            </div>
          </article>
          <article>
            <span><Icon name="calculate" /></span>
            <div>
              <small>Promedio por gasto</small>
              <strong>{moneyFormatter.format(average)}</strong>
              <p>Calculado desde la tabla gastos</p>
            </div>
          </article>
          <article>
            <span><Icon name="south" /></span>
            <div>
              <small>Gasto más alto</small>
              <strong>{moneyFormatter.format(highest)}</strong>
              <p>{highest ? "Mayor monto registrado" : "Sin registros"}</p>
            </div>
          </article>
          <article>
            <span><Icon name="category" /></span>
            <div>
              <small>Total de categorías</small>
              <strong>{categories}</strong>
              <p>{expenses.length ? "Categorías usadas" : "Sin categorías"}</p>
            </div>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
