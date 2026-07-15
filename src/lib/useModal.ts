"use client";

import { type RefObject, useEffect } from "react";

const FOCUSABLE = ["a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", '[tabindex]:not([tabindex="-1"])'].join(",");

export function useModal({ busy = false, dialogRef, onClose, open }: {
  busy?: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => (dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? dialogRef.current)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!controls.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [busy, dialogRef, onClose, open]);
}
