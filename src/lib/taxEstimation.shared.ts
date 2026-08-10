export const TAX_ESTIMATION_PRIORITY_REGIME = {
  key: "RESICO_PERSONA_FISICA",
  name: "Régimen Simplificado de Confianza",
  satCode: "626",
} as const;

export const RESICO_MONTHLY_ISR_RATES = [
  { maxIncome: 25000, rate: 0.01 },
  { maxIncome: 50000, rate: 0.011 },
  { maxIncome: 83333.33, rate: 0.015 },
  { maxIncome: 208333.33, rate: 0.02 },
  { maxIncome: 3500000, rate: 0.025 },
] as const;

export type TaxEstimationWarningCode =
  | "MISSING_FISCAL_PROFILE"
  | "INACTIVE_FISCAL_PROFILE"
  | "UNSUPPORTED_REGIME"
  | "RESICO_LIMIT_EXCEEDED";

export type TaxEstimationPeriod = {
  end: string;
  key: string;
  label: string;
  month: number;
  start: string;
  year: number;
};

export type TaxEstimationFiscalProfile = {
  active: boolean;
  regimeName: string | null;
  satCode: string | null;
};

export type TaxEstimationCompany = {
  id: string;
  name: string;
};

export type TaxEstimationMovement = {
  amount: number | string | null;
  companyId: string | null;
  date: string | null;
  deductible: boolean | null;
  fiscalActive: boolean | null;
  fiscalBase: number | string | null;
  isrWithheld: number | string | null;
  status: string | null;
  type: "ingreso" | "gasto" | string;
  vatAmount: number | string | null;
};

export type TaxEstimationCompanyResult = {
  base: number;
  companyId: string;
  companyName: string;
  deductibleExpenses: number;
  estimationAvailable: boolean;
  excludedMovementCount: number;
  expenseCount: number;
  expenses: number;
  incomeCount: number;
  incomes: number;
  isrDetermined: number | null;
  isrEstimated: number | null;
  isrRate: number | null;
  isrWithheld: number;
  movementCount: number;
  regimeName: string | null;
  regimeSatCode: string | null;
  taxEstimated: number | null;
  vatCreditable: number;
  vatEstimated: number | null;
  vatTransferred: number;
  warnings: TaxEstimationWarningCode[];
};

export type TaxEstimationTotals = {
  base: number;
  companies: number;
  companiesWithEstimate: number;
  deductibleExpenses: number;
  expenses: number;
  incomes: number;
  isrEstimated: number;
  taxEstimated: number;
  vatEstimated: number;
};

export type TaxEstimationResponse = {
  companies: TaxEstimationCompanyResult[];
  generatedAt: string;
  period: TaxEstimationPeriod;
  regime: typeof TAX_ESTIMATION_PRIORITY_REGIME;
  source: "movimientos_fiscales_normalizados";
  totals: TaxEstimationTotals;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function movementDateKey(value: string | null | undefined) {
  return value?.slice(0, 10) ?? "";
}

export function isTaxPeriodKey(value: string | null | undefined) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "");
}

export function currentTaxPeriodKey(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

export function parseTaxEstimationPeriod(value?: string | null, now = new Date()): TaxEstimationPeriod {
  const key = isTaxPeriodKey(value) ? value as string : currentTaxPeriodKey(now);
  const [yearText, monthText] = key.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    end: `${key}-${pad2(endDay)}`,
    key,
    label: key,
    month,
    start: `${key}-01`,
    year,
  };
}

export function resicoMonthlyRateForIncome(income: number) {
  if (income <= 0) return 0;
  const bracket = RESICO_MONTHLY_ISR_RATES.find((item) => income <= item.maxIncome);
  return bracket?.rate ?? RESICO_MONTHLY_ISR_RATES[RESICO_MONTHLY_ISR_RATES.length - 1].rate;
}

function isMovementInPeriod(movement: TaxEstimationMovement, period: TaxEstimationPeriod) {
  const date = movementDateKey(movement.date);
  return date >= period.start && date <= period.end;
}

export function estimateResicoCompanyTax({
  company,
  fiscalProfile,
  movements,
  period,
}: {
  company: TaxEstimationCompany;
  fiscalProfile: TaxEstimationFiscalProfile | null;
  movements: TaxEstimationMovement[];
  period: TaxEstimationPeriod;
}): TaxEstimationCompanyResult {
  let deductibleExpenses = 0;
  let excludedMovementCount = 0;
  let expenses = 0;
  let expenseCount = 0;
  let incomes = 0;
  let incomeCount = 0;
  let isrWithheld = 0;
  let movementCount = 0;
  let vatCreditable = 0;
  let vatTransferred = 0;

  for (const movement of movements) {
    if (movement.companyId !== company.id || !isMovementInPeriod(movement, period)) continue;
    movementCount += 1;

    const status = normalizedText(movement.status);
    if (movement.fiscalActive === false || status === "cancelado") {
      excludedMovementCount += 1;
      continue;
    }

    if (movement.type === "ingreso") {
      if (status !== "cobrado") {
        excludedMovementCount += 1;
        continue;
      }

      incomes += asNumber(movement.fiscalBase ?? movement.amount);
      vatTransferred += asNumber(movement.vatAmount);
      isrWithheld += asNumber(movement.isrWithheld);
      incomeCount += 1;
      continue;
    }

    if (movement.type === "gasto") {
      if (status !== "pagado") {
        excludedMovementCount += 1;
        continue;
      }

      expenses += asNumber(movement.amount);
      expenseCount += 1;

      if (movement.deductible) {
        deductibleExpenses += asNumber(movement.fiscalBase);
        vatCreditable += asNumber(movement.vatAmount);
      }
    }
  }

  const base = roundMoney(incomes);
  const warnings: TaxEstimationWarningCode[] = [];
  const hasResicoProfile = fiscalProfile?.satCode === TAX_ESTIMATION_PRIORITY_REGIME.satCode;

  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasResicoProfile) warnings.push("UNSUPPORTED_REGIME");
  if (base > RESICO_MONTHLY_ISR_RATES[RESICO_MONTHLY_ISR_RATES.length - 1].maxIncome) {
    warnings.push("RESICO_LIMIT_EXCEEDED");
  }

  const estimationAvailable = Boolean(fiscalProfile?.active && hasResicoProfile);
  const isrRate = estimationAvailable ? resicoMonthlyRateForIncome(base) : null;
  const isrDetermined = estimationAvailable ? roundMoney(base * (isrRate ?? 0)) : null;
  const isrEstimated = estimationAvailable ? Math.max(0, roundMoney((isrDetermined ?? 0) - isrWithheld)) : null;
  const vatEstimated = estimationAvailable ? Math.max(0, roundMoney(vatTransferred - vatCreditable)) : null;
  const taxEstimated = estimationAvailable ? roundMoney((isrEstimated ?? 0) + (vatEstimated ?? 0)) : null;

  return {
    base,
    companyId: company.id,
    companyName: company.name,
    deductibleExpenses: roundMoney(deductibleExpenses),
    estimationAvailable,
    excludedMovementCount,
    expenseCount,
    expenses: roundMoney(expenses),
    incomeCount,
    incomes: base,
    isrDetermined,
    isrEstimated,
    isrRate,
    isrWithheld: roundMoney(isrWithheld),
    movementCount,
    regimeName: fiscalProfile?.regimeName ?? null,
    regimeSatCode: fiscalProfile?.satCode ?? null,
    taxEstimated,
    vatCreditable: roundMoney(vatCreditable),
    vatEstimated,
    vatTransferred: roundMoney(vatTransferred),
    warnings,
  };
}

export function calculateTaxEstimations({
  companies,
  fiscalProfiles,
  generatedAt,
  movements,
  period,
}: {
  companies: TaxEstimationCompany[];
  fiscalProfiles: Map<string, TaxEstimationFiscalProfile>;
  generatedAt: string;
  movements: TaxEstimationMovement[];
  period: TaxEstimationPeriod;
}): TaxEstimationResponse {
  const companyResults = companies.map((company) => estimateResicoCompanyTax({
    company,
    fiscalProfile: fiscalProfiles.get(company.id) ?? null,
    movements,
    period,
  }));

  const estimatedCompanies = companyResults.filter((company) => company.estimationAvailable);
  const totals = estimatedCompanies.reduce<TaxEstimationTotals>((sum, company) => ({
    base: roundMoney(sum.base + company.base),
    companies: companyResults.length,
    companiesWithEstimate: estimatedCompanies.length,
    deductibleExpenses: roundMoney(sum.deductibleExpenses + company.deductibleExpenses),
    expenses: roundMoney(sum.expenses + company.expenses),
    incomes: roundMoney(sum.incomes + company.incomes),
    isrEstimated: roundMoney(sum.isrEstimated + (company.isrEstimated ?? 0)),
    taxEstimated: roundMoney(sum.taxEstimated + (company.taxEstimated ?? 0)),
    vatEstimated: roundMoney(sum.vatEstimated + (company.vatEstimated ?? 0)),
  }), {
    base: 0,
    companies: companyResults.length,
    companiesWithEstimate: estimatedCompanies.length,
    deductibleExpenses: 0,
    expenses: 0,
    incomes: 0,
    isrEstimated: 0,
    taxEstimated: 0,
    vatEstimated: 0,
  });

  return {
    companies: companyResults,
    generatedAt,
    period,
    regime: TAX_ESTIMATION_PRIORITY_REGIME,
    source: "movimientos_fiscales_normalizados",
    totals,
  };
}
