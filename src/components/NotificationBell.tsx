"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/lib/clientNotifications";

type NotificationItem = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  url: string | null;
  leida: boolean;
  created_at: string | null;
};

type NotificationsResponse = {
  notifications?: NotificationItem[];
  unreadCount?: number;
  message?: string;
};

async function requestNotifications() {
  const response = await fetch("/api/notifications", { cache: "no-store" });
  const payload = (await response.json()) as NotificationsResponse;

  if (!response.ok) {
    throw new Error(payload.message ?? "No fue posible cargar las notificaciones.");
  }

  return {
    notifications: payload.notifications ?? [],
    unreadCount: payload.unreadCount ?? 0,
  };
}

function formatNotificationDate(value: string | null) {
  if (!value) return "Ahora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ahora";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function notificationTone(type: string) {
  const normalizedType = type.toLowerCase();
  if (normalizedType.includes("warning") || normalizedType.includes("alerta")) return "warning";
  if (normalizedType.includes("success") || normalizedType.includes("exito")) return "success";
  if (normalizedType.includes("error") || normalizedType.includes("danger")) return "danger";
  return "info";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const visibleUnreadCount = useMemo(() => (unreadCount > 9 ? "9+" : String(unreadCount)), [unreadCount]);

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const payload = await requestNotifications();
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    requestNotifications()
      .then((payload) => {
        if (!isMounted) return;
        setNotifications(payload.notifications);
        setUnreadCount(payload.unreadCount);
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    function handleNotificationsUpdated() {
      requestNotifications()
        .then((payload) => {
          setNotifications(payload.notifications);
          setUnreadCount(payload.unreadCount);
          setError("");
        })
        .catch((loadError: unknown) => {
          setError(loadError instanceof Error ? loadError.message : "No fue posible cargar las notificaciones.");
        });
    }

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
  }, []);

  async function markAllAsRead() {
    if (unreadCount === 0) return;

    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((current) => current.map((notification) => ({ ...notification, leida: true })));
    setUnreadCount(0);

    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error("No fue posible marcar las notificaciones.");
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      setError("No fue posible marcar las notificaciones.");
    }
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.leida) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, leida: true } : item)),
      );
      setUnreadCount((current) => Math.max(current - 1, 0));

      try {
        const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}`, { method: "PATCH" });
        if (!response.ok) throw new Error("No fue posible marcar la notificación.");
      } catch {
        void loadNotifications();
        return;
      }
    }

    if (notification.url) {
      window.location.assign(notification.url);
      return;
    }

    setOpen(false);
  }

  return (
    <div className="notifications-wrapper" ref={wrapperRef}>
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="notifications" />
        {unreadCount > 0 ? (
          <span className="notification-dot" />
        ) : null}
      </button>
      {unreadCount > 0 ? <span className="notification-count">{visibleUnreadCount}</span> : null}

      {open ? (
        <section className="notifications-panel" aria-label="Notificaciones recientes">
          <div className="notifications-panel-head">
            <div>
              <span>Centro de avisos</span>
              <h2>Notificaciones</h2>
            </div>
            {unreadCount > 0 ? (
              <button type="button" onClick={markAllAsRead}>
                Marcar todas
              </button>
            ) : null}
          </div>

          <div className="notifications-panel-body">
            {loading ? (
              <div className="notifications-empty compact">
                <span>
                  <Icon name="notifications" />
                </span>
                <strong>Cargando avisos...</strong>
              </div>
            ) : error ? (
              <div className="notifications-empty">
                <span>!</span>
                <strong>No se pudieron cargar</strong>
                <small>{error}</small>
                <button type="button" onClick={loadNotifications}>
                  Reintentar
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">
                <span>
                  <Icon name="notifications" />
                </span>
                <strong>No tienes notificaciones</strong>
                <small>Cuando haya avisos importantes aparecerán aquí.</small>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((notification) => {
                  const tone = notificationTone(notification.tipo);

                  return (
                    <button
                      className={`notification-item ${notification.leida ? "" : "unread"} ${tone}`}
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                    >
                      <span className="notification-item-icon">
                        <Icon name={tone === "success" ? "check" : "notifications"} />
                      </span>
                      <span className="notification-item-copy">
                        <strong>{notification.titulo}</strong>
                        <small>{notification.mensaje}</small>
                      </span>
                      <time>{formatNotificationDate(notification.created_at)}</time>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
