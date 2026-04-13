import { supabase } from "@/lib/supabase";
import type { DashboardData, PaymentRecord } from "@/types/payment";

const fallbackPayments: PaymentRecord[] = [
  {
    id: "1",
    uf: "SP",
    reference_month: "2026-01-01",
    amount: 340000,
    created_at: "2026-01-15T09:00:00Z",
    source: "coord",
  },
  {
    id: "2",
    uf: "RJ",
    reference_month: "2026-01-01",
    amount: 240000,
    created_at: "2026-01-15T09:00:00Z",
    source: "coord",
  },
  {
    id: "3",
    uf: "MG",
    reference_month: "2026-01-01",
    amount: 210000,
    created_at: "2026-01-15T09:00:00Z",
    source: "coord",
  },
  {
    id: "4",
    uf: "SP",
    reference_month: "2026-02-01",
    amount: 360000,
    created_at: "2026-02-15T09:00:00Z",
    source: "uf",
  },
  {
    id: "5",
    uf: "RJ",
    reference_month: "2026-02-01",
    amount: 255000,
    created_at: "2026-02-15T09:00:00Z",
    source: "uf",
  },
  {
    id: "6",
    uf: "MG",
    reference_month: "2026-02-01",
    amount: 218000,
    created_at: "2026-02-15T09:00:00Z",
    source: "uf",
  },
  {
    id: "7",
    uf: "BA",
    reference_month: "2026-03-01",
    amount: 175000,
    created_at: "2026-03-15T09:00:00Z",
    source: "coord",
  },
  {
    id: "8",
    uf: "SP",
    reference_month: "2026-03-01",
    amount: 372000,
    created_at: "2026-03-15T09:00:00Z",
    source: "uf",
  },
];

const fallbackEnrolledByUf: Record<string, number> = {
  SP: 1200,
  RJ: 980,
  MG: 870,
  BA: 640,
};

const monthMap: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

type SourceTable = {
  table: string;
  source: "coord" | "uf";
};

const sourceTables: SourceTable[] = [
  { table: "pgto_coord_2025", source: "coord" },
  { table: "pgto_coord_2026", source: "coord" },
  { table: "pgto_uf_2025", source: "uf" },
  { table: "pgto_uf_2026", source: "uf" },
];

function monthColumnToIsoDate(columnName: string) {
  const parsed = columnName.match(/^([a-z]{3})\.\/(\d{2})$/i);
  if (!parsed) {
    return null;
  }

  const monthKey = parsed[1].toLowerCase();
  const monthNumber = monthMap[monthKey];
  if (!monthNumber) {
    return null;
  }

  const year = `20${parsed[2]}`;
  return `${year}-${monthNumber}-01`;
}

function toNumericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

function normalizeTableRows(rows: Array<Record<string, unknown>>, source: "coord" | "uf") {
  const nowIso = new Date().toISOString();
  const records: PaymentRecord[] = [];

  rows.forEach((row, rowIndex) => {
    const ufRaw = row.uf;
    const uf = typeof ufRaw === "string" ? ufRaw.trim().toUpperCase() : "";
    if (!uf) return;

    Object.entries(row).forEach(([columnName, value]) => {
      if (columnName === "uf") return;
      const referenceMonth = monthColumnToIsoDate(columnName);
      if (!referenceMonth) return;

      const amount = toNumericValue(value);
      if (amount <= 0) return;

      records.push({
        id: `${source}-${uf}-${referenceMonth}-${rowIndex}`,
        uf,
        reference_month: referenceMonth,
        amount,
        created_at: nowIso,
        source,
      });
    });
  });

  return records;
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!supabase) {
    return { payments: fallbackPayments, enrolledByUf: fallbackEnrolledByUf };
  }

  const payments: PaymentRecord[] = [];

  for (const sourceTable of sourceTables) {
    const { data, error } = await supabase.from(sourceTable.table).select("*");
    if (error) {
      console.error(`Erro ao buscar tabela ${sourceTable.table}:`, error.message);
      return { payments: fallbackPayments, enrolledByUf: fallbackEnrolledByUf };
    }

    payments.push(...normalizeTableRows((data ?? []) as Array<Record<string, unknown>>, sourceTable.source));
  }

  const { data: enrolledRows, error: enrolledError } = await supabase
    .from("qtd_inscrit_uf")
    .select("uf, qtd_inscrit");

  if (enrolledError) {
    console.error("Erro ao buscar tabela qtd_inscrit_uf:", enrolledError.message);
    return {
      payments: payments.length > 0 ? payments : fallbackPayments,
      enrolledByUf: fallbackEnrolledByUf,
    };
  }

  const enrolledByUf = (enrolledRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const uf = typeof row.uf === "string" ? row.uf.trim().toUpperCase() : "";
    if (!uf) return acc;
    acc[uf] = toNumericValue(row.qtd_inscrit);
    return acc;
  }, {});

  return {
    payments: payments.sort((a, b) => a.reference_month.localeCompare(b.reference_month)),
    enrolledByUf: Object.keys(enrolledByUf).length > 0 ? enrolledByUf : fallbackEnrolledByUf,
  };
}
