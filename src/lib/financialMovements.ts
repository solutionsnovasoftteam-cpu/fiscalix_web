export type MovementKind = "expense" | "income";

export const INCOME_MOVEMENT_STATUSES = ["cobrado", "pendiente", "cancelado"] as const;
export const EXPENSE_MOVEMENT_STATUSES = ["pagado", "pendiente", "cancelado"] as const;
export const MOVEMENT_TAX_RATE_DEFAULT = 0.16;

export type IncomeMovementStatus = (typeof INCOME_MOVEMENT_STATUSES)[number];
export type ExpenseMovementStatus = (typeof EXPENSE_MOVEMENT_STATUSES)[number];
export type FinancialMovementStatus = IncomeMovementStatus | ExpenseMovementStatus;

type DbErrorLike = {
  code?: string;
  details?: string;
  message?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function normalizeMovementStatus(value: unknown, kind: "income"): IncomeMovementStatus | null;
export function normalizeMovementStatus(value: unknown, kind: "expense"): ExpenseMovementStatus | null;
export function normalizeMovementStatus(value: unknown, kind: MovementKind): FinancialMovementStatus | null {
  const cleaned = cleanText(value);
  if (!cleaned) return kind === "income" ? "cobrado" : "pagado";
  if (kind === "income") return isOneOf(cleaned, INCOME_MOVEMENT_STATUSES) ? cleaned : null;
  return isOneOf(cleaned, EXPENSE_MOVEMENT_STATUSES) ? cleaned : null;
}

export function isFiscalActiveStatus(value: string | null | undefined) {
  return value !== "cancelado";
}

export function normalizeTaxRate(value: unknown, fallback = MOVEMENT_TAX_RATE_DEFAULT) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;

  const rate = parsed > 1 ? parsed / 100 : parsed;
  if (rate < 0 || rate > 1) return null;
  return rate;
}

export function normalizeMoney(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

export function taxAmountFromRate(base: number, rate: number) {
  return Math.round(base * rate * 100) / 100;
}

export function booleanFromFormValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "on", "true", "yes", "si", "sí"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function isMissingMovementNormalizationColumn(error: DbErrorLike | null | undefined) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    text.includes("pgrst204") ||
    text.includes("schema cache") ||
    text.includes("estado") ||
    text.includes("deducible") ||
    text.includes("base_fiscal") ||
    text.includes("iva_tasa") ||
    text.includes("iva_monto") ||
    text.includes("isr_retenido_monto")
  );
}

export function isRowInAccessibleCompanyScope(
  row: { empresa_id?: string | null },
  accessibleCompanyIds: ReadonlySet<string>,
) {
  if (!row.empresa_id) return true;
  return accessibleCompanyIds.has(row.empresa_id);
}
