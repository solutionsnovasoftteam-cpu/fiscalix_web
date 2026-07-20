export type PayrollRun = {
  deductions: number;
  downloaded: boolean;
  employees: number;
  folio: string;
  id: string;
  paid: number;
  payDate: string;
  perceptions: number;
  period: string;
  status: "Pagado" | "Borrador";
};

const monthShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getQuincenaByOffset(offset: number, base = new Date()) {
  let year = base.getFullYear();
  let month = base.getMonth();
  let isSecond = base.getDate() > 15;

  for (let step = 0; step < offset; step += 1) {
    if (isSecond) {
      isSecond = false;
    } else {
      isSecond = true;
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthShort[month];
  const folioPart = `${year}-${String(month + 1).padStart(2, "0")}`;

  if (isSecond) {
    return {
      folioPart: `${folioPart}-2`,
      payDate: isoDate(new Date(year, month, lastDay)),
      period: `16 – ${lastDay} ${monthLabel} ${year}`,
      shortPayDay: `${lastDay} ${monthLabel}`,
      shortPayYear: String(year),
    };
  }

  return {
    folioPart: `${folioPart}-1`,
    payDate: isoDate(new Date(year, month, 15)),
    period: `01 – 15 ${monthLabel} ${year}`,
    shortPayDay: `15 ${monthLabel}`,
    shortPayYear: String(year),
  };
}

export function getPayCycleEyebrow(base = new Date()) {
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(base);
  return `CICLO DE PAGO · ${label.replace(" de ", " ").toUpperCase()}`;
}

export function buildHistorySeed(base = new Date()): PayrollRun[] {
  return [0, 1, 2, 3].map((offset, index) => {
    const quincena = getQuincenaByOffset(offset, base);
    return {
      id: `h${index + 1}`,
      folio: `NOM-${quincena.folioPart}`,
      period: quincena.period,
      payDate: quincena.payDate,
      employees: 25 - index,
      perceptions: 320000 - index * 4000,
      deductions: 67000 - index * 500,
      paid: 253000 - index * 3500,
      status: "Pagado" as const,
      downloaded: false,
    };
  });
}

export function getCurrentPayCycle(base = new Date()) {
  const quincena = getQuincenaByOffset(0, base);
  return {
    ...quincena,
    eyebrow: getPayCycleEyebrow(base),
    folioPrefix: `NOM-${quincena.folioPart.split("-").slice(0, 2).join("-")}`,
  };
}
