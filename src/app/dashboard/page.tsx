import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { firstName } from "@/lib/utils";

const stats = [
  ["Ingresos del mes", "$0.00", "trending_up", "Sin movimientos este mes"],
  ["Gastos del mes", "$0.00", "trending_down", "Sin movimientos este mes"],
  ["Balance", "$0.00", "account_balance_wallet", "Ingresos menos gastos"],
  ["Próxima obligación", "—", "event_note", "Agrega una empresa para comenzar"],
] as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <main className="dashboard-content">
      <div className="welcome"><div><p>RESUMEN GENERAL</p><h1>Hola, {firstName(user?.nombre)} <span>👋</span></h1><span>Aquí tienes el resumen de tu actividad fiscal.</span></div><button className="primary-button compact"><Icon name="add" /> Registrar movimiento</button></div>
      <section className="stats-grid">
        {stats.map(([title, value, icon, help]) => <article className="stat-card" key={title}><div><p>{title}</p><h2>{value}</h2><small>{help}</small></div><span><Icon name={icon} /></span></article>)}
      </section>
      <section className="dashboard-grid">
        <article className="panel chart-panel"><div className="panel-heading"><div><h2>Resumen financiero</h2><p>Ingresos y gastos de los últimos 6 meses</p></div><select aria-label="Periodo"><option>Últimos 6 meses</option></select></div><div className="empty-chart"><div className="chart-lines"><i /><i /><i /><i /></div><span><Icon name="bar_chart" /></span><h3>Aún no hay información para mostrar</h3><p>Registra tus primeros movimientos para ver la gráfica.</p><button>Registrar movimiento</button></div></article>
        <article className="panel obligations"><div className="panel-heading"><div><h2>Próximas obligaciones</h2><p>Mantente al día con tus fechas</p></div><a href="#">Ver todas</a></div><div className="empty-small"><span><Icon name="check" /></span><h3>Todo en orden</h3><p>No tienes obligaciones próximas.</p></div></article>
        <article className="panel movements"><div className="panel-heading"><div><h2>Movimientos recientes</h2><p>Tu actividad más reciente</p></div><a href="/transactions">Ver todos</a></div><div className="table-head"><span>DESCRIPCIÓN</span><span>TIPO</span><span>FECHA</span><span>MONTO</span></div><div className="empty-row"><span><Icon name="sync_alt" /></span><p>No hay movimientos registrados</p></div></article>
      </section>
    </main>
  );
}
