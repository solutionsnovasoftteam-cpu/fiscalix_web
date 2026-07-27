"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

export type ReceiptDetail = {
  amount: number;
  company: string;
  concept: string;
  date: string;
  folio: string;
  id: string;
  type: "Gasto" | "Ingreso";
};

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value || "Sin fecha" : dateFormatter.format(date);
}

export function ReceiptsTableActions({ receipt }: { receipt: ReceiptDetail }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [open]);

  const modal = open ? (
    <div
      className="receipts-detail-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      role="presentation"
    >
      <section
        aria-labelledby={`receipt-detail-title-${receipt.id}`}
        aria-modal="true"
        className="receipts-detail-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <div>
            <p>Detalle del comprobante</p>
            <h2 id={`receipt-detail-title-${receipt.id}`}>{receipt.folio}</h2>
            <span>Información registrada en Fiscalix para este movimiento.</span>
          </div>
          <button aria-label="Cerrar detalle" onClick={() => setOpen(false)} type="button">
            <Icon name="close" />
          </button>
        </header>

        <div className="receipts-detail-body">
          <div className={receipt.type === "Ingreso" ? "receipts-detail-total income" : "receipts-detail-total expense"}>
            <small>Monto</small>
            <strong>{moneyFormatter.format(receipt.amount)}</strong>
            <span>{receipt.type}</span>
          </div>

          <dl className="receipts-detail-list">
            <div>
              <dt>Empresa</dt>
              <dd>{receipt.company}</dd>
            </div>
            <div>
              <dt>Concepto</dt>
              <dd>{receipt.concept}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDate(receipt.date)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd><span className="receipt-status"><i />Registrado</span></dd>
            </div>
            <div>
              <dt>Identificador interno</dt>
              <dd>{receipt.id}</dd>
            </div>
          </dl>
        </div>

        <footer>
          <button className="receipts-detail-close" onClick={() => setOpen(false)} type="button">
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  ) : null;
  const modalPortal = modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null;

  return (
    <>
      <span className="receipt-actions">
        <button aria-label={`Ver detalle de ${receipt.folio}`} className="receipt-action" onClick={() => setOpen(true)} type="button">
          <Icon name="search" />
        </button>
        <button
          aria-label={`Más opciones para ${receipt.folio}. Próximamente.`}
          className="receipt-action"
          disabled
          title="Más acciones próximamente"
          type="button"
        >
          <Icon name="more_horiz" />
        </button>
      </span>
      {modalPortal}
    </>
  );
}
