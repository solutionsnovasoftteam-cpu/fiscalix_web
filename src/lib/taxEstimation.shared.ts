export const TAX_ESTIMATION_PRIORITY_REGIME = {
  key: "RESICO_PERSONA_FISICA",
  name: "Régimen Simplificado de Confianza",
  satCode: "626",
} as const;

export const TAX_ESTIMATION_MULTIREGIME = {
  key: "MULTIREGIMEN_PERSONA_FISICA",
  name: "Motor fiscal multirrégimen",
  satCode: "MULTI",
} as const;

export const TAX_ESTIMATION_RULE_VERSION = {
  code: "RESICO_MX_PF_MONTHLY_V1",
  description: "ISR RESICO mensual + IVA trasladado menos acreditable sobre movimientos normalizados.",
  version: "1.0.0",
} as const;

export const TAX_ESTIMATION_MULTIREGIME_RULE_VERSION = {
  code: "FISCALIX_MX_PF_MULTIREGIME_STAGE_8_V1",
  description: "Orquestación fiscal multirrégimen Etapa 8 sobre movimientos normalizados.",
  version: "1.0.0",
} as const;

export const RESICO_MONTHLY_ISR_RATES = [
  { maxIncome: 25000, rate: 0.01 },
  { maxIncome: 50000, rate: 0.011 },
  { maxIncome: 83333.33, rate: 0.015 },
  { maxIncome: 208333.33, rate: 0.02 },
  { maxIncome: 3500000, rate: 0.025 },
] as const;

export const BUSINESS_PROFESSIONAL_REGIME = {
  key: "ACTIVIDADES_EMPRESARIALES_PROFESIONALES",
  name: "Actividades empresariales y profesionales",
  satCode: "612",
} as const;

export const LEASING_REGIME = {
  key: "ARRENDAMIENTO",
  name: "Arrendamiento",
  satCode: "606",
} as const;

export const DIGITAL_PLATFORMS_REGIME = {
  key: "PLATAFORMAS_TECNOLOGICAS",
  name: "Plataformas tecnológicas",
  satCode: "625",
} as const;

export const WAGES_INTEREST_DIVIDENDS_REGIME = {
  key: "SUELDOS_INTERESES_DIVIDENDOS",
  name: "Sueldos, intereses y dividendos",
  satCodes: ["605", "611", "614"],
} as const;

export const SPECIAL_TAX_EVENTS_REGIME = {
  key: "EVENTOS_FISCALES_ESPECIALES",
  name: "Eventos fiscales especiales",
  satCodes: ["607", "608", "610", "615"],
} as const;

export const LEASING_OPTIONAL_DEDUCTION_RATE = 0.35;
export const DIGITAL_PLATFORM_DEFAULT_ISR_RATE = 0.01;
export const DIVIDEND_ADDITIONAL_ISR_RATE = 0.10;
export const PRIZE_DEFAULT_ISR_RATE = 0.01;
export const SPECIAL_EVENT_DEFAULT_ISR_RATE = 0.20;

export const ISR_ARTICLE_106_2026_MONTHLY_BASE_TARIFF = [
  { fixedFee: 0, lowerLimit: 0.01, rate: 0.0192, upperLimit: 844.59 },
  { fixedFee: 16.22, lowerLimit: 844.60, rate: 0.064, upperLimit: 7168.51 },
  { fixedFee: 420.95, lowerLimit: 7168.52, rate: 0.1088, upperLimit: 12598.02 },
  { fixedFee: 1011.68, lowerLimit: 12598.03, rate: 0.16, upperLimit: 14644.64 },
  { fixedFee: 1339.14, lowerLimit: 14644.65, rate: 0.1792, upperLimit: 17533.64 },
  { fixedFee: 1856.84, lowerLimit: 17533.65, rate: 0.2136, upperLimit: 35362.83 },
  { fixedFee: 5665.16, lowerLimit: 35362.84, rate: 0.2352, upperLimit: 55736.68 },
  { fixedFee: 10457.09, lowerLimit: 55736.69, rate: 0.3, upperLimit: 106410.50 },
  { fixedFee: 25659.23, lowerLimit: 106410.51, rate: 0.32, upperLimit: 141880.66 },
  { fixedFee: 37009.69, lowerLimit: 141880.67, rate: 0.34, upperLimit: 425641.99 },
  { fixedFee: 133488.54, lowerLimit: 425642.00, rate: 0.35, upperLimit: null },
] as const;

export type TaxRegimeCalculationStatus = "enabled" | "validation_only" | "planned";

export type TaxRegimeDefinition = {
  description: string;
  enabled: boolean;
  formulas: Record<string, string>;
  key: string;
  name: string;
  order: number;
  requiredData: readonly string[];
  ruleVersion: {
    code: string;
    description: string;
    version: string;
  };
  satCodes: readonly string[];
  status: TaxRegimeCalculationStatus;
  testCaseFile: string | null;
  validations: readonly string[];
};

export const TAX_REGIME_RULES: readonly TaxRegimeDefinition[] = [
  {
    description: "Estimación mensual RESICO para personas físicas con ingresos cobrados y movimientos normalizados.",
    enabled: true,
    formulas: {
      baseResico: "sum(ingresos.cobrados.base_fiscal)",
      isrDetermined: "baseResico * tasaResicoMensual",
      isrEstimated: "max(0, isrDetermined - isrRetenido)",
      vatEstimated: "max(0, ivaTrasladado - ivaAcreditable)",
      taxEstimated: "isrEstimated + vatEstimated",
    },
    key: TAX_ESTIMATION_PRIORITY_REGIME.key,
    name: TAX_ESTIMATION_PRIORITY_REGIME.name,
    order: 1,
    requiredData: [
      "movimientos_fiscales_normalizados",
      "ingresos cobrados",
      "gastos pagados deducibles para IVA",
      "retenciones ISR registradas",
    ],
    ruleVersion: TAX_ESTIMATION_RULE_VERSION,
    satCodes: [TAX_ESTIMATION_PRIORITY_REGIME.satCode],
    status: "enabled",
    testCaseFile: "docs/tax-estimation-stage-6-cases.json",
    validations: [
      "perfil fiscal activo",
      "régimen SAT 626",
      "periodo mensual YYYY-MM",
      "movimientos activos del periodo",
    ],
  },
  {
    description: "Pago provisional mensual para actividades empresariales y servicios profesionales con ingresos y deducciones acumuladas.",
    enabled: true,
    formulas: {
      isrBase: "ingresos_cobrados_acumulados - deducciones_autorizadas_acumuladas",
      isrDetermined: "tarifa_articulo_106(base_acumulada, mes)",
      isrEstimated: "max(0, isrDetermined - isrRetenido - pagosProvisionalesPrevios)",
      vatEstimated: "max(0, ivaTrasladadoPeriodo - ivaAcreditablePeriodo)",
      taxEstimated: "isrEstimated + vatEstimated",
    },
    key: BUSINESS_PROFESSIONAL_REGIME.key,
    name: BUSINESS_PROFESSIONAL_REGIME.name,
    order: 2,
    requiredData: [
      "ingresos cobrados acumulados del ejercicio",
      "gastos pagados deducibles acumulados",
      "retenciones ISR registradas",
      "IVA acreditable validado",
    ],
    ruleVersion: {
      code: "ACTIVIDADES_EMP_PROF_MX_PF_MONTHLY_V1",
      description: "ISR provisional por tarifa Art. 106 con base acumulada e IVA mensual estimado.",
      version: "1.0.0",
    },
    satCodes: [BUSINESS_PROFESSIONAL_REGIME.satCode],
    status: "enabled",
    testCaseFile: "docs/tax-estimation-stage-8-cases.json",
    validations: [
      "perfil fiscal activo",
      "régimen SAT 612",
      "periodo mensual YYYY-MM",
      "pagos provisionales previos no descontados hasta habilitar tabla de pagos",
    ],
  },
  {
    description: "Pago provisional de arrendamiento con tarifa Art. 106, retenciones e IVA estimado.",
    enabled: true,
    formulas: {
      deductionUsed: "deducciones_registradas || ingresos_arrendamiento * 35%",
      isrBase: "ingresos_arrendamiento - deduccion_aplicable",
      isrDetermined: "tarifa_articulo_106(base_mensual, 1)",
      isrEstimated: "max(0, isrDetermined - isrRetenido)",
      vatEstimated: "max(0, ivaTrasladado - ivaAcreditable)",
      taxEstimated: "isrEstimated + vatEstimated",
    },
    key: LEASING_REGIME.key,
    name: LEASING_REGIME.name,
    order: 3,
    requiredData: [
      "ingresos cobrados de arrendamiento",
      "deducciones pagadas o deducción opcional 35%",
      "retenciones por arrendatario",
      "IVA acreditable validado",
    ],
    ruleVersion: {
      code: "ARRENDAMIENTO_MX_PF_MONTHLY_V1",
      description: "ISR provisional por tarifa Art. 106 con deducciones registradas u opción 35% e IVA mensual estimado.",
      version: "1.0.0",
    },
    satCodes: [LEASING_REGIME.satCode],
    status: "enabled",
    testCaseFile: "docs/tax-estimation-stage-8-cases.json",
    validations: [
      "perfil fiscal activo",
      "régimen SAT 606",
      "periodo mensual YYYY-MM",
      "si no hay deducciones registradas usa deducción opcional 35%",
      "no distingue todavía arrendamiento exento de IVA por casa habitación",
    ],
  },
  {
    description: "Estimación mensual de plataformas tecnológicas con retenciones capturadas y tasa base conservadora.",
    enabled: true,
    formulas: {
      isrDetermined: "ingresos_plataformas * tasa_default_1%",
      isrEstimated: "max(0, isrDetermined - isrRetenido)",
      vatEstimated: "max(0, ivaTrasladado - ivaAcreditable)",
      taxEstimated: "isrEstimated + vatEstimated",
    },
    key: DIGITAL_PLATFORMS_REGIME.key,
    name: DIGITAL_PLATFORMS_REGIME.name,
    order: 4,
    requiredData: [
      "ingresos cobrados por plataforma",
      "retenciones ISR registradas",
      "IVA trasladado y acreditable",
      "tipo de servicio para tasas finas",
    ],
    ruleVersion: {
      code: "PLATAFORMAS_TEC_MX_PF_MONTHLY_V1",
      description: "ISR estimado con tasa base 1% y acreditamiento de retenciones; IVA mensual estimado.",
      version: "1.0.0",
    },
    satCodes: [DIGITAL_PLATFORMS_REGIME.satCode],
    status: "enabled",
    testCaseFile: "docs/tax-estimation-stage-8-cases.json",
    validations: [
      "perfil fiscal activo",
      "régimen SAT 625",
      "periodo mensual YYYY-MM",
      "tasa ISR base 1% hasta capturar tipo de servicio",
      "requiere distinguir pago definitivo vs provisional en una etapa posterior",
    ],
  },
  {
    description: "Estimación limitada para sueldos, intereses y dividendos a partir de ingresos y retenciones registradas.",
    enabled: true,
    formulas: {
      wagesIsr: "tarifa_articulo_96(ingresos_sueldos_mensuales)",
      interestIsr: "retenciones_intereses_registradas",
      dividendIsr: "dividendos * 10%",
      isrEstimated: "max(0, isrDetermined - isrRetenido)",
      taxEstimated: "isrEstimated",
    },
    key: WAGES_INTEREST_DIVIDENDS_REGIME.key,
    name: WAGES_INTEREST_DIVIDENDS_REGIME.name,
    order: 5,
    requiredData: [
      "ingresos cobrados por subrégimen",
      "retenciones informadas",
      "constancias de retención para conciliación",
      "tratamiento anual o definitivo cuando aplique",
    ],
    ruleVersion: {
      code: "SUELDOS_INTERESES_DIVIDENDOS_MX_PF_V1",
      description: "Cálculo automático limitado por subrégimen con retenciones capturadas.",
      version: "1.0.0",
    },
    satCodes: WAGES_INTEREST_DIVIDENDS_REGIME.satCodes,
    status: "enabled",
    testCaseFile: "docs/tax-estimation-stage-8-cases.json",
    validations: [
      "perfil fiscal activo",
      "régimen SAT 605, 611 o 614",
      "periodo mensual YYYY-MM",
      "requiere constancias para conciliación final",
      "intereses se estiman con retención capturada hasta capturar capital o tasa LIF",
    ],
  },
  {
    description: "Estimación limitada para eventos especiales con tasa por tipo fiscal cuando el movimiento no trae detalle adicional.",
    enabled: true,
    formulas: {
      prizeIsr: "premios * 1%",
      transferOrOtherIsr: "importe_evento * 20%",
      foreignResidentIsr: "retenciones_registradas",
      isrEstimated: "max(0, isrDetermined - isrRetenido)",
      vatEstimated: "max(0, ivaTrasladado - ivaAcreditable)",
      taxEstimated: "isrEstimated + vatEstimated",
    },
    key: SPECIAL_TAX_EVENTS_REGIME.key,
    name: SPECIAL_TAX_EVENTS_REGIME.name,
    order: 6,
    requiredData: [
      "tipo de evento",
      "fecha de causación",
      "costo o deducción autorizada",
      "retenciones del evento",
    ],
    ruleVersion: {
      code: "EVENTOS_FISCALES_ESPECIALES_MX_PF_V1",
      description: "Cálculo automático limitado para premios, enajenación/demás ingresos y retenciones de residentes en el extranjero.",
      version: "1.0.0",
    },
    satCodes: SPECIAL_TAX_EVENTS_REGIME.satCodes,
    status: "enabled",
    testCaseFile: "docs/tax-estimation-stage-8-cases.json",
    validations: [
      "perfil fiscal activo",
      "régimen SAT 607, 608, 610 o 615",
      "periodo mensual YYYY-MM",
      "usa tasa base por subrégimen hasta capturar tipo de evento específico",
      "requiere revisión profesional para inmuebles, costo comprobado y residentes en el extranjero",
    ],
  },
] as const;

export type TaxEstimationWarningCode =
  | "MISSING_FISCAL_PROFILE"
  | "INACTIVE_FISCAL_PROFILE"
  | "BUSINESS_PRO_PREVIOUS_PAYMENTS_NOT_TRACKED"
  | "DIVIDEND_CORPORATE_TAX_NOT_TRACKED"
  | "INTEREST_WITHHOLDING_ONLY"
  | "LEASE_OPTIONAL_DEDUCTION_LIMITED"
  | "PLATFORM_SERVICE_TYPE_NOT_CONFIGURED"
  | "UNSUPPORTED_REGIME"
  | "REGIME_NOT_ENABLED_STAGE_8"
  | "RESICO_LIMIT_EXCEEDED"
  | "SPECIAL_EVENT_LIMITED_DATA"
  | "WAGE_WITHHOLDING_ESTIMATE_LIMITED";

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
  id: string;
  isrWithheld: number | string | null;
  status: string | null;
  type: "ingreso" | "gasto" | string;
  vatAmount: number | string | null;
};

export type TaxEstimationMovementDecision = {
  amount: number;
  companyId: string | null;
  considered: boolean;
  date: string | null;
  decision: "considered" | "excluded";
  deductible: boolean | null;
  exclusionReason: string | null;
  fiscalBase: number;
  id: string;
  isrWithheld: number;
  status: string | null;
  type: string;
  vatAmount: number;
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
  regimeKey: string | null;
  regimeName: string | null;
  regimeRuleVersion: string | null;
  regimeSatCode: string | null;
  regimeStatus: TaxRegimeCalculationStatus | null;
  taxEstimated: number | null;
  validationMessages: string[];
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

export type TaxEstimationRegimeSummary = {
  key: string;
  name: string;
  satCode: string;
};

export type TaxEstimationRuleVersion = {
  code: string;
  description: string;
  version: string;
};

export type TaxEstimationResponse = {
  companies: TaxEstimationCompanyResult[];
  generatedAt: string;
  movementTrace: TaxEstimationMovementDecision[];
  period: TaxEstimationPeriod;
  regime: TaxEstimationRegimeSummary;
  regimeCatalog: readonly TaxRegimeDefinition[];
  ruleVersion: TaxEstimationRuleVersion;
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

export function taxRegimeRuleForSatCode(satCode: string | null | undefined) {
  return TAX_REGIME_RULES.find((rule) => rule.satCodes.includes(satCode ?? "")) ?? null;
}

function includesSatCode(satCodes: readonly string[], satCode: string | null | undefined) {
  return satCodes.includes(satCode ?? "");
}

function appliedRegimeForResults(companyResults: TaxEstimationCompanyResult[]): TaxEstimationRegimeSummary {
  const available = companyResults.filter((company) => company.estimationAvailable && company.regimeSatCode);
  const satCodes = new Set(available.map((company) => company.regimeSatCode as string));

  if (satCodes.size === 1) {
    const result = available[0];
    return {
      key: result.regimeKey ?? TAX_ESTIMATION_PRIORITY_REGIME.key,
      name: result.regimeName ?? TAX_ESTIMATION_PRIORITY_REGIME.name,
      satCode: result.regimeSatCode ?? TAX_ESTIMATION_PRIORITY_REGIME.satCode,
    };
  }

  return TAX_ESTIMATION_MULTIREGIME;
}

function appliedRuleVersionForResults(companyResults: TaxEstimationCompanyResult[]): TaxEstimationRuleVersion {
  const available = companyResults.filter((company) => company.estimationAvailable && company.regimeSatCode);
  const satCodes = new Set(available.map((company) => company.regimeSatCode as string));

  if (satCodes.size === 1) {
    const satCode = available[0]?.regimeSatCode;
    return taxRegimeRuleForSatCode(satCode)?.ruleVersion ?? TAX_ESTIMATION_RULE_VERSION;
  }

  return TAX_ESTIMATION_MULTIREGIME_RULE_VERSION;
}

export function article106TariffForMonth(month: number) {
  const safeMonth = Math.min(Math.max(Math.trunc(month), 1), 12);
  return ISR_ARTICLE_106_2026_MONTHLY_BASE_TARIFF.map((bracket, index, brackets) => {
    const previousUpper = index === 0 ? null : brackets[index - 1].upperLimit;

    return {
      fixedFee: roundMoney(bracket.fixedFee * safeMonth),
      lowerLimit: index === 0 ? 0.01 : roundMoney(((previousUpper ?? 0) * safeMonth) + 0.01),
      rate: bracket.rate,
      upperLimit: bracket.upperLimit === null ? null : roundMoney(bracket.upperLimit * safeMonth),
    };
  });
}

export function estimateArticle106Isr(base: number, month: number) {
  if (base <= 0) return { bracketRate: 0, isr: 0 };
  const bracket = article106TariffForMonth(month)
    .find((item) => item.upperLimit === null || base <= item.upperLimit);
  if (!bracket) return { bracketRate: 0, isr: 0 };

  return {
    bracketRate: bracket.rate,
    isr: roundMoney(bracket.fixedFee + ((base - bracket.lowerLimit) * bracket.rate)),
  };
}

function isMovementInPeriod(movement: TaxEstimationMovement, period: TaxEstimationPeriod) {
  const date = movementDateKey(movement.date);
  return date >= period.start && date <= period.end;
}

function isMovementInCompanies(movement: TaxEstimationMovement, companyIds: ReadonlySet<string>) {
  return Boolean(movement.companyId && companyIds.has(movement.companyId));
}

export function taxEstimationFormulaSnapshot() {
  return {
    code: TAX_ESTIMATION_RULE_VERSION.code,
    description: TAX_ESTIMATION_RULE_VERSION.description,
    formulas: {
      baseResico: "sum(ingresos.cobrados.base_fiscal)",
      isrDetermined: "baseResico * tasaResicoMensual",
      isrEstimated: "max(0, isrDetermined - isrRetenido)",
      vatEstimated: "max(0, ivaTrasladado - ivaAcreditable)",
      taxEstimated: "isrEstimated + vatEstimated",
    },
    digitalPlatformDefaultIsrRate: DIGITAL_PLATFORM_DEFAULT_ISR_RATE,
    dividendAdditionalIsrRate: DIVIDEND_ADDITIONAL_ISR_RATE,
    enabledRegimes: TAX_REGIME_RULES.filter((rule) => rule.enabled).map((rule) => rule.key),
    isrArticle106MonthlyBaseTariff2026: ISR_ARTICLE_106_2026_MONTHLY_BASE_TARIFF,
    leasingOptionalDeductionRate: LEASING_OPTIONAL_DEDUCTION_RATE,
    progressiveExpansion: true,
    prizeDefaultIsrRate: PRIZE_DEFAULT_ISR_RATE,
    regime: TAX_ESTIMATION_PRIORITY_REGIME,
    regimes: TAX_REGIME_RULES,
    resicoMonthlyRates: RESICO_MONTHLY_ISR_RATES,
    source: "movimientos_fiscales_normalizados",
    specialEventDefaultIsrRate: SPECIAL_EVENT_DEFAULT_ISR_RATE,
    version: TAX_ESTIMATION_RULE_VERSION.version,
  };
}

export function buildTaxEstimationMovementTrace({
  companies,
  companyResults,
  movements,
  period,
}: {
  companies: TaxEstimationCompany[];
  companyResults: TaxEstimationCompanyResult[];
  movements: TaxEstimationMovement[];
  period: TaxEstimationPeriod;
}): TaxEstimationMovementDecision[] {
  const companyIds = new Set(companies.map((company) => company.id));
  const resultByCompanyId = new Map(companyResults.map((company) => [company.companyId, company]));

  const yearStart = `${period.year}-01-01`;

  return movements
    .filter((movement) => {
      if (!isMovementInCompanies(movement, companyIds)) return false;
      const companyResult = movement.companyId ? resultByCompanyId.get(movement.companyId) : null;
      const date = movementDateKey(movement.date);
      if (companyResult?.regimeKey === BUSINESS_PROFESSIONAL_REGIME.key) {
        return date >= yearStart && date <= period.end;
      }

      return isMovementInPeriod(movement, period);
    })
    .map((movement): TaxEstimationMovementDecision => {
      const companyResult = movement.companyId ? resultByCompanyId.get(movement.companyId) : null;
      const status = normalizedText(movement.status);
      let considered = false;
      let exclusionReason: string | null = null;

      if (!companyResult?.estimationAvailable) {
        exclusionReason = companyResult?.warnings[0] ?? "UNSUPPORTED_REGIME";
      } else if (movement.fiscalActive === false || status === "cancelado") {
        exclusionReason = "MOVIMIENTO_CANCELADO_O_INACTIVO";
      } else if (movement.type === "ingreso") {
        if (status === "cobrado") considered = true;
        else exclusionReason = "INGRESO_NO_COBRADO";
      } else if (movement.type === "gasto") {
        if (status === "pagado" && companyResult?.regimeKey === WAGES_INTEREST_DIVIDENDS_REGIME.key) {
          exclusionReason = "GASTO_NO_APLICA_AL_REGIMEN";
        } else if (status === "pagado") considered = true;
        else exclusionReason = "GASTO_NO_PAGADO";
      } else {
        exclusionReason = "TIPO_NO_SOPORTADO";
      }

      return {
        amount: asNumber(movement.amount),
        companyId: movement.companyId,
        considered,
        date: movement.date,
        decision: considered ? "considered" : "excluded",
        deductible: movement.deductible,
        exclusionReason,
        fiscalBase: asNumber(movement.fiscalBase),
        id: movement.id,
        isrWithheld: asNumber(movement.isrWithheld),
        status: movement.status,
        type: movement.type,
        vatAmount: asNumber(movement.vatAmount),
      };
    });
}

type PeriodMovementSummary = {
  deductibleExpenses: number;
  excludedMovementCount: number;
  expenseCount: number;
  expenses: number;
  incomeCount: number;
  incomes: number;
  isrWithheld: number;
  movementCount: number;
  vatCreditable: number;
  vatTransferred: number;
};

function emptyPeriodSummary(): PeriodMovementSummary {
  return {
    deductibleExpenses: 0,
    excludedMovementCount: 0,
    expenseCount: 0,
    expenses: 0,
    incomeCount: 0,
    incomes: 0,
    isrWithheld: 0,
    movementCount: 0,
    vatCreditable: 0,
    vatTransferred: 0,
  };
}

function summarizeCompanyPeriodMovements({
  company,
  movements,
  period,
}: {
  company: TaxEstimationCompany;
  movements: TaxEstimationMovement[];
  period: TaxEstimationPeriod;
}) {
  const summary = emptyPeriodSummary();

  for (const movement of movements) {
    if (movement.companyId !== company.id || !isMovementInPeriod(movement, period)) continue;
    summary.movementCount += 1;

    const status = normalizedText(movement.status);
    if (movement.fiscalActive === false || status === "cancelado") {
      summary.excludedMovementCount += 1;
      continue;
    }

    if (movement.type === "ingreso") {
      if (status !== "cobrado") {
        summary.excludedMovementCount += 1;
        continue;
      }

      summary.incomes += asNumber(movement.fiscalBase ?? movement.amount);
      summary.vatTransferred += asNumber(movement.vatAmount);
      summary.isrWithheld += asNumber(movement.isrWithheld);
      summary.incomeCount += 1;
      continue;
    }

    if (movement.type === "gasto") {
      if (status !== "pagado") {
        summary.excludedMovementCount += 1;
        continue;
      }

      summary.expenses += asNumber(movement.amount);
      summary.expenseCount += 1;

      if (movement.deductible) {
        summary.deductibleExpenses += asNumber(movement.fiscalBase);
        summary.vatCreditable += asNumber(movement.vatAmount);
      }
      continue;
    }

    summary.excludedMovementCount += 1;
  }

  return {
    deductibleExpenses: roundMoney(summary.deductibleExpenses),
    excludedMovementCount: summary.excludedMovementCount,
    expenseCount: summary.expenseCount,
    expenses: roundMoney(summary.expenses),
    incomeCount: summary.incomeCount,
    incomes: roundMoney(summary.incomes),
    isrWithheld: roundMoney(summary.isrWithheld),
    movementCount: summary.movementCount,
    vatCreditable: roundMoney(summary.vatCreditable),
    vatTransferred: roundMoney(summary.vatTransferred),
  };
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
  const regimeRule = taxRegimeRuleForSatCode(fiscalProfile?.satCode);
  const hasResicoProfile = regimeRule?.key === TAX_ESTIMATION_PRIORITY_REGIME.key;

  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasResicoProfile) warnings.push(regimeRule ? "REGIME_NOT_ENABLED_STAGE_8" : "UNSUPPORTED_REGIME");
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
    regimeKey: regimeRule?.key ?? null,
    regimeName: fiscalProfile?.regimeName ?? null,
    regimeRuleVersion: regimeRule?.ruleVersion.version ?? null,
    regimeSatCode: fiscalProfile?.satCode ?? null,
    regimeStatus: regimeRule?.status ?? null,
    taxEstimated,
    validationMessages: estimationAvailable ? [] : [...(regimeRule?.validations ?? [])],
    vatCreditable: roundMoney(vatCreditable),
    vatEstimated,
    vatTransferred: roundMoney(vatTransferred),
    warnings,
  };
}

export function estimateBusinessProfessionalCompanyTax({
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
  const yearStart = `${period.year}-01-01`;

  for (const movement of movements) {
    if (movement.companyId !== company.id) continue;
    const date = movementDateKey(movement.date);
    if (date < yearStart || date > period.end) continue;

    movementCount += 1;
    const status = normalizedText(movement.status);
    if (movement.fiscalActive === false || status === "cancelado") {
      excludedMovementCount += 1;
      continue;
    }

    const inCurrentPeriod = isMovementInPeriod(movement, period);
    if (movement.type === "ingreso") {
      if (status !== "cobrado") {
        excludedMovementCount += 1;
        continue;
      }

      incomes += asNumber(movement.fiscalBase ?? movement.amount);
      isrWithheld += asNumber(movement.isrWithheld);
      incomeCount += 1;
      if (inCurrentPeriod) vatTransferred += asNumber(movement.vatAmount);
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
        if (inCurrentPeriod) vatCreditable += asNumber(movement.vatAmount);
      }
    }
  }

  const warnings: TaxEstimationWarningCode[] = [];
  const regimeRule = taxRegimeRuleForSatCode(fiscalProfile?.satCode);
  const hasBusinessProfessionalProfile = fiscalProfile?.satCode === BUSINESS_PROFESSIONAL_REGIME.satCode;
  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasBusinessProfessionalProfile) warnings.push("UNSUPPORTED_REGIME");

  const estimationAvailable = Boolean(fiscalProfile?.active && hasBusinessProfessionalProfile);
  if (estimationAvailable) warnings.push("BUSINESS_PRO_PREVIOUS_PAYMENTS_NOT_TRACKED");

  const base = Math.max(0, roundMoney(incomes - deductibleExpenses));
  const article106 = estimateArticle106Isr(base, period.month);
  const isrDetermined = estimationAvailable ? article106.isr : null;
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
    incomes: roundMoney(incomes),
    isrDetermined,
    isrEstimated,
    isrRate: estimationAvailable ? article106.bracketRate : null,
    isrWithheld: roundMoney(isrWithheld),
    movementCount,
    regimeKey: BUSINESS_PROFESSIONAL_REGIME.key,
    regimeName: fiscalProfile?.regimeName ?? BUSINESS_PROFESSIONAL_REGIME.name,
    regimeRuleVersion: regimeRule?.ruleVersion.version ?? "1.0.0",
    regimeSatCode: fiscalProfile?.satCode ?? BUSINESS_PROFESSIONAL_REGIME.satCode,
    regimeStatus: regimeRule?.status ?? "enabled",
    taxEstimated,
    validationMessages: estimationAvailable
      ? ["Estimación limitada: no descuenta pagos provisionales previos hasta habilitar su captura."]
      : [...(regimeRule?.validations ?? [])],
    vatCreditable: roundMoney(vatCreditable),
    vatEstimated,
    vatTransferred: roundMoney(vatTransferred),
    warnings,
  };
}

export function estimateLeasingCompanyTax({
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
  const summary = summarizeCompanyPeriodMovements({ company, movements, period });
  const warnings: TaxEstimationWarningCode[] = [];
  const regimeRule = taxRegimeRuleForSatCode(fiscalProfile?.satCode);
  const hasLeasingProfile = fiscalProfile?.satCode === LEASING_REGIME.satCode;

  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasLeasingProfile) warnings.push("UNSUPPORTED_REGIME");

  const estimationAvailable = Boolean(fiscalProfile?.active && hasLeasingProfile);
  if (estimationAvailable) warnings.push("LEASE_OPTIONAL_DEDUCTION_LIMITED");

  const optionalDeduction = roundMoney(summary.incomes * LEASING_OPTIONAL_DEDUCTION_RATE);
  const deductionUsed = summary.deductibleExpenses > 0 ? summary.deductibleExpenses : optionalDeduction;
  const base = Math.max(0, roundMoney(summary.incomes - deductionUsed));
  const article106 = estimateArticle106Isr(base, 1);
  const isrDetermined = estimationAvailable ? article106.isr : null;
  const isrEstimated = estimationAvailable ? Math.max(0, roundMoney((isrDetermined ?? 0) - summary.isrWithheld)) : null;
  const vatEstimated = estimationAvailable ? Math.max(0, roundMoney(summary.vatTransferred - summary.vatCreditable)) : null;
  const taxEstimated = estimationAvailable ? roundMoney((isrEstimated ?? 0) + (vatEstimated ?? 0)) : null;

  return {
    base,
    companyId: company.id,
    companyName: company.name,
    deductibleExpenses: roundMoney(deductionUsed),
    estimationAvailable,
    excludedMovementCount: summary.excludedMovementCount,
    expenseCount: summary.expenseCount,
    expenses: summary.expenses,
    incomeCount: summary.incomeCount,
    incomes: summary.incomes,
    isrDetermined,
    isrEstimated,
    isrRate: estimationAvailable ? article106.bracketRate : null,
    isrWithheld: summary.isrWithheld,
    movementCount: summary.movementCount,
    regimeKey: LEASING_REGIME.key,
    regimeName: fiscalProfile?.regimeName ?? LEASING_REGIME.name,
    regimeRuleVersion: regimeRule?.ruleVersion.version ?? "1.0.0",
    regimeSatCode: fiscalProfile?.satCode ?? LEASING_REGIME.satCode,
    regimeStatus: regimeRule?.status ?? "enabled",
    taxEstimated,
    validationMessages: estimationAvailable
      ? [
          summary.deductibleExpenses > 0
            ? "Estimación limitada: usa deducciones registradas; verifica que correspondan al inmueble."
            : "Estimación limitada: usa deducción opcional 35% al no encontrar deducciones registradas.",
          "No distingue todavía arrendamiento exento de IVA por casa habitación.",
        ]
      : [...(regimeRule?.validations ?? [])],
    vatCreditable: summary.vatCreditable,
    vatEstimated,
    vatTransferred: summary.vatTransferred,
    warnings,
  };
}

export function estimateDigitalPlatformsCompanyTax({
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
  const summary = summarizeCompanyPeriodMovements({ company, movements, period });
  const warnings: TaxEstimationWarningCode[] = [];
  const regimeRule = taxRegimeRuleForSatCode(fiscalProfile?.satCode);
  const hasPlatformProfile = fiscalProfile?.satCode === DIGITAL_PLATFORMS_REGIME.satCode;

  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasPlatformProfile) warnings.push("UNSUPPORTED_REGIME");

  const estimationAvailable = Boolean(fiscalProfile?.active && hasPlatformProfile);
  if (estimationAvailable) warnings.push("PLATFORM_SERVICE_TYPE_NOT_CONFIGURED");

  const base = summary.incomes;
  const isrDetermined = estimationAvailable ? roundMoney(base * DIGITAL_PLATFORM_DEFAULT_ISR_RATE) : null;
  const isrEstimated = estimationAvailable ? Math.max(0, roundMoney((isrDetermined ?? 0) - summary.isrWithheld)) : null;
  const vatEstimated = estimationAvailable ? Math.max(0, roundMoney(summary.vatTransferred - summary.vatCreditable)) : null;
  const taxEstimated = estimationAvailable ? roundMoney((isrEstimated ?? 0) + (vatEstimated ?? 0)) : null;

  return {
    base,
    companyId: company.id,
    companyName: company.name,
    deductibleExpenses: summary.deductibleExpenses,
    estimationAvailable,
    excludedMovementCount: summary.excludedMovementCount,
    expenseCount: summary.expenseCount,
    expenses: summary.expenses,
    incomeCount: summary.incomeCount,
    incomes: summary.incomes,
    isrDetermined,
    isrEstimated,
    isrRate: estimationAvailable ? DIGITAL_PLATFORM_DEFAULT_ISR_RATE : null,
    isrWithheld: summary.isrWithheld,
    movementCount: summary.movementCount,
    regimeKey: DIGITAL_PLATFORMS_REGIME.key,
    regimeName: fiscalProfile?.regimeName ?? DIGITAL_PLATFORMS_REGIME.name,
    regimeRuleVersion: regimeRule?.ruleVersion.version ?? "1.0.0",
    regimeSatCode: fiscalProfile?.satCode ?? DIGITAL_PLATFORMS_REGIME.satCode,
    regimeStatus: regimeRule?.status ?? "enabled",
    taxEstimated,
    validationMessages: estimationAvailable
      ? ["Estimación limitada: usa tasa ISR base 1% hasta capturar tipo de servicio de la plataforma."]
      : [...(regimeRule?.validations ?? [])],
    vatCreditable: summary.vatCreditable,
    vatEstimated,
    vatTransferred: summary.vatTransferred,
    warnings,
  };
}

export function estimateWagesInterestDividendsCompanyTax({
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
  const summary = summarizeCompanyPeriodMovements({ company, movements, period });
  const warnings: TaxEstimationWarningCode[] = [];
  const regimeRule = taxRegimeRuleForSatCode(fiscalProfile?.satCode);
  const satCode = fiscalProfile?.satCode ?? "";
  const hasSupportedProfile = includesSatCode(WAGES_INTEREST_DIVIDENDS_REGIME.satCodes, satCode);

  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasSupportedProfile) warnings.push("UNSUPPORTED_REGIME");

  const estimationAvailable = Boolean(fiscalProfile?.active && hasSupportedProfile);
  let isrRate: number | null = null;
  let isrDetermined = 0;
  let validationMessage = "Estimación limitada: requiere constancias para conciliación final.";

  if (satCode === "605") {
    const wageTax = estimateArticle106Isr(summary.incomes, 1);
    isrRate = wageTax.bracketRate;
    isrDetermined = wageTax.isr;
    validationMessage = "Estimación limitada: no descuenta subsidio, ingresos exentos ni ajuste anual de constancia.";
    if (estimationAvailable) warnings.push("WAGE_WITHHOLDING_ESTIMATE_LIMITED");
  } else if (satCode === "611") {
    isrRate = DIVIDEND_ADDITIONAL_ISR_RATE;
    isrDetermined = roundMoney(summary.incomes * DIVIDEND_ADDITIONAL_ISR_RATE);
    validationMessage = "Estimación limitada: aplica retención adicional 10%; no acredita ISR corporativo.";
    if (estimationAvailable) warnings.push("DIVIDEND_CORPORATE_TAX_NOT_TRACKED");
  } else if (satCode === "614") {
    isrDetermined = summary.isrWithheld;
    validationMessage = "Estimación limitada: usa retención capturada; falta capital o tasa LIF para determinar ISR propio.";
    if (estimationAvailable) warnings.push("INTEREST_WITHHOLDING_ONLY");
  }

  const isrEstimated = estimationAvailable ? Math.max(0, roundMoney(isrDetermined - summary.isrWithheld)) : null;

  return {
    base: summary.incomes,
    companyId: company.id,
    companyName: company.name,
    deductibleExpenses: 0,
    estimationAvailable,
    excludedMovementCount: summary.excludedMovementCount,
    expenseCount: summary.expenseCount,
    expenses: summary.expenses,
    incomeCount: summary.incomeCount,
    incomes: summary.incomes,
    isrDetermined: estimationAvailable ? isrDetermined : null,
    isrEstimated,
    isrRate: estimationAvailable ? isrRate : null,
    isrWithheld: summary.isrWithheld,
    movementCount: summary.movementCount,
    regimeKey: WAGES_INTEREST_DIVIDENDS_REGIME.key,
    regimeName: fiscalProfile?.regimeName ?? WAGES_INTEREST_DIVIDENDS_REGIME.name,
    regimeRuleVersion: regimeRule?.ruleVersion.version ?? "1.0.0",
    regimeSatCode: fiscalProfile?.satCode ?? null,
    regimeStatus: regimeRule?.status ?? "enabled",
    taxEstimated: estimationAvailable ? isrEstimated : null,
    validationMessages: estimationAvailable ? [validationMessage] : [...(regimeRule?.validations ?? [])],
    vatCreditable: 0,
    vatEstimated: estimationAvailable ? 0 : null,
    vatTransferred: 0,
    warnings,
  };
}

export function estimateSpecialTaxEventCompanyTax({
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
  const summary = summarizeCompanyPeriodMovements({ company, movements, period });
  const warnings: TaxEstimationWarningCode[] = [];
  const regimeRule = taxRegimeRuleForSatCode(fiscalProfile?.satCode);
  const satCode = fiscalProfile?.satCode ?? "";
  const hasSupportedProfile = includesSatCode(SPECIAL_TAX_EVENTS_REGIME.satCodes, satCode);

  if (!fiscalProfile) warnings.push("MISSING_FISCAL_PROFILE");
  else if (!fiscalProfile.active) warnings.push("INACTIVE_FISCAL_PROFILE");
  else if (!hasSupportedProfile) warnings.push("UNSUPPORTED_REGIME");

  const estimationAvailable = Boolean(fiscalProfile?.active && hasSupportedProfile);
  if (estimationAvailable) warnings.push("SPECIAL_EVENT_LIMITED_DATA");

  let isrRate: number | null = SPECIAL_EVENT_DEFAULT_ISR_RATE;
  let isrDetermined = roundMoney(summary.incomes * SPECIAL_EVENT_DEFAULT_ISR_RATE);
  let validationMessage = "Estimación limitada: aplica tasa base 20% por falta de tipo de evento específico.";

  if (satCode === "615") {
    isrRate = PRIZE_DEFAULT_ISR_RATE;
    isrDetermined = roundMoney(summary.incomes * PRIZE_DEFAULT_ISR_RATE);
    validationMessage = "Estimación limitada: premios usa 1%; si el impuesto local excede 6% puede aplicar 21%.";
  } else if (satCode === "610") {
    isrRate = null;
    isrDetermined = summary.isrWithheld;
    validationMessage = "Estimación limitada: residentes en el extranjero usa retenciones registradas hasta capturar tipo de ingreso.";
  }

  const isrEstimated = estimationAvailable ? Math.max(0, roundMoney(isrDetermined - summary.isrWithheld)) : null;
  const vatEstimated = estimationAvailable && satCode !== "615" && satCode !== "610"
    ? Math.max(0, roundMoney(summary.vatTransferred - summary.vatCreditable))
    : estimationAvailable ? 0 : null;
  const taxEstimated = estimationAvailable ? roundMoney((isrEstimated ?? 0) + (vatEstimated ?? 0)) : null;

  return {
    base: summary.incomes,
    companyId: company.id,
    companyName: company.name,
    deductibleExpenses: summary.deductibleExpenses,
    estimationAvailable,
    excludedMovementCount: summary.excludedMovementCount,
    expenseCount: summary.expenseCount,
    expenses: summary.expenses,
    incomeCount: summary.incomeCount,
    incomes: summary.incomes,
    isrDetermined: estimationAvailable ? isrDetermined : null,
    isrEstimated,
    isrRate: estimationAvailable ? isrRate : null,
    isrWithheld: summary.isrWithheld,
    movementCount: summary.movementCount,
    regimeKey: SPECIAL_TAX_EVENTS_REGIME.key,
    regimeName: fiscalProfile?.regimeName ?? SPECIAL_TAX_EVENTS_REGIME.name,
    regimeRuleVersion: regimeRule?.ruleVersion.version ?? "1.0.0",
    regimeSatCode: fiscalProfile?.satCode ?? null,
    regimeStatus: regimeRule?.status ?? "enabled",
    taxEstimated,
    validationMessages: estimationAvailable ? [validationMessage] : [...(regimeRule?.validations ?? [])],
    vatCreditable: satCode === "615" || satCode === "610" ? 0 : summary.vatCreditable,
    vatEstimated,
    vatTransferred: satCode === "615" || satCode === "610" ? 0 : summary.vatTransferred,
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
  const companyResults = companies.map((company) => {
    const fiscalProfile = fiscalProfiles.get(company.id) ?? null;
    if (fiscalProfile?.satCode === BUSINESS_PROFESSIONAL_REGIME.satCode) {
      return estimateBusinessProfessionalCompanyTax({
        company,
        fiscalProfile,
        movements,
        period,
      });
    }

    if (fiscalProfile?.satCode === LEASING_REGIME.satCode) {
      return estimateLeasingCompanyTax({
        company,
        fiscalProfile,
        movements,
        period,
      });
    }

    if (fiscalProfile?.satCode === DIGITAL_PLATFORMS_REGIME.satCode) {
      return estimateDigitalPlatformsCompanyTax({
        company,
        fiscalProfile,
        movements,
        period,
      });
    }

    if (includesSatCode(WAGES_INTEREST_DIVIDENDS_REGIME.satCodes, fiscalProfile?.satCode)) {
      return estimateWagesInterestDividendsCompanyTax({
        company,
        fiscalProfile,
        movements,
        period,
      });
    }

    if (includesSatCode(SPECIAL_TAX_EVENTS_REGIME.satCodes, fiscalProfile?.satCode)) {
      return estimateSpecialTaxEventCompanyTax({
        company,
        fiscalProfile,
        movements,
        period,
      });
    }

    return estimateResicoCompanyTax({
      company,
      fiscalProfile,
      movements,
      period,
    });
  });

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
  const appliedRegime = appliedRegimeForResults(companyResults);
  const appliedRuleVersion = appliedRuleVersionForResults(companyResults);

  return {
    companies: companyResults,
    generatedAt,
    movementTrace: buildTaxEstimationMovementTrace({ companies, companyResults, movements, period }),
    period,
    regime: appliedRegime,
    regimeCatalog: TAX_REGIME_RULES,
    ruleVersion: appliedRuleVersion,
    source: "movimientos_fiscales_normalizados",
    totals,
  };
}
