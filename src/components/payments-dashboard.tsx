"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PaymentRecord } from "@/types/payment";

type PaymentsDashboardProps = {
  payments: PaymentRecord[];
  enrolledByUf: Record<string, number>;
};

const chartColors = ["#1e40af", "#2563eb", "#0d9488", "#f97316", "#6d28d9"];

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
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function PaymentsDashboard({ payments, enrolledByUf }: PaymentsDashboardProps) {
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<"all" | "coord" | "uf">("all");
  const isClient = typeof window !== "undefined";

  const ufs = useMemo(
    () => [...new Set(payments.map((payment) => payment.uf))].sort(),
    [payments],
  );

  const months = useMemo(
    () =>
      [...new Set(payments.map((payment) => payment.reference_month.slice(0, 7)))].sort(),
    [payments],
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const month = payment.reference_month.slice(0, 7);
      const matchMonth = selectedMonth === "all" || month === selectedMonth;
      const matchUf = selectedUfs.length === 0 || selectedUfs.includes(payment.uf);
      const matchSource = selectedSource === "all" || payment.source === selectedSource;
      return matchMonth && matchUf && matchSource;
    });
  }, [payments, selectedMonth, selectedSource, selectedUfs]);

  const totalValue = filteredPayments.reduce((acc, item) => acc + item.amount, 0);
  const totalRecords = filteredPayments.length;
  const avgValue = totalRecords > 0 ? totalValue / totalRecords : 0;
  const totalEnrolled = (selectedUfs.length === 0 ? ufs : selectedUfs).reduce(
    (acc, uf) => acc + (enrolledByUf[uf] ?? 0),
    0,
  );

  const totalsByUf = (() => {
    const grouped = new Map<string, number>();
    filteredPayments.forEach((item) => {
      grouped.set(item.uf, (grouped.get(item.uf) ?? 0) + item.amount);
    });
    return Array.from(grouped.entries())
      .map(([uf, amount]) => ({ uf, amount }))
      .sort((a, b) => b.amount - a.amount);
  })();

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

  const byMonthAndUf = (() => {
    const monthlyMap = new Map<string, Record<string, number>>();
    filteredPayments.forEach((item) => {
      const month = item.reference_month.slice(0, 7);
      const base = monthlyMap.get(month) ?? {};
      base[item.uf] = (base[item.uf] ?? 0) + item.amount;
      monthlyMap.set(month, base);
    });

    return Array.from(monthlyMap.entries())
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([month, values]) => ({ month, ...values }));
  })();

  function toggleUf(uf: string) {
    setSelectedUfs((current) =>
      current.includes(uf) ? current.filter((value) => value !== uf) : [...current, uf],
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-xl bg-blue-950 px-6 py-7 text-white shadow-lg">
        <h1 className="text-2xl font-bold md:text-3xl">Controle Orçamentário - 31º CPR</h1>
        <p className="mt-2 text-sm text-blue-100 md:text-base">
          Acompanhe os pagamentos mensais por UF com filtros e comparativos dinâmicos.
        </p>
      </header>

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
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalEnrolled}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Filtrar por mês</p>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            <option value="all">Todos os meses</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Filtrar UFs (vazio = todas)
          </p>
          <div className="flex flex-wrap gap-2">
            {ufs.map((uf) => {
              const active = selectedUfs.includes(uf);
              return (
                <button
                  key={uf}
                  type="button"
                  onClick={() => toggleUf(uf)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Total por UF</h2>
          <div className="h-80">
            {isClient && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totalsByUf}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="uf" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={formatCurrency} />
                  <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
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
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Participação por UF</h2>
          <div className="h-80">
            {isClient && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={totalsByUf} dataKey="amount" nameKey="uf" outerRadius={120} label>
                    {totalsByUf.map((entry, index) => (
                      <Cell key={entry.uf} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatCurrency} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Comparativo entre UFs</h2>
          <div className="h-80">
            {isClient && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byMonthAndUf}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={formatCurrency}
                    labelFormatter={(label) => monthLabel(label)}
                  />
                  <Legend />
                  {ufs.map((uf, index) => (
                    <Line
                      key={uf}
                      dataKey={uf}
                      type="monotone"
                      stroke={chartColors[index % chartColors.length]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
