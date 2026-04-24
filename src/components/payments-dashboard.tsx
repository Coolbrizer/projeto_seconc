"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BancaPaymentRecord,
  ComissaoMedicaPaymentRecord,
  DashboardDataNotice,
  ExecucaoPaymentRecord,
  FiscalizacaoPaymentRecord,
  PaymentRecord,
} from "@/types/payment";

type PaymentsDashboardProps = {
  payments: PaymentRecord[];
  bancaPayments: BancaPaymentRecord[];
  fiscalizacaoPayments: FiscalizacaoPaymentRecord[];
  comissaoMedicaPayments: ComissaoMedicaPaymentRecord[];
  execucaoPayments: ExecucaoPaymentRecord[];
  enrolledByUf: Record<string, number>;
  dataNotice?: DashboardDataNotice;
  enrolledUnavailable?: boolean;
};

/** Todas as UFs para o gráfico principal (somatório 2025 + 2026 por padrão). */
const ALL_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const currencyFine = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return currency.format(Number.isFinite(numericValue) ? numericValue : 0);
}

function monthLabel(value: string) {
  const iso =
    value.length === 7 && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

/** Ordenação de rótulos de mês em português (comissão médica). */
function mesCalendarioOrdem(mes: string): number {
  const k = mes.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const order: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    março: 3,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };
  return order[k] ?? 100;
}

function matchesDashboardYear(ano: number, selectedYear: "both" | "2025" | "2026"): boolean {
  if (selectedYear === "2025") return ano === 2025;
  if (selectedYear === "2026") return ano === 2026;
  return ano === 2025 || ano === 2026;
}

const dataNoticeText: Record<DashboardDataNotice, string> = {
  missing_supabase:
    "Não há conexão com o Supabase (variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes ou inválidas). O gráfico de valores usa apenas os lançamentos das tabelas pgto_* — configure o ambiente para ver os totais reais.",
  supabase_fetch_error:
    "Falha ao ler as tabelas de pagamento no Supabase. Verifique nomes das tabelas, políticas RLS e a chave anon. Nenhum valor de demonstração é exibido.",
};

type UfBarSort = "uf-asc" | "amount-asc" | "amount-desc";
type UnitChartSort =
  | "spent-asc"
  | "spent-desc"
  | "enrolled-asc"
  | "enrolled-desc"
  | "unit-asc"
  | "unit-desc";
type BancaYearFilter = "both" | "2025" | "2026";
type BancaSort = "chrono" | "amount-asc" | "amount-desc";

export function PaymentsDashboard({
  payments,
  bancaPayments,
  fiscalizacaoPayments,
  comissaoMedicaPayments,
  execucaoPayments,
  enrolledByUf,
  dataNotice,
  enrolledUnavailable,
}: PaymentsDashboardProps) {
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<"both" | "2025" | "2026">("both");
  const [ufBarSort, setUfBarSort] = useState<UfBarSort>("amount-asc");
  const [unitChartSort, setUnitChartSort] = useState<UnitChartSort>("unit-desc");
  const [bancaYearFilter, setBancaYearFilter] = useState<BancaYearFilter>("both");
  const [bancaSort, setBancaSort] = useState<BancaSort>("chrono");
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const year = payment.reference_month.slice(0, 4);
      if (selectedYear === "2025" && year !== "2025") return false;
      if (selectedYear === "2026" && year !== "2026") return false;
      if (selectedYear === "both" && year !== "2025" && year !== "2026") return false;
      const matchUf = selectedUfs.length === 0 || selectedUfs.includes(payment.uf);
      return matchUf;
    });
  }, [payments, selectedUfs, selectedYear]);

  const ufOnlyFilteredPayments = useMemo(
    () => filteredPayments.filter((payment) => payment.source === "uf"),
    [filteredPayments],
  );

  const coordOnlyFilteredPayments = useMemo(
    () => filteredPayments.filter((payment) => payment.source === "coord"),
    [filteredPayments],
  );

  /** Banca: só filtro por ano (coluna `ano`); não há UF nem mês na tabela. */
  const filteredBancaRows = useMemo(() => {
    return bancaPayments.filter((row) => {
      if (bancaYearFilter === "2025" && row.ano !== 2025) return false;
      if (bancaYearFilter === "2026" && row.ano !== 2026) return false;
      if (bancaYearFilter === "both" && row.ano !== 2025 && row.ano !== 2026) return false;
      return true;
    });
  }, [bancaPayments, bancaYearFilter]);

  const bancaChartData = useMemo(() => {
    const rows = [...filteredBancaRows];
    switch (bancaSort) {
      case "chrono":
        rows.sort((a, b) => {
          const aOrder = a.ordem ?? Number.POSITIVE_INFINITY;
          const bOrder = b.ordem ?? Number.POSITIVE_INFINITY;
          return aOrder - bOrder || a.ano - b.ano || a.atv.localeCompare(b.atv);
        });
        break;
      case "amount-asc":
        rows.sort((a, b) => a.amount - b.amount);
        break;
      case "amount-desc":
        rows.sort((a, b) => b.amount - a.amount);
        break;
      default:
        break;
    }
    return rows.map((row) => ({
      ...row,
      atvLabel: row.atv.length > 48 ? `${row.atv.slice(0, 46).trim()}…` : row.atv,
    }));
  }, [filteredBancaRows, bancaSort]);

  /** Somatórios da tabela pgto_banca (independente do filtro de ano do gráfico). */
  const bancaTotalsSummary = useMemo(() => {
    let total = 0;
    let total2025 = 0;
    let total2026 = 0;
    for (const row of bancaPayments) {
      total += row.amount;
      if (row.ano === 2025) total2025 += row.amount;
      if (row.ano === 2026) total2026 += row.amount;
    }
    return { total, total2025, total2026 };
  }, [bancaPayments]);

  const fiscalChartRows = useMemo(() => {
    const rows = fiscalizacaoPayments.filter((r) => matchesDashboardYear(r.ano, selectedYear));
    rows.sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
    return rows.map((r) => ({
      ...r,
      tipoLabel: r.tipo.length > 42 ? `${r.tipo.slice(0, 40).trim()}…` : r.tipo,
    }));
  }, [fiscalizacaoPayments, selectedYear]);

  const fiscalTotalFiltered = useMemo(
    () => fiscalChartRows.reduce((acc, r) => acc + r.amount, 0),
    [fiscalChartRows],
  );

  const comissaoChartRows = useMemo(() => {
    const rows = comissaoMedicaPayments.filter((r) => matchesDashboardYear(r.ano, selectedYear));
    rows.sort(
      (a, b) =>
        mesCalendarioOrdem(a.mes) - mesCalendarioOrdem(b.mes) ||
        a.mes.localeCompare(b.mes, "pt-BR"),
    );
    return rows;
  }, [comissaoMedicaPayments, selectedYear]);

  const comissaoTotalFiltered = useMemo(
    () => comissaoChartRows.reduce((acc, r) => acc + r.amount, 0),
    [comissaoChartRows],
  );

  const totalValue = filteredPayments.reduce((acc, item) => acc + item.amount, 0);
  const totalEnrolled = (selectedUfs.length === 0 ? [...ALL_UFS] : selectedUfs).reduce(
    (acc, uf) => acc + (enrolledByUf[uf] ?? 0),
    0,
  );

  /** Somatórios consolidados (todos os anos, todos os grupos) — não respeita filtros. */
  const overviewTotals = useMemo(() => {
    const sub = payments
      .filter((p) => p.source === "uf")
      .reduce((acc, p) => acc + p.amount, 0);
    const coord = payments
      .filter((p) => p.source === "coord")
      .reduce((acc, p) => acc + p.amount, 0);
    const banca = bancaPayments.reduce((acc, r) => acc + r.amount, 0);
    const fiscal = fiscalizacaoPayments.reduce((acc, r) => acc + r.amount, 0);
    const comissao = comissaoMedicaPayments.reduce((acc, r) => acc + r.amount, 0);
    const execucao = execucaoPayments.reduce((acc, r) => acc + r.amount, 0);
    const grandTotal = sub + coord + banca + fiscal + comissao + execucao;
    return { sub, coord, banca, fiscal, comissao, execucao, grandTotal };
  }, [payments, bancaPayments, fiscalizacaoPayments, comissaoMedicaPayments, execucaoPayments]);

  const overviewByYear = useMemo(() => {
    const acc = new Map<number, number>();
    const add = (ano: number, v: number) => acc.set(ano, (acc.get(ano) ?? 0) + v);
    for (const p of payments) {
      const y = Number(p.reference_month.slice(0, 4));
      if (Number.isFinite(y)) add(y, p.amount);
    }
    for (const r of bancaPayments) add(r.ano, r.amount);
    for (const r of fiscalizacaoPayments) add(r.ano, r.amount);
    for (const r of comissaoMedicaPayments) add(r.ano, r.amount);
    for (const r of execucaoPayments) add(r.ano, r.amount);
    return [...acc.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([ano, total]) => ({ ano, total }));
  }, [payments, bancaPayments, fiscalizacaoPayments, comissaoMedicaPayments, execucaoPayments]);

  const overviewGroups = useMemo(() => {
    const { sub, coord, fiscal, banca, comissao, grandTotal } = overviewTotals;
    const pct = (v: number) => (grandTotal > 0 ? (v / grandTotal) * 100 : 0);
    // Execução entra no somatório total, mas não é apresentada como grupo nos gráficos/cards.
    return [
      {
        grupo: "Subcomissões Estaduais",
        total: sub,
        pct: pct(sub),
        color: "#2563eb",
        anchor: "#detalhe-subcomissoes",
      },
      {
        grupo: "Coordenação Nacional",
        total: coord,
        pct: pct(coord),
        color: "#1d4ed8",
        anchor: "#detalhe-coord-nacional",
      },
      {
        grupo: "Aplicação de Prova",
        total: fiscal,
        pct: pct(fiscal),
        color: "#0369a1",
        anchor: "#detalhe-aplicacao-prova",
      },
      {
        grupo: "Banca Examinadora",
        total: banca,
        pct: pct(banca),
        color: "#0d9488",
        anchor: "#detalhe-banca",
      },
      {
        grupo: "Comissão Especial de Avaliação",
        total: comissao,
        pct: pct(comissao),
        color: "#c2410c",
        anchor: "#detalhe-comissao-especial",
      },
    ];
  }, [overviewTotals]);

  const overviewGroupsChartData = useMemo(
    () =>
      overviewGroups.map((g) => ({
        ...g,
        grupoLabel: g.grupo.length > 24 ? `${g.grupo.slice(0, 22).trim()}…` : g.grupo,
      })),
    [overviewGroups],
  );

  /** Barras fixas por UF (todas as UFs ou só as selecionadas), ordem estável. */
  const totalsByUfBarChart = useMemo(() => {
    const displayUfs =
      selectedUfs.length > 0
        ? [...selectedUfs].sort((a, b) => a.localeCompare(b))
        : [...ALL_UFS];
    const grouped = new Map<string, number>();
    displayUfs.forEach((uf) => grouped.set(uf, 0));
    ufOnlyFilteredPayments.forEach((item) => {
      if (!grouped.has(item.uf)) return;
      grouped.set(item.uf, (grouped.get(item.uf) ?? 0) + item.amount);
    });
    return displayUfs.map((uf) => ({ uf, amount: grouped.get(uf) ?? 0 }));
  }, [selectedUfs, ufOnlyFilteredPayments]);

  const totalsByUfBarChartSorted = useMemo(() => {
    const rows = [...totalsByUfBarChart];
    switch (ufBarSort) {
      case "uf-asc":
        rows.sort((a, b) => a.uf.localeCompare(b.uf));
        break;
      case "amount-asc":
        rows.sort((a, b) => a.amount - b.amount);
        break;
      case "amount-desc":
        rows.sort((a, b) => b.amount - a.amount);
        break;
      default:
        break;
    }
    return rows;
  }, [totalsByUfBarChart, ufBarSort]);

  const unitPerUfRows = useMemo(() => {
    const displayUfs =
      selectedUfs.length > 0
        ? [...selectedUfs].sort((a, b) => a.localeCompare(b))
        : [...ALL_UFS];
    const spentMap = new Map<string, number>();
    filteredPayments.forEach((item) => {
      spentMap.set(item.uf, (spentMap.get(item.uf) ?? 0) + item.amount);
    });
    return displayUfs.map((uf) => {
      const spent = spentMap.get(uf) ?? 0;
      const enrolled = enrolledByUf[uf] ?? 0;
      const unit = enrolled > 0 ? spent / enrolled : null;
      return { uf, spent, enrolled, unit };
    });
  }, [filteredPayments, selectedUfs, enrolledByUf]);

  const unitChartDataSorted = useMemo(() => {
    const rows = [...unitPerUfRows];
    const nullLast = (u: number | null) => (u == null || Number.isNaN(u) ? Number.POSITIVE_INFINITY : u);
    switch (unitChartSort) {
      case "spent-asc":
        rows.sort((a, b) => a.spent - b.spent);
        break;
      case "spent-desc":
        rows.sort((a, b) => b.spent - a.spent);
        break;
      case "enrolled-asc":
        rows.sort((a, b) => a.enrolled - b.enrolled);
        break;
      case "enrolled-desc":
        rows.sort((a, b) => b.enrolled - a.enrolled);
        break;
      case "unit-asc":
        rows.sort((a, b) => nullLast(a.unit) - nullLast(b.unit));
        break;
      case "unit-desc":
        rows.sort((a, b) => nullLast(b.unit) - nullLast(a.unit));
        break;
      default:
        break;
    }
    return rows;
  }, [unitPerUfRows, unitChartSort]);

  const totalsByMonth = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredPayments.forEach((item) => {
      const month = item.reference_month.slice(0, 7);
      grouped.set(month, (grouped.get(month) ?? 0) + item.amount);
    });
    return Array.from(grouped.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredPayments]);

  const coordTotalsByMonth = useMemo(() => {
    const grouped = new Map<string, number>();
    coordOnlyFilteredPayments.forEach((item) => {
      const month = item.reference_month.slice(0, 7);
      grouped.set(month, (grouped.get(month) ?? 0) + item.amount);
    });
    return Array.from(grouped.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [coordOnlyFilteredPayments]);

  function toggleUf(uf: string) {
    setSelectedUfs((current) =>
      current.includes(uf) ? current.filter((value) => value !== uf) : [...current, uf],
    );
  }

  const yearFilterLabel =
    selectedYear === "both" ? "2025 + 2026" : selectedYear === "2025" ? "Apenas 2025" : "Apenas 2026";

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-xl bg-blue-950 px-6 py-7 text-white shadow-lg">
        <h1 className="text-2xl font-bold md:text-3xl">Controle Orçamentário - 31º CPR</h1>
        <p className="mt-2 text-sm text-blue-100 md:text-base">
          Visão consolidada de todos os grupos de despesa do concurso, com a opção de detalhar cada
          tipo de pagamento.
        </p>
      </header>

      {dataNotice && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
        >
          <p className="font-medium text-amber-900">Aviso de dados</p>
          <p className="mt-1 leading-relaxed">{dataNoticeText[dataNotice]}</p>
        </div>
      )}

      <section
        aria-label="Visão geral do concurso"
        className="overflow-hidden rounded-xl bg-white shadow-sm"
      >
        <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 px-6 py-7 text-white md:px-8 md:py-9">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200">
            Total gasto no concurso (todos os grupos e anos)
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums md:text-5xl">
            {currency.format(overviewTotals.grandTotal)}
          </p>
          {overviewByYear.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {overviewByYear.map((y) => (
                <span
                  key={y.ano}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-blue-50 ring-1 ring-inset ring-white/20"
                >
                  {y.ano}:{" "}
                  <span className="font-semibold tabular-nums">{currency.format(y.total)}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-5 md:px-8 md:py-6">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Distribuição por grupo de despesa
            </h2>
            <p className="text-xs text-slate-500">
              Clique em &quot;Detalhar&quot; para aprofundar em qualquer grupo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overviewGroups.map((g) => (
              <article
                key={g.grupo}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">{g.grupo}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                    {currency.format(g.total)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {g.pct.toFixed(1).replace(".", ",")}% do total
                  </p>
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                    <div
                      style={{ width: `${Math.max(g.pct, g.total > 0 ? 2 : 0)}%`, backgroundColor: g.color }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                  <a
                    href={g.anchor}
                    className="mt-2 inline-block text-xs font-medium text-blue-700 underline decoration-blue-300 hover:text-blue-900"
                  >
                    Detalhar esse grupo →
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 h-[min(22rem,52vh)] w-full min-h-[14rem] rounded-lg border border-slate-100 bg-white p-2">
            {isClient && overviewTotals.grandTotal > 0 && (
              <ResponsiveContainer width="98%" height="100%">
                <BarChart
                  data={overviewGroupsChartData}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis
                    dataKey="grupoLabel"
                    type="category"
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const p = payload[0].payload as (typeof overviewGroupsChartData)[number];
                      return (
                        <div className="max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                          <p className="font-medium text-slate-900">{p.grupo}</p>
                          <p className="mt-1 text-slate-700">
                            {formatCurrency(p.total)}{" "}
                            <span className="text-slate-500">
                              ({p.pct.toFixed(1).replace(".", ",")}% do total)
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} name="Total" minPointSize={2}>
                    {overviewGroupsChartData.map((entry) => (
                      <Cell key={entry.grupo} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {isClient && overviewTotals.grandTotal === 0 && (
              <p className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                Ainda não há valores consolidados para exibir. Verifique as tabelas pgto_* no Supabase.
              </p>
            )}
          </div>
        </div>
      </section>

      <nav
        aria-label="Ir para um tipo de despesa"
        className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm shadow-sm"
      >
        <span className="text-slate-500">Detalhar:</span>
        <a
          href="#detalhe-subcomissoes"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Subcomissões Estaduais
        </a>
        <a
          href="#detalhe-coord-nacional"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Coordenação Nacional
        </a>
        <a
          href="#detalhe-aplicacao-prova"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Aplicação de Prova
        </a>
        <a
          href="#detalhe-comissao-especial"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Comissão Especial
        </a>
        <a
          href="#detalhe-banca"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Banca Examinadora
        </a>
        <a
          href="#detalhe-despesa-inscrito"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Despesa por Inscrito
        </a>
        <a
          href="#detalhe-evolucao"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
        >
          Evolução mensal
        </a>
      </nav>

      <article
        id="detalhe-subcomissoes"
        className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20 md:p-6"
      >
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Pagamentos das Subcomissões Estaduais
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Somatório por UF considerando somente pagamentos das tabelas{" "}
              <code className="rounded bg-slate-100 px-1">pgto_uf_2025</code> e{" "}
              <code className="rounded bg-slate-100 px-1">pgto_uf_2026</code> ({yearFilterLabel}; soma de
              todos os meses do período).
              UFs sem lançamento no período aparecem com total R$ 0 (barra cinza).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Ano</p>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
                value={selectedYear}
                onChange={(event) => {
                  setSelectedYear(event.target.value as "both" | "2025" | "2026");
                }}
              >
                <option value="both">2025 + 2026 (somatório geral)</option>
                <option value="2025">Apenas 2025</option>
                <option value="2026">Apenas 2026</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              UFs (vazio = todas as 27 UFs no gráfico; role a lista)
            </p>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap gap-2">
                {ALL_UFS.map((uf) => {
                  const active = selectedUfs.includes(uf);
                  return (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => toggleUf(uf)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition md:text-sm ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {uf}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total no filtro (Subcomissões + Coordenação)
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {currency.format(totalValue)}
            </p>
          </article>
          <article
            className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
            title={
              enrolledUnavailable
                ? "Para exibir inscritos: no Supabase, crie política SELECT na tabela qtd_inscrit_uf para o papel anon."
                : undefined
            }
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Qtd. inscritos (UFs no filtro)
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {enrolledUnavailable ? "—" : totalEnrolled.toLocaleString("pt-BR")}
            </p>
            {!enrolledUnavailable && (
              <details className="mt-2 group">
                <summary className="cursor-pointer list-none text-xs font-medium text-blue-700 underline decoration-blue-300 hover:text-blue-900 [&::-webkit-details-marker]:hidden">
                  Ver quantidade por UF
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white text-xs">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">UF</th>
                        <th className="px-2 py-1.5 font-medium text-right">Inscritos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_UFS.map((uf) => (
                        <tr key={uf} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono">{uf}</td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {(enrolledByUf[uf] ?? 0).toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </article>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-700">Ordenação das barras</p>
          <select
            className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm text-black sm:w-auto"
            value={ufBarSort}
            onChange={(e) => setUfBarSort(e.target.value as UfBarSort)}
          >
            <option value="uf-asc">UF (A–Z)</option>
            <option value="amount-asc">Valor total (crescente)</option>
            <option value="amount-desc">Valor total (decrescente)</option>
          </select>
        </div>

        <div className="mt-4 h-[min(28rem,70vh)] w-full min-h-[20rem]">
          {isClient && (
            <ResponsiveContainer width="98%" height="100%">
              <BarChart
                data={totalsByUfBarChartSorted}
                margin={{ bottom: 8, left: 20, right: 8, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="uf" interval={0} tick={{ fontSize: 10 }} height={36} />
                <YAxis tickFormatter={formatCurrency} width={84} />
                <Tooltip formatter={formatCurrency} />
                <Bar
                  dataKey="amount"
                  radius={[6, 6, 0, 0]}
                  name="Total"
                  minPointSize={3}
                >
                  {totalsByUfBarChartSorted.map((entry) => (
                    <Cell
                      key={entry.uf}
                      fill={entry.amount > 0 ? "#2563eb" : "#e2e8f0"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article
        id="detalhe-despesa-inscrito"
        className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20 md:p-6"
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Despesa por Inscrito</h2>
            <p className="mt-1 text-sm text-slate-600">
              Valor total filtrado (Coord + UF) ÷ quantidade de inscritos por UF. Sem inscritos: barra
              zerada.
              {enrolledUnavailable && (
                <span className="mt-1 block text-amber-800">
                  Inscritos indisponíveis — este gráfico não reflete R$/inscrito até a tabela{" "}
                  <code className="rounded bg-amber-100 px-1">qtd_inscrit_uf</code> ser lida.
                </span>
              )}
            </p>
          </div>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black sm:max-w-md"
            value={unitChartSort}
            onChange={(e) => setUnitChartSort(e.target.value as UnitChartSort)}
          >
            <option value="spent-asc">Ordenar: gasto total (crescente)</option>
            <option value="spent-desc">Ordenar: gasto total (decrescente)</option>
            <option value="enrolled-asc">Ordenar: inscritos (crescente)</option>
            <option value="enrolled-desc">Ordenar: inscritos (decrescente)</option>
            <option value="unit-asc">Ordenar: R$ / inscrito (crescente)</option>
            <option value="unit-desc">Ordenar: R$ / inscrito (decrescente)</option>
          </select>
        </div>
        <div className="h-[min(26rem,65vh)] w-full min-h-[18rem]">
          {isClient && (
            <ResponsiveContainer width="98%" height="100%">
              <BarChart
                data={unitChartDataSorted.map((r) => ({
                  ...r,
                  unitBar: r.unit ?? 0,
                }))}
                margin={{ bottom: 8, left: 20, right: 8, top: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="uf" interval={0} tick={{ fontSize: 10 }} height={36} />
                <YAxis tickFormatter={(v) => currencyFine.format(v)} width={90} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as {
                      uf: string;
                      spent: number;
                      enrolled: number;
                      unit: number | null;
                    };
                    return (
                      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="font-semibold text-slate-900">{p.uf}</p>
                        {p.enrolled === 0 ? (
                          <p className="mt-1 text-slate-600">Sem inscritos — não há R$/inscrito.</p>
                        ) : (
                          <div className="mt-1 space-y-0.5 text-slate-700">
                            <p>
                              <span className="text-slate-500">Por inscrito:</span>{" "}
                              {currencyFine.format(p.unit ?? 0)}
                            </p>
                            <p className="text-slate-500">
                              Total: {currency.format(p.spent)} ÷ {p.enrolled} inscritos
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="unitBar" name="R$ / inscrito" radius={[6, 6, 0, 0]} minPointSize={2}>
                  {unitChartDataSorted.map((entry) => (
                    <Cell
                      key={entry.uf}
                      fill={
                        entry.enrolled === 0
                          ? "#e2e8f0"
                          : entry.unit != null && entry.unit > 0
                            ? "#7c3aed"
                            : "#e2e8f0"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article id="detalhe-coord-nacional" className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Pagamentos da Coordenação Nacional
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Valores mensais da coordenação nacional (tabelas{" "}
          <code className="rounded bg-slate-100 px-1">pgto_coord_2025</code> e{" "}
          <code className="rounded bg-slate-100 px-1">pgto_coord_2026</code>), respeitando os filtros de
          ano e UF.
        </p>
        <div className="h-80">
          {isClient && (
            <ResponsiveContainer width="98%" height="100%">
              <BarChart data={coordTotalsByMonth} margin={{ left: 20, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={monthLabel} />
                <YAxis tickFormatter={formatCurrency} width={84} />
                <Tooltip
                  formatter={formatCurrency}
                  labelFormatter={(label) => monthLabel(label)}
                />
                <Bar
                  dataKey="amount"
                  name="Coordenação nacional"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article
        id="detalhe-aplicacao-prova"
        className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20 md:p-6"
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Aplicação de Prova</h2>
        <p className="mb-4 text-sm text-slate-600">
          Valores da tabela <code className="rounded bg-slate-100 px-1">pgto_fiscalizacao</code> (tipo de
          aplicação, valor, ano). O mesmo filtro <strong>Ano</strong> da seção &quot;Pagamentos das
          Subcomissões Estaduais&quot; aplica-se
          aqui (2025, 2026 ou ambos).
        </p>
        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total no período filtrado</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(fiscalTotalFiltered)}
          </p>
        </div>
        <div className="h-[min(22rem,55vh)] w-full min-h-[14rem]">
          {isClient && fiscalChartRows.length > 0 && (
            <ResponsiveContainer width="98%" height="100%">
              <BarChart data={fiscalChartRows} margin={{ left: 12, right: 8, top: 8, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="tipoLabel"
                  type="category"
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={72}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v) => formatCurrency(v)} width={84} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as FiscalizacaoPaymentRecord & { tipoLabel: string };
                    return (
                      <div className="max-w-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="font-medium text-slate-900">{p.tipo}</p>
                        <p className="mt-1 text-sky-800">{formatCurrency(p.amount)}</p>
                        <p className="text-slate-500">Ano: {p.ano}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amount" name="Valor" fill="#0369a1" radius={[6, 6, 0, 0]} maxBarSize={72} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {isClient && fiscalChartRows.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
              Nenhum registro para o ano selecionado ou tabela vazia / sem permissão de leitura.
            </p>
          )}
        </div>
      </article>

      <article
        id="detalhe-comissao-especial"
        className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20 md:p-6"
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Comissão Especial de Avaliação</h2>
        <p className="mb-4 text-sm text-slate-600">
          Valores da tabela <code className="rounded bg-slate-100 px-1">pgto_comissao_medica</code> (mês,
          valor, ano). Usa o mesmo filtro <strong>Ano</strong> de &quot;Pagamentos das Subcomissões
          Estaduais&quot;.
        </p>
        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total no período filtrado</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrency(comissaoTotalFiltered)}
          </p>
        </div>
        <div className="h-[min(22rem,55vh)] w-full min-h-[14rem]">
          {isClient && comissaoChartRows.length > 0 && (
            <ResponsiveContainer width="98%" height="100%">
              <BarChart data={comissaoChartRows} margin={{ left: 12, right: 8, top: 8, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" interval={0} tick={{ fontSize: 11 }} height={48} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} width={84} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as ComissaoMedicaPaymentRecord;
                    return (
                      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="font-medium capitalize text-slate-900">{p.mes}</p>
                        <p className="mt-1 text-orange-900">{formatCurrency(p.amount)}</p>
                        <p className="text-slate-500">Ano: {p.ano}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amount" name="Valor" fill="#c2410c" radius={[6, 6, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {isClient && comissaoChartRows.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
              Nenhum registro para o ano selecionado ou tabela vazia / sem permissão de leitura.
            </p>
          )}
        </div>
      </article>

      <article
        id="detalhe-banca"
        className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20 md:p-6"
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Pagamento à banca examinadora (31º CPR)</h2>
        <p className="mb-4 text-sm text-slate-600">
          Dados da tabela <code className="rounded bg-slate-100 px-1">pgto_banca</code> (atividade, valor,
          ano). Os filtros abaixo são exclusivos deste gráfico.
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Período da banca</p>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
              value={bancaYearFilter}
              onChange={(event) => setBancaYearFilter(event.target.value as BancaYearFilter)}
            >
              <option value="both">2025 + 2026 (somatório)</option>
              <option value="2025">Somente 2025</option>
              <option value="2026">Somente 2026</option>
            </select>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Ordenação</p>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-black"
              value={bancaSort}
              onChange={(event) => setBancaSort(event.target.value as BancaSort)}
            >
              <option value="chrono">Cronológica (2025 → 2026)</option>
              <option value="amount-asc">Valor (crescente)</option>
              <option value="amount-desc">Valor (decrescente)</option>
            </select>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <article className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {formatCurrency(bancaTotalsSummary.total)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total em 2025</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {formatCurrency(bancaTotalsSummary.total2025)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total em 2026</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {formatCurrency(bancaTotalsSummary.total2026)}
            </p>
          </article>
        </div>
        <div className="h-[min(28rem,70vh)] w-full min-h-[20rem]">
          {isClient && bancaChartData.length > 0 && (
            <ResponsiveContainer width="98%" height="100%">
              <BarChart
                data={bancaChartData}
                margin={{ left: 20, right: 12, top: 8, bottom: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="atvLabel"
                  type="category"
                  interval={0}
                  angle={-38}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 9 }}
                />
                <YAxis tickFormatter={(v) => formatCurrency(v)} width={84} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as BancaPaymentRecord & { atvLabel: string };
                    return (
                      <div className="max-w-md rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="font-medium leading-snug text-slate-900">{p.atv}</p>
                        <p className="mt-1 text-teal-800">{formatCurrency(p.amount)}</p>
                        <p className="text-slate-500">Ano: {p.ano}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amount" name="Valor" radius={[6, 6, 0, 0]} fill="#0d9488" minPointSize={2} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {isClient && bancaChartData.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
              Nenhum registro de banca para o ano selecionado ou tabela vazia / sem permissão de leitura.
            </p>
          )}
        </div>
      </article>

      <article id="detalhe-evolucao" className="rounded-xl bg-white p-4 shadow-sm scroll-mt-20">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Evolução mensal</h2>
        <div className="h-80">
          {isClient && (
            <ResponsiveContainer width="98%" height="100%">
              <LineChart data={totalsByMonth} margin={{ left: 20, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={monthLabel} />
                <YAxis tickFormatter={formatCurrency} width={84} />
                <Tooltip
                  formatter={formatCurrency}
                  labelFormatter={(label) => monthLabel(label)}
                />
                <Line dataKey="amount" type="monotone" stroke="#0d9488" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>
    </section>
  );
}
