import "server-only";

import { NextResponse } from "next/server";

export type FiscalApiErrorCode =
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "DATABASE_ERROR";

export type FiscalRegimeContract = {
  id: string;
  satCode: string;
  name: string;
  description: string | null;
  personType: "fisica";
  selectableForNewProfiles: boolean;
  validFrom: string | null;
  validUntil: string | null;
};

export type FiscalProfileContract = {
  id: string;
  companyId: string;
  userId: string;
  regimeId: string;
  personType: "fisica";
  startDate: string;
  endDate: string | null;
  periodicity: string | null;
  active: boolean;
  updatedAt: string | null;
  regime: FiscalRegimeContract;
};

export const FISCAL_PERIODICITIES = [
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
] as const;

export function fiscalSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fiscalFailure(
  code: FiscalApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function cleanOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned || null;
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
