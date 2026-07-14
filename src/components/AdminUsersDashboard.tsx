"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { type AdminDashboardUser } from "@/lib/adminUsers";
import { canManageAdminUsers, canSuspendUserAccounts } from "@/lib/roles";
import type { FiscalixUser } from "@/models/User";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function fullName(user: Pick<AdminDashboardUser, "apellido" | "nombre">) {
  return `${user.nombre} ${user.apellido ?? ""}`.trim();
}

function billingStatusClass(status: string) {
  if (status === "pago_no_acreditado") return "admin-billing-status danger";
  if (status === "pagado_exito_mes") return "admin-billing-status success";
  if (status === "revision_manual") return "admin-billing-status warning";
  return "admin-billing-status";
}

export function AdminUsersDashboard({
  currentUser,
  users,
}: {
  currentUser: FiscalixUser;
  users: AdminDashboardUser[];
}) {
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const canDelete = canManageAdminUsers(currentUser);
  const canSuspend = canSuspendUserAccounts(currentUser);
  const canShowActions = canDelete || canSuspend;

  const stats = useMemo(() => {
    const active = users.filter((user) => user.estado === "activo").length;
    const activeSubscriptions = users.filter((user) => user.subscriptionStatus === "activa").length;
    const billingAttention = users.filter((user) => user.billingStatus === "pago_no_acreditado" || user.billingStatus === "revision_manual").length;
    const clients = users.filter((user) => user.rol === "cliente_fiscalix").length;
    const paidThisMonth = users.filter((user) => user.billingStatus === "pagado_exito_mes").length;
    const suspended = users.filter((user) => user.estado === "suspendido").length;
    return { active, activeSubscriptions, billingAttention, clients, paidThisMonth, suspended, total: users.length };
  }, [users]);

  async function mutateUser(user: AdminDashboardUser, action: "activate" | "delete" | "suspend") {
    if (action === "delete" && !canDelete) return;
    if (action !== "delete" && !canSuspend) return;

    const actionLabel = action === "delete" ? "eliminar" : action === "suspend" ? "suspender" : "reactivar";
    const confirmation = action === "delete"
      ? `¿Seguro que deseas eliminar la cuenta de ${fullName(user)}? Esta acción no se puede deshacer.`
      : `¿Seguro que deseas ${actionLabel} la cuenta de ${fullName(user)}?`;

    if (!window.confirm(confirmation)) return;

    setBusyUserId(user.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        body: action === "delete" ? undefined : JSON.stringify({ action }),
        headers: action === "delete" ? undefined : { "Content-Type": "application/json" },
        method: action === "delete" ? "DELETE" : "PATCH",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "No fue posible completar la acción.");

      setMessage(result.message ?? "Acción completada.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible completar la acción.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <main className="admin-content">
      <header className="admin-header">
        <div>
          <p>CONTROL DE USUARIOS</p>
          <h1>Dashboard administrativo</h1>
          <span>
            {canDelete
              ? "Superadmin: consulta, suspende, reactiva y elimina clientes o administradores."
              : "Administrador: consulta, suspende y reactiva clientes registrados en Fiscalix."}
          </span>
        </div>
      </header>

      {message && <div className="admin-message" role="status">{message}</div>}

      <section className="admin-stat-grid">
        <article>
          <span><Icon name="manage_accounts" /></span>
          <small>Total visible</small>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span><Icon name="check_circle" /></span>
          <small>Suscripciones activas</small>
          <strong>{stats.activeSubscriptions}</strong>
        </article>
        <article>
          <span><Icon name="payments" /></span>
          <small>Pagos exitosos este mes</small>
          <strong>{stats.paidThisMonth}</strong>
        </article>
        <article>
          <span><Icon name="fact_check" /></span>
          <small>Atención facturación</small>
          <strong>{stats.billingAttention}</strong>
        </article>
      </section>

      <section className="admin-table-card">
        <div className="admin-table-heading">
          <div>
            <h2>Usuarios registrados</h2>
            <p>{stats.suspended} cuenta(s) suspendida(s) dentro del alcance de tu rol.</p>
          </div>
          <span>{canDelete ? "Acciones de superadmin habilitadas" : "Suspensión de clientes habilitada"}</span>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Empresa</th>
                <th>Plan activo</th>
                <th>Facturación</th>
                <th>Estado</th>
                <th>Registro</th>
                {canShowActions && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((user) => {
                const isSuspended = user.estado === "suspendido";
                const isBusy = busyUserId === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{fullName(user)}</strong>
                      <small>{user.correo}</small>
                    </td>
                    <td><span className="admin-role-pill">{user.rolLabel}</span></td>
                    <td>
                      <strong>{user.companyName ?? "Sin empresa"}</strong>
                      <small>{user.telefono || "Sin teléfono"}</small>
                    </td>
                    <td>
                      <strong>{user.planName ?? "Sin plan"}</strong>
                      <small>{formatMoney(user.billingAmount)} / mes</small>
                    </td>
                    <td>
                      <span className={billingStatusClass(user.billingStatus)}>{user.billingStatusLabel}</span>
                      <small>Próxima: {formatDate(user.nextBillingDate)}</small>
                    </td>
                    <td><span className={isSuspended ? "admin-status suspended" : "admin-status"}>{user.estado ?? "activo"}</span></td>
                    <td>{formatDate(user.fechaRegistro)}</td>
                    {canShowActions && (
                      <td>
                        <div className="admin-actions">
                          {canSuspend && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => mutateUser(user, isSuspended ? "activate" : "suspend")}
                            >
                              {isSuspended ? "Reactivar" : "Suspender"}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="danger"
                              type="button"
                              disabled={isBusy}
                              onClick={() => mutateUser(user, "delete")}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={canShowActions ? 8 : 7}>
                    <div className="admin-empty">
                      <span><Icon name="manage_accounts" /></span>
                      <strong>No hay usuarios para mostrar</strong>
                      <small>Cuando existan usuarios dentro del alcance de tu rol aparecerán aquí.</small>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
