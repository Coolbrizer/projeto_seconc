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
import type { DashboardDataNotice, PaymentRecord } from "@/types/payment";

type PaymentsDashboardProps = {
  payments: PaymentRecord[];
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

/** Meses do calendário (jan–dez) para os filtros, não só meses que já têm lançamento. */
function calendarMonthsForFilter(selectedYear: "both" | "2025" | "2026"): string[] {
  const years =
    selectedYear === "both" ? [2025, 2026] : selectedYear === "2025" ? [2025] : [2026];
  const months: string[] = [];
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return months;
}

const dataNoticeText: Record<DashboardDataNotice, string> = {
  missing_supabase:
    "Não há conexão com o Supabase (variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes ou inválidas). O gráfico de valores usa apenas os lançamentos das tabelas pgto_* — configure o ambiente para ver os totais reais.",
  supabase_fetch_error:
    "Falha ao ler as tabelas de pagamento no Supabase. Verifique nomes das tabelas, políticas RLS e a chave anon. Nenhum valor de demonstração é exibido.",
};

export function PaymentsDashboard({
  payments,
  enrolledByUf,
  dataNotice,
  enrolledUnavailable,
}: PaymentsDashboardProps) {
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  /** Vazio = todos os meses do período de ano selecionado. */
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<"both" | "2025" | "2026">("both");
  const [selectedSource, setSelectedSource] = useState<"all" | "coord" | "uf">("all");
  const isClient = typeof window !== "undefined";

  const monthsInData = useMemo(
    () =>
      [...new Set(payments.map((payment) => payment.reference_month.slice(0, 7)))].sort(),
    [payments],
  );

  const monthsForYearFilter = useMemo(
    () => calendarMonthsForFilter(selectedYear),
    [selectedYear],
  );

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
      const matchSource = selectedSource === "all" || payment.source === selectedSource;
      return matchMonth && matchUf && matchSource;
    });
  }, [payments, selectedMonths, selectedSource, selectedUfs, selectedYear]);

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
    filteredPayments.forEach((item) => {
      if (!grouped.has(item.uf)) return;
      grouped.set(item.uf, (grouped.get(item.uf) ?? 0) + item.amount);
    });
    return displayUfs.map((uf) => ({ uf, amount: grouped.get(uf) ?? 0 }));
  }, [filteredPayments, selectedUfs]);

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
          Acompanhe os pagamentos mensais por UF com filtros dinâmicos.
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
        <article className="rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Qtd. inscritos (UF)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {enrolledUnavailable ? "—" : totalEnrolled}
          </p>
          {enrolledUnavailable && (
            <p className="mt-2 text-xs leading-snug text-slate-500">
              Tabela <code className="rounded bg-slate-200/80 px-1">qtd_inscrit_uf</code> indisponível
              (RLS, nome ou permissão). Os gráficos de valores não usam este dado.
            </p>
          )}
        </article>
      </div>

      <article className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gastos por UF</h2>
            <p className="mt-1 text-sm text-slate-600">
              Somatório por UF conforme filtros ({yearFilterLabel}
              {selectedMonths.length > 0 ? ` · ${selectedMonths.length} mês(es)` : " · todos os meses"}).
              UFs sem lançamento no período aparecem com total R$ 0 (barra cinza).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Ano</p>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Origem dos pagamentos</p>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={selectedSource}
                onChange={(event) =>
                  setSelectedSource(event.target.value as "all" | "coord" | "uf")
                }
              >
                <option value="all">Coord + UF</option>
                <option value="coord">Somente coordenação</option>
                <option value="uf">Somente UF</option>
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
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-100 p-2">
              <div className="flex flex-wrap gap-2">
                {monthsForYearFilter.map((month) => {
                  const active = selectedMonths.includes(month);
                  const hasData = monthsInData.includes(month);
                  return (
                    <button
                      key={month}
                      type="button"
                      title={hasData ? "Há lançamentos neste mês" : "Sem lançamentos nos dados atuais"}
                      onClick={() => toggleMonth(month)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        active
                          ? "border-teal-600 bg-teal-600 text-white"
                          : hasData
                            ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            : "border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {monthLabel(month)}
                    </button>
                  );
                })}
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

        <div className="mt-6 h-[min(28rem,70vh)] w-full min-h-[20rem]">
          {isClient && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={totalsByUfBarChart} margin={{ bottom: 8, left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="uf" interval={0} tick={{ fontSize: 10 }} height={36} />
                <YAxis tickFormatter={formatCurrency} width={72} />
                <Tooltip formatter={formatCurrency} />
                <Bar
                  dataKey="amount"
                  radius={[6, 6, 0, 0]}
                  name="Total"
                  minPointSize={3}
                >
                  {totalsByUfBarChart.map((entry) => (
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

      <article className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Evolução mensal</h2>
        <div className="h-80">
          {isClient && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={totalsByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={monthLabel} />
                <YAxis tickFormatter={formatCurrency} />
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
