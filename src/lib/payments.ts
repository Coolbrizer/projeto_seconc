import { getSupabase } from "@/lib/supabase";
import type { DashboardData, PaymentRecord } from "@/types/payment";

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
    let s = value.trim().replace(/\u00a0/g, " ");
    // Células no Supabase podem vir como "R$ 3.816,31" (varchar)
    s = s.replace(/^(R\$\s*)/i, "").trim();
    if (!s || s === "-" || s === "—") return 0;
    const normalized = s.replace(/\./g, "").replace(",", ".");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

function getUfFromRow(row: Record<string, unknown>): string {
  const raw = row.uf ?? row.UF;
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function normalizeTableRows(rows: Array<Record<string, unknown>>, source: "coord" | "uf") {
  const nowIso = new Date().toISOString();
  const records: PaymentRecord[] = [];

  rows.forEach((row, rowIndex) => {
    const uf = getUfFromRow(row);
    if (!uf) return;

    Object.entries(row).forEach(([columnName, value]) => {
      if (columnName.toLowerCase() === "uf") return;
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
  const supabase = getSupabase();
  if (!supabase) {
    return {
      payments: [],
      enrolledByUf: {},
      dataNotice: "missing_supabase",
    };
  }

  const payments: PaymentRecord[] = [];

  for (const sourceTable of sourceTables) {
    const { data, error } = await supabase.from(sourceTable.table).select("*");
    if (error) {
      console.error(`Erro ao buscar tabela ${sourceTable.table}:`, error.message);
      return {
        payments: [],
        enrolledByUf: {},
        dataNotice: "supabase_fetch_error",
      };
    }

    payments.push(...normalizeTableRows((data ?? []) as Array<Record<string, unknown>>, sourceTable.source));
  }

  const { data: enrolledRows, error: enrolledError } = await supabase
    .from("qtd_inscrit_uf")
    .select("uf, qtd_inscrit");

  if (enrolledError) {
    console.error("Erro ao buscar tabela qtd_inscrit_uf:", enrolledError.message);
    return {
      payments: payments.sort((a, b) => a.reference_month.localeCompare(b.reference_month)),
      enrolledByUf: {},
      enrolledUnavailable: true,
    };
  }

  const enrolledByUf = (enrolledRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const r = row as Record<string, unknown>;
    const uf = getUfFromRow(r);
    if (!uf) return acc;
    const qtd = r.qtd_inscrit ?? r.QTD_INSCRIT;
    acc[uf] = toNumericValue(qtd);
    return acc;
  }, {});

  return {
    payments: payments.sort((a, b) => a.reference_month.localeCompare(b.reference_month)),
    enrolledByUf,
  };
}
