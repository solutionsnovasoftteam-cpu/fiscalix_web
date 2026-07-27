"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { useModal } from "@/lib/useModal";

type IntegrationStatus = "active" | "inactive" | "pending";
type IntegrationCategory = "Almacenamiento" | "Bancos" | "Contabilidad" | "Facturación" | "Otros" | "Pagos";

type Integration = {
  autoSync: boolean;
  category: IntegrationCategory;
  databaseId?: string | null;
  description: string;
  id: string;
  lastSync: string | null;
  logo: string;
  name: string;
  status: IntegrationStatus;
  tone: string;
};

export type IntegrationRow = {
  auto_sync?: boolean | null;
  estado: string | null;
  id: string;
  nombre: string | null;
  partner: string | null;
  tipo: string | null;
  ultima_sincronizacion?: string | null;
};

type IntegrationApiResponse = {
  integration?: IntegrationRow;
  message?: string;
};

const categories = ["Todas", "Contabilidad", "Facturación", "Bancos", "Almacenamiento", "Pagos", "Otros"] as const;

const seed: Integration[] = [
  { id: "sat", name: "SAT (CFDI)", description: "Servicio de Administración Tributaria", category: "Facturación", status: "active", autoSync: true, lastSync: "2024-05-12T10:30:00", logo: "/integrations/sat.svg", tone: "#3b82f6" },
  { id: "contpaqi", name: "CONTPAQi", description: "Contabilidad empresarial", category: "Contabilidad", status: "active", autoSync: true, lastSync: "2024-05-12T09:15:00", logo: "/integrations/contpaqi.svg", tone: "#01c38d" },
  { id: "bbva", name: "BBVA México", description: "Conciliación bancaria automática", category: "Bancos", status: "active", autoSync: true, lastSync: "2024-05-12T08:00:00", logo: "/integrations/bbva.svg", tone: "#f59e0b" },
  { id: "gdrive", name: "Google Drive", description: "Respaldo de comprobantes en la nube", category: "Almacenamiento", status: "active", autoSync: false, lastSync: "2024-05-11T18:45:00", logo: "/integrations/gdrive.svg", tone: "#22c55e" },
  { id: "dropbox", name: "Dropbox", description: "Sincronización de archivos fiscales", category: "Almacenamiento", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/dropbox.svg", tone: "#6366f1" },
  { id: "s3", name: "Amazon S3", description: "Almacenamiento empresarial", category: "Almacenamiento", status: "inactive", autoSync: false, lastSync: null, logo: "/integrations/s3.svg", tone: "#f97316" },
  { id: "paypal", name: "PayPal", description: "Conciliación de cobros en línea", category: "Pagos", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/paypal.svg", tone: "#0ea5e9" },
  { id: "mailchimp", name: "Mailchimp", description: "Comunicación con clientes", category: "Otros", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/mailchimp.svg", tone: "#eab308" },
];

const catalog: Integration[] = [
  { id: "stripe", name: "Stripe", description: "Pagos en línea internacionales", category: "Pagos", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/stripe.svg", tone: "#635bff" },
  { id: "mercadopago", name: "Mercado Pago", description: "Cobros y transferencias en México", category: "Pagos", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/mercadopago.svg", tone: "#009ee3" },
  { id: "shopify", name: "Shopify", description: "Ventas y facturación de e-commerce", category: "Otros", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/shopify.svg", tone: "#96bf48" },
  { id: "slack", name: "Slack", description: "Alertas y notificaciones del equipo", category: "Otros", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/slack.svg", tone: "#4a154b" },
  { id: "quickbooks", name: "QuickBooks", description: "Contabilidad y reportes financieros", category: "Contabilidad", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/quickbooks.svg", tone: "#2ca01c" },
  { id: "facturama", name: "Facturama", description: "Timbrado y emisión de CFDI", category: "Facturación", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/facturama.svg", tone: "#0d47a1" },
  { id: "odoo", name: "Odoo", description: "ERP y operaciones empresariales", category: "Contabilidad", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/odoo.svg", tone: "#714b67" },
  { id: "whatsapp", name: "WhatsApp Business", description: "Recordatorios y avisos a clientes", category: "Otros", status: "pending", autoSync: false, lastSync: null, logo: "/integrations/whatsapp.svg", tone: "#25d366" },
];

const definitions = [...seed, ...catalog];

const syncFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatSync(value: string | null) {
  if (!value) return "Sin sincronizar";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin sincronizar" : syncFormatter.format(date);
}

function categorySlug(category: IntegrationCategory) {
  const map: Record<IntegrationCategory, string> = {
    Almacenamiento: "almacenamiento",
    Bancos: "bancos",
    Contabilidad: "contabilidad",
    Facturación: "facturacion",
    Otros: "otros",
    Pagos: "pagos",
  };
  return map[category];
}

function statusLabel(status: IntegrationStatus) {
  if (status === "active") return "Activa";
  if (status === "pending") return "Pendiente";
  return "Inactiva";
}

function normalizeStatus(value: string | null | undefined): IntegrationStatus {
  if (value === "active" || value === "activa" || value === "activo") return "active";
  if (value === "inactive" || value === "inactiva" || value === "inactivo") return "inactive";
  return "pending";
}

function normalizeCategory(value: string | null | undefined, fallback: IntegrationCategory): IntegrationCategory {
  return categories.includes(value as (typeof categories)[number]) && value !== "Todas"
    ? value as IntegrationCategory
    : fallback;
}

function integrationFromRow(row: IntegrationRow): Integration {
  const definition = definitions.find((item) => item.id === row.partner || item.name === row.nombre);
  const id = row.partner || definition?.id || row.id;

  return {
    autoSync: typeof row.auto_sync === "boolean" ? row.auto_sync : normalizeStatus(row.estado) === "active",
    category: normalizeCategory(row.tipo, definition?.category ?? "Otros"),
    databaseId: row.id,
    description: definition?.description ?? "Integración registrada en Supabase.",
    id,
    lastSync: row.ultima_sincronizacion ?? null,
    logo: definition?.logo ?? "/integrations/sat.svg",
    name: row.nombre?.trim() || definition?.name || "Integración",
    status: normalizeStatus(row.estado),
    tone: definition?.tone ?? "#01c38d",
  };
}

type IntegrationsHubProps = {
  canManage?: boolean;
  initialRows?: IntegrationRow[];
};

export function IntegrationsHub({ canManage = false, initialRows = [] }: IntegrationsHubProps) {
  const initialItems = initialRows.length ? initialRows.map(integrationFromRow) : seed;
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Todas");
  const [statusFilter, setStatusFilter] = useState<"all" | IntegrationStatus>("all");
  const [syncCount, setSyncCount] = useState(() => initialItems.filter((item) => item.status === "active").length);
  const [showNewModal, setShowNewModal] = useState(false);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeNewModal = useCallback(() => setShowNewModal(false), []);
  useModal({ dialogRef, onClose: closeNewModal, open: showNewModal });

  const availableCatalog = useMemo(
    () => catalog.filter((entry) => !items.some((item) => item.id === entry.id)),
    [items],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "Todas" && item.category !== category) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!term) return true;
      return [item.name, item.description, item.category].join(" ").toLowerCase().includes(term);
    });
  }, [category, items, query, statusFilter]);

  const stats = useMemo(() => ({
    active: items.filter((item) => item.status === "active").length,
    pending: items.filter((item) => item.status === "pending").length,
    inactive: items.filter((item) => item.status === "inactive").length,
    syncs: syncCount,
  }), [items, syncCount]);

  function notify(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3200);
  }

  function serializeIntegration(item: Integration) {
    return {
      autoSync: item.autoSync,
      category: item.category,
      databaseId: item.databaseId,
      id: item.id,
      lastSync: item.lastSync,
      name: item.name,
      partner: item.id,
      status: item.status,
    };
  }

  function mergeSavedIntegration(row: IntegrationRow | undefined, fallback: Integration) {
    if (!row) return fallback;
    const saved = integrationFromRow(row);

    return {
      ...fallback,
      ...saved,
      autoSync: typeof row.auto_sync === "boolean" ? saved.autoSync : fallback.autoSync,
      lastSync: row.ultima_sincronizacion ?? fallback.lastSync,
    };
  }

  async function persistIntegration(
    item: Integration,
    action: "activate" | "auto_sync" | "configure" | "sync",
    nextItem: Integration,
    successMessage: string,
  ) {
    if (!canManage) {
      notify("Solo administradores pueden gestionar integraciones.");
      return null;
    }

    setBusyId(item.id);
    setMessage("");

    try {
      const response = await fetch(`/api/integrations/${encodeURIComponent(item.id)}`, {
        body: JSON.stringify({
          action,
          autoSync: nextItem.autoSync,
          databaseId: item.databaseId,
          integration: serializeIntegration(nextItem),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => ({}))) as IntegrationApiResponse;

      if (!response.ok) {
        throw new Error(payload.message || "No fue posible guardar la integración.");
      }

      const saved = mergeSavedIntegration(payload.integration, nextItem);
      setItems((current) => current.map((entry) => (entry.id === item.id ? saved : entry)));
      notify(payload.message || successMessage);
      return saved;
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible guardar la integración.");
      return null;
    } finally {
      setBusyId("");
    }
  }

  async function toggleAutoSync(id: string) {
    if (!canManage) {
      notify("Solo administradores pueden gestionar integraciones.");
      return;
    }

    const item = items.find((entry) => entry.id === id);
    if (!item || item.status !== "active" || busyId) return;

    const nextItem = { ...item, autoSync: !item.autoSync };
    await persistIntegration(item, "auto_sync", nextItem, "Auto-sync actualizado.");
  }

  async function syncNow(id: string) {
    if (!canManage) {
      notify("Solo administradores pueden gestionar integraciones.");
      return;
    }

    const item = items.find((entry) => entry.id === id);
    if (!item || busyId) return;

    const now = new Date().toISOString();
    const saved = await persistIntegration(
      item,
      "sync",
      { ...item, status: "active", lastSync: now },
      "Sincronización simulada guardada.",
    );

    if (saved) setSyncCount((count) => count + 1);
  }

  async function activate(id: string) {
    if (!canManage) {
      notify("Solo administradores pueden gestionar integraciones.");
      return;
    }

    const item = items.find((entry) => entry.id === id);
    if (!item || busyId) return;

    await persistIntegration(
      item,
      "activate",
      { ...item, status: "active" },
      "Integración activada correctamente.",
    );
  }

  async function configure(id: string) {
    if (!canManage) {
      notify("Solo administradores pueden gestionar integraciones.");
      return;
    }

    const item = items.find((entry) => entry.id === id);
    if (!item || busyId) return;

    const now = new Date().toISOString();
    const saved = await persistIntegration(
      item,
      "configure",
      { ...item, status: "active", autoSync: true, lastSync: now },
      "Integración configurada correctamente.",
    );

    if (saved) setSyncCount((count) => count + 1);
  }

  async function addIntegration(entry: Integration) {
    if (!canManage) {
      notify("Solo administradores pueden gestionar integraciones.");
      return;
    }

    if (busyId) return;

    setBusyId(entry.id);
    setMessage("");

    try {
      const response = await fetch("/api/integrations", {
        body: JSON.stringify({ integration: serializeIntegration(entry) }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as IntegrationApiResponse;

      if (!response.ok) {
        throw new Error(payload.message || "No fue posible agregar la integración.");
      }

      const nextItem = mergeSavedIntegration(payload.integration, {
        ...entry,
        status: "pending",
        autoSync: false,
        lastSync: null,
      });

      setItems((current) => [...current, nextItem]);
      setShowNewModal(false);
      setCategory("Todas");
      setStatusFilter("all");
      notify(payload.message || "Integración agregada correctamente.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No fue posible agregar la integración.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="integrations-page">
      <header className="integrations-hero">
        <div className="integrations-hero-copy">
          <p>CENTRO DE CONEXIONES</p>
          <h1>Integraciones</h1>
          <span>Conecta Fiscalix con bancos, facturación, almacenamiento y más — todo desde un hub unificado.</span>
        </div>
        <div className="integrations-hero-actions">
          <label className="integrations-search">
            <Icon name="search" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar integración..."
              type="search"
              value={query}
            />
          </label>
          {canManage ? (
            <button className="integrations-new" onClick={() => setShowNewModal(true)} type="button">
              <Icon name="add" />
              Nueva integración
            </button>
          ) : null}
        </div>
      </header>

      <section className="integrations-stats" aria-label="Resumen de integraciones">
        <article className="tone-green">
          <span><Icon name="check_circle" /></span>
          <div><small>Conectadas</small><strong>{stats.active}</strong></div>
        </article>
        <article className="tone-blue">
          <span><Icon name="event_note" /></span>
          <div><small>Por configurar</small><strong>{stats.pending}</strong></div>
        </article>
        <article className="tone-violet">
          <span><Icon name="help" /></span>
          <div><small>Desconectadas</small><strong>{stats.inactive}</strong></div>
        </article>
        <article className="tone-amber">
          <span><Icon name="sync_alt" /></span>
          <div><small>Sincronizaciones hoy</small><strong>{stats.syncs}</strong></div>
        </article>
      </section>

      <section className="integrations-toolbar">
        <div className="integrations-tabs" role="tablist" aria-label="Categorías">
          {categories.map((tab) => (
            <button
              key={tab}
              aria-selected={category === tab}
              className={category === tab ? "is-active" : undefined}
              onClick={() => setCategory(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="integrations-filters">
          <button
            className={statusFilter === "all" ? "is-active" : undefined}
            onClick={() => setStatusFilter("all")}
            type="button"
          >
            Todas
          </button>
          <button
            className={statusFilter === "active" ? "is-active" : undefined}
            onClick={() => setStatusFilter("active")}
            type="button"
          >
            Activas
          </button>
          <button
            className={statusFilter === "pending" ? "is-active" : undefined}
            onClick={() => setStatusFilter("pending")}
            type="button"
          >
            Pendientes
          </button>
          <button
            className={statusFilter === "inactive" ? "is-active" : undefined}
            onClick={() => setStatusFilter("inactive")}
            type="button"
          >
            Inactivas
          </button>
        </div>
      </section>

      <section className="integrations-grid" aria-label="Lista de integraciones">
        {filtered.length ? (
          filtered.map((item) => {
            const isBusy = busyId === item.id;

            return (
            <article className={`integrations-card status-${item.status}`} key={item.id}>
              <div className="integrations-card-top">
                <span className="integrations-logo" style={{ background: `${item.tone}22` }}>
                  <Image alt="" height={46} src={item.logo} width={46} />
                </span>
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.description}</p>
                </div>
                <span className={`integrations-status ${item.status}`}>
                  <i />
                  {statusLabel(item.status)}
                </span>
              </div>

              <div className="integrations-card-meta">
                <span className={`integrations-category cat-${categorySlug(item.category)}`}>
                  {item.category}
                </span>
                <span className="integrations-sync">
                  <Icon name="history" />
                  {formatSync(item.lastSync)}
                </span>
              </div>

              <div className="integrations-card-actions">
                {canManage ? (
                  <>
                    <label className="integrations-toggle">
                      <input
                        checked={item.autoSync}
                        disabled={item.status !== "active" || isBusy}
                        onChange={() => toggleAutoSync(item.id)}
                        type="checkbox"
                      />
                      <span />
                      Auto-sync
                    </label>

                    {item.status === "active" && (
                      <button className="integrations-action primary" disabled={isBusy} onClick={() => syncNow(item.id)} type="button">
                        <Icon name="sync_alt" />
                        {isBusy ? "Guardando..." : "Sincronizar"}
                      </button>
                    )}
                    {item.status === "pending" && (
                      <button className="integrations-action" disabled={isBusy} onClick={() => configure(item.id)} type="button">
                        <Icon name="settings" />
                        {isBusy ? "Guardando..." : "Configurar"}
                      </button>
                    )}
                    {item.status === "inactive" && (
                      <button className="integrations-action" disabled={isBusy} onClick={() => activate(item.id)} type="button">
                        <Icon name="check_circle" />
                        {isBusy ? "Guardando..." : "Activar"}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="integrations-managed-note">
                    Integración administrada por Fiscalix
                  </span>
                )}
              </div>
            </article>
            );
          })
        ) : (
          <div className="integrations-empty">
            <span><Icon name="search" /></span>
            <strong>No encontramos integraciones</strong>
            <small>Prueba otra categoría o término de búsqueda.</small>
          </div>
        )}
      </section>

      <footer className="integrations-footer">
        Mostrando {filtered.length} de {items.length} integraciones
      </footer>

      {showNewModal && typeof document !== "undefined" && createPortal(
        <div
          className="integrations-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeNewModal();
          }}
          role="presentation"
        >
          <section
            aria-labelledby="integrations-new-title"
            aria-modal="true"
            className="integrations-modal"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className="integrations-modal-head">
              <div>
                <span>CATÁLOGO</span>
                <h2 id="integrations-new-title">Nueva integración</h2>
                <p>Selecciona un servicio para agregarlo a tu centro de conexiones.</p>
              </div>
              <button aria-label="Cerrar" onClick={closeNewModal} type="button">×</button>
            </header>

            {availableCatalog.length ? (
              <div className="integrations-modal-grid">
                {availableCatalog.map((entry) => (
                  <button
                    className="integrations-modal-item"
                    disabled={busyId === entry.id}
                    key={entry.id}
                    onClick={() => addIntegration(entry)}
                    type="button"
                  >
                    <span className="integrations-logo" style={{ background: `${entry.tone}22` }}>
                      <Image alt="" height={46} src={entry.logo} width={46} />
                    </span>
                    <div>
                      <strong>{entry.name}</strong>
                      <small>{entry.description}</small>
                      <em>{entry.category}</em>
                    </div>
                    {busyId === entry.id ? <Icon name="sync_alt" /> : <Icon name="add" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="integrations-modal-empty">
                <span><Icon name="check_circle" /></span>
                <strong>Todas las integraciones disponibles ya están agregadas</strong>
                <small>Puedes configurarlas desde la lista principal.</small>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
      {message && typeof document !== "undefined"
        ? createPortal(<div className="expenses-action-toast" role="status">{message}</div>, document.body)
        : null}
    </main>
  );
}
