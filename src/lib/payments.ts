import { getSupabase } from "@/lib/supabase";
import type { BancaPaymentRecord, DashboardData, PaymentRecord } from "@/types/payment";

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

/**
 * Colunas de mês no formato largo: `mar./25` (UF) ou `mar/25` (coord, sem ponto).
 */
function monthColumnToIsoDate(columnName: string) {
  const trimmed = columnName.trim();
  const parsed =
    trimmed.match(/^([a-z]{3})\.\/(\d{2})$/i) ?? trimmed.match(/^([a-z]{3})\/(\d{2})$/i);
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

/**
 * Quantidade de inscritos: inteiros ou texto "1.129" (mil cento e vinte e nove).
 * Se o banco entregar o float **1.129** em vez do inteiro **1129**, corrige só o caso **1.xxx**
 * (mil + xxx): `1.129` → 1129. Evita tratar 3,5 ou 12,5 como milhares.
 */
function parseInscritoCount(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return 0;
    if (value === Math.floor(value)) return Math.floor(value);
    const t = value.toFixed(3);
    const m = /^1\.(\d{3})$/.exec(t);
    if (m) {
      return 1000 + parseInt(m[1], 10);
    }
    return Math.round(value);
  }
  if (typeof value === "string") {
    return Math.round(toNumericValue(value));
  }
  return 0;
}

/** Colunas comuns para a sigla da UF (planilhas UF vs coord podem diferir). */
const UF_COLUMN_KEYS = [
  "uf",
  "UF",
  "estado",
  "Estado",
  "sigla",
  "Sigla",
  "SIGLA",
  "sigla_uf",
  "Sigla_UF",
];

const SKIP_NON_MONTH_KEYS = new Set(UF_COLUMN_KEYS.map((k) => k.toLowerCase()));

function getUfFromRow(row: Record<string, unknown>): string {
  for (const key of UF_COLUMN_KEYS) {
    const raw = row[key];
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (t.length === 2 && /^[A-Za-z]{2}$/.test(t)) {
      return t.toUpperCase();
    }
  }
  const fallback = row.uf ?? row.UF;
  return typeof fallback === "string" ? fallback.trim().toUpperCase() : "";
}

function normalizeTableRows(rows: Array<Record<string, unknown>>, source: "coord" | "uf") {
  const nowIso = new Date().toISOString();
  const records: PaymentRecord[] = [];

  rows.forEach((row, rowIndex) => {
    const uf = getUfFromRow(row);
    if (!uf) return;

    Object.entries(row).forEach(([columnName, value]) => {
      const col = columnName.trim();
      const colLower = col.toLowerCase();
      if (SKIP_NON_MONTH_KEYS.has(colLower)) return;
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

function parseAno(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const n = Number(value.trim().replace(",", "."));
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return null;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.floor(value);
    return n > 0 ? n : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) {
      const parsed = Math.floor(n);
      return parsed > 0 ? parsed : null;
    }
  }
  return null;
}

/** Tabela `pgto_banca`: colunas `atv` (PK), `valor` (varchar), `ano` (numeric), `ordem` (numeric). */
function normalizeBancaRows(rows: Array<Record<string, unknown>>): BancaPaymentRecord[] {
  const records: BancaPaymentRecord[] = [];

  rows.forEach((row, i) => {
    const atvRaw = row.atv ?? row.ATV ?? row.atividade;
    const atv = typeof atvRaw === "string" ? atvRaw.trim() : "";
    if (!atv) return;

    const ano = parseAno(row.ano ?? row.Ano);
    if (ano == null || ano < 2000 || ano > 2100) return;

    const valorRaw = row.valor ?? row.Valor;
    const amount = toNumericValue(valorRaw);
    if (amount <= 0) return;
    const ordem = parsePositiveInt(row.ordem ?? row.Ordem);

    const safeId = `${i}-${atv.slice(0, 24).replace(/\s+/g, "-")}`;
    records.push({
      id: `banca-${safeId}`,
      atv,
      ano,
      amount,
      ordem,
    });
  });

  return records;
}

function getQtdInscritFromRow(row: Record<string, unknown>): number | null {
  const keys = [
    "qtd_inscrit",
    "qtd_inscritos",
    "qtd_inscrit_uf",
    "QTD_INSCRIT",
    "QTD_INSCRITOS",
    "quantidade",
    "qtde_inscritos",
    "qtde",
    "qtd",
    "inscritos",
  ];
  for (const k of keys) {
    if (k in row) {
      const v = parseInscritoCount(row[k]);
      if (v >= 0) return v;
    }
  }
  return null;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      payments: [],
      bancaPayments: [],
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
        bancaPayments: [],
        enrolledByUf: {},
        dataNotice: "supabase_fetch_error",
      };
    }

    payments.push(...normalizeTableRows((data ?? []) as Array<Record<string, unknown>>, sourceTable.source));
  }

  let bancaPayments: BancaPaymentRecord[] = [];
  const bancaResult = await supabase.from("pgto_banca").select("*");
  if (bancaResult.error) {
    console.error("Erro ao buscar tabela pgto_banca:", bancaResult.error.message);
  } else {
    bancaPayments = normalizeBancaRows((bancaResult.data ?? []) as Array<Record<string, unknown>>);
  }

  const { data: enrolledRows, error: enrolledError } = await supabase
    .from("qtd_inscrit_uf")
    .select("*");

  if (enrolledError) {
    console.error("Erro ao buscar tabela qtd_inscrit_uf:", enrolledError.message);
    return {
      payments: payments.sort((a, b) => a.reference_month.localeCompare(b.reference_month)),
      bancaPayments: bancaPayments.sort((a, b) => a.atv.localeCompare(b.atv)),
      enrolledByUf: {},
      enrolledUnavailable: true,
    };
  }

  const enrolledByUf = (enrolledRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const r = row as Record<string, unknown>;
    const uf = getUfFromRow(r);
    if (!uf) return acc;
    const qtd = getQtdInscritFromRow(r);
    if (qtd == null) return acc;
    acc[uf] = qtd;
    return acc;
  }, {});

  return {
    payments: payments.sort((a, b) => a.reference_month.localeCompare(b.reference_month)),
    bancaPayments: bancaPayments.sort((a, b) => a.atv.localeCompare(b.atv)),
    enrolledByUf,
  };
}
