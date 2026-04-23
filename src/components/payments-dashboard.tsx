"use client";

import { useMemo, useState } from "react";
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
  DashboardDataNotice,
  GratificacaoGpsRecord,
  PaymentRecord,
} from "@/types/payment";
import { GratificacaoGpsPanel } from "@/components/gratificacao-gps-panel";

type PaymentsDashboardProps = {
  payments: PaymentRecord[];
  bancaPayments: BancaPaymentRecord[];
  gratificacaoGps: GratificacaoGpsRecord[];
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

/** Só o mês (ex.: “jan.”), para chips compactos — o ano fica no título do bloco. */
function monthShortLabel(value: string) {
  const iso =
    value.length === 7 && /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "short" });
}

/** Duas linhas por ano: jan–jun e jul–dez (6 meses por linha). */
function monthsGridForYear(year: number): [string[], string[]] {
  const row1: string[] = [];
  const row2: string[] = [];
  for (let m = 1; m <= 6; m++) {
    row1.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  for (let m = 7; m <= 12; m++) {
    row2.push(`${year}-${String(m).padStart(2, "0")}`);
  }
  return [row1, row2];
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
  gratificacaoGps,
  enrolledByUf,
  dataNotice,
  enrolledUnavailable,
}: PaymentsDashboardProps) {
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  /** Vazio = todos os meses do período de ano selecionado. */
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<"both" | "2025" | "2026">("both");
  const [ufBarSort, setUfBarSort] = useState<UfBarSort>("amount-asc");
  const [unitChartSort, setUnitChartSort] = useState<UnitChartSort>("unit-desc");
  const [bancaYearFilter, setBancaYearFilter] = useState<BancaYearFilter>("both");
  const [bancaSort, setBancaSort] = useState<BancaSort>("chrono");
  const isClient = typeof window !== "undefined";

  const monthsInData = useMemo(
    () =>
      [...new Set(payments.map((payment) => payment.reference_month.slice(0, 7)))].sort(),
    [payments],
  );

  const yearCalendars = useMemo(() => {
    const years =
      selectedYear === "both" ? [2025, 2026] : selectedYear === "2025" ? [2025] : [2026];
    return years.map((y) => {
      const [rowA, rowB] = monthsGridForYear(y);
      return { year: y, rows: [rowA, rowB] as const };
    });
  }, [selectedYear]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const month = payment.reference_month.slice(0, 7);
      const year = payment.reference_month.slice(0, 4);
      if (selectedYear === "2025" && year !== "2025") return false;
      if (selectedYear === "2026" && year !== "2026") return false;
      if (selectedYear === "both" && year !== "2025" && year !== "2026") return false;
      const matchMonth =
        selectedMonths.length === 0 || selectedMonths.includes(month);
      const matchUf = selectedUfs.length === 0 || selectedUfs.includes(payment.uf);
      return matchMonth && matchUf;
    });
  }, [payments, selectedMonths, selectedUfs, selectedYear]);

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

  const totalValue = filteredPayments.reduce((acc, item) => acc + item.amount, 0);
  const totalRecords = filteredPayments.length;
  const avgValue = totalRecords > 0 ? totalValue / totalRecords : 0;
  const totalEnrolled = (selectedUfs.length === 0 ? [...ALL_UFS] : selectedUfs).reduce(
    (acc, uf) => acc + (enrolledByUf[uf] ?? 0),
    0,
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

  const totalsByMonth = (() => {
    const grouped = new Map<string, number>();
    filteredPayments.forEach((item) => {
      const month = item.reference_month.slice(0, 7);
      grouped.set(month, (grouped.get(month) ?? 0) + item.amount);
    });
    return Array.from(grouped.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  })();

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

  function toggleMonth(month: string) {
    setSelectedMonths((current) =>
      current.includes(month) ? current.filter((m) => m !== month) : [...current, month],
    );
  }

  const yearFilterLabel =
    selectedYear === "both" ? "2025 + 2026" : selectedYear === "2025" ? "Apenas 2025" : "Apenas 2026";

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-xl bg-blue-950 px-6 py-7 text-white shadow-lg">
        <h1 className="text-2xl font-bold md:text-3xl">Controle Orçamentário - 31º CPR</h1>
        <p className="mt-2 text-sm text-blue-100 md:text-base">
          Acompanhe gratificações no GPS (por equipe, data e ano) e os pagamentos mensais por UF com filtros
          dinâmicos.
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

      <div className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
        <article className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Total filtrado</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{currency.format(totalValue)}</p>
        </article>
        <article className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Registros</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalRecords}</p>
        </article>
        <article className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Média por lançamento</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{currency.format(avgValue)}</p>
        </article>
        <article
          className="rounded-lg bg-slate-50 p-4"
          title={
            enrolledUnavailable
              ? "Para exibir inscritos: no Supabase, crie política SELECT na tabela qtd_inscrit_uf para o papel anon (como nas tabelas pgto_*)."
              : undefined
          }
        >
          <p className="text-sm text-slate-500">Qtd. inscritos (total UF)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {enrolledUnavailable ? "—" : totalEnrolled.toLocaleString("pt-BR")}
          </p>
          {!enrolledUnavailable && (
            <details className="mt-3 group">
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

      <GratificacaoGpsPanel rows={gratificacaoGps} />

      <article className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gastos por UF</h2>
            <p className="mt-1 text-sm text-slate-600">
              Somatório por UF considerando somente pagamentos das tabelas{" "}
              <code className="rounded bg-slate-100 px-1">pgto_uf_2025</code> e{" "}
              <code className="rounded bg-slate-100 px-1">pgto_uf_2026</code> ({yearFilterLabel}
              {selectedMonths.length > 0 ? ` · ${selectedMonths.length} mês(es)` : " · todos os meses"}).
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
                  setSelectedMonths([]);
                }}
              >
                <option value="both">2025 + 2026 (somatório geral)</option>
                <option value="2025">Apenas 2025</option>
                <option value="2026">Apenas 2026</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Meses (vazio = todos do período)</p>
              {selectedMonths.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMonths([])}
                  className="text-xs font-medium text-blue-700 underline decoration-blue-400 hover:text-blue-900"
                >
                  Limpar meses
                </button>
              )}
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-2 sm:p-3">
              <div
                className={
                  yearCalendars.length > 1
                    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3"
                    : "grid grid-cols-1"
                }
              >
                {yearCalendars.map(({ year, rows }) => (
                  <div
                    key={year}
                    className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:p-2.5"
                  >
                    <p className="mb-2 text-center text-xs font-semibold text-slate-800 sm:text-sm">
                      {year}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {rows.map((rowMonths) => (
                        <div
                          key={rowMonths[0]}
                          className="grid grid-cols-6 gap-1"
                        >
                          {rowMonths.map((month) => {
                            const active = selectedMonths.includes(month);
                            const hasData = monthsInData.includes(month);
                            return (
                              <button
                                key={month}
                                type="button"
                                title={
                                  (hasData
                                    ? "Há lançamentos — "
                                    : "Sem lançamentos — ") + monthLabel(month)
                                }
                                onClick={() => toggleMonth(month)}
                                className={`min-w-0 rounded-md border px-0.5 py-1.5 text-center text-[9px] leading-none transition sm:text-[10px] ${
                                  active
                                    ? "border-teal-600 bg-teal-600 text-white"
                                    : hasData
                                      ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                      : "border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                                }`}
                              >
                                {monthShortLabel(month)}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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

      <article className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gasto por inscrito (UF)</h2>
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

      <article className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Coordenação - evolução mensal</h2>
        <p className="mb-3 text-sm text-slate-600">
          Valores mensais exclusivos da Coordenação (tabelas{" "}
          <code className="rounded bg-slate-100 px-1">pgto_coord_2025</code> e{" "}
          <code className="rounded bg-slate-100 px-1">pgto_coord_2026</code>), respeitando os filtros de
          ano, meses e UF.
        </p>
        <div className="h-80">
          {isClient && (
            <ResponsiveContainer width="98%" height="100%">
              <LineChart data={coordTotalsByMonth} margin={{ left: 20, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={monthLabel} />
                <YAxis tickFormatter={formatCurrency} width={84} />
                <Tooltip
                  formatter={formatCurrency}
                  labelFormatter={(label) => monthLabel(label)}
                />
                <Line dataKey="amount" type="monotone" stroke="#2563eb" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="rounded-xl bg-white p-4 shadow-sm md:p-6">
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

      <article className="rounded-xl bg-white p-4 shadow-sm">
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
