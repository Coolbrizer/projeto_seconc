"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardDataNotice, PaymentRecord } from "@/types/payment";

type ProjectionDashboardProps = {
  payments: PaymentRecord[];
  enrolledByUf: Record<string, number>;
  enrolledUnavailable?: boolean;
  dataNotice?: DashboardDataNotice;
};

/** Lista canônica de UFs (mesmo conjunto usado no painel principal). */
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

const POLO_MULTIPLIER = 1.25;

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

const integer = new Intl.NumberFormat("pt-BR");

function formatCurrencyTick(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

type UfStats = {
  uf: string;
  inscritos: number;
  valor: number;
};

type Group = {
  id: string;
  label: string;
  members: string[];
  inscritos: number;
  valor: number;
  custoPorCandidato: number | null;
  isPolo: boolean;
};

type SortMode = "custo-desc" | "custo-asc" | "valor-desc" | "valor-asc" | "uf-asc";

function buildUfStats(
  payments: PaymentRecord[],
  enrolledByUf: Record<string, number>,
): Record<string, UfStats> {
  const spentByUf = new Map<string, number>();
  for (const p of payments) {
    if (p.source !== "uf") continue;
    spentByUf.set(p.uf, (spentByUf.get(p.uf) ?? 0) + p.amount);
  }
  const result: Record<string, UfStats> = {};
  for (const uf of ALL_UFS) {
    result[uf] = {
      uf,
      inscritos: enrolledByUf[uf] ?? 0,
      valor: spentByUf.get(uf) ?? 0,
    };
  }
  return result;
}

function partitionGroupId(members: string[]) {
  if (members.length === 1) return `uf:${members[0]}`;
  return `polo:${[...members].sort().join("-")}`;
}

function buildGroupFromMembers(
  members: string[],
  stats: Record<string, UfStats>,
): Group {
  if (members.length === 0) {
    throw new Error("Grupo sem membros");
  }
  const id = partitionGroupId(members);
  if (members.length === 1) {
    const u = stats[members[0]];
    return {
      id,
      label: u.uf,
      members: [u.uf],
      inscritos: u.inscritos,
      valor: u.valor,
      custoPorCandidato: u.inscritos > 0 ? u.valor / u.inscritos : null,
      isPolo: false,
    };
  }
  // Polo: nome vem da UF com maior nº de inscritos (desempate: maior valor; depois alfabética).
  const head = [...members]
    .map((m) => stats[m])
    .sort(
      (a, b) =>
        b.inscritos - a.inscritos ||
        b.valor - a.valor ||
        a.uf.localeCompare(b.uf, "pt-BR"),
    )[0];
  const inscritos = members.reduce((acc, m) => acc + stats[m].inscritos, 0);
  const maiorValor = Math.max(...members.map((m) => stats[m].valor));
  const valor = Math.round(maiorValor * POLO_MULTIPLIER * 100) / 100;
  return {
    id,
    label: `Polo ${head.uf}`,
    members,
    inscritos,
    valor,
    custoPorCandidato: inscritos > 0 ? valor / inscritos : null,
    isPolo: true,
  };
}

function sortGroups(groups: Group[], mode: SortMode): Group[] {
  const rows = [...groups];
  const nullsLast = (v: number | null) =>
    v == null ? Number.POSITIVE_INFINITY : v;
  switch (mode) {
    case "custo-desc":
      rows.sort(
        (a, b) =>
          (b.custoPorCandidato ?? -Infinity) -
            (a.custoPorCandidato ?? -Infinity) ||
          a.label.localeCompare(b.label, "pt-BR"),
      );
      break;
    case "custo-asc":
      rows.sort(
        (a, b) =>
          nullsLast(a.custoPorCandidato) - nullsLast(b.custoPorCandidato) ||
          a.label.localeCompare(b.label, "pt-BR"),
      );
      break;
    case "valor-desc":
      rows.sort((a, b) => b.valor - a.valor);
      break;
    case "valor-asc":
      rows.sort((a, b) => a.valor - b.valor);
      break;
    case "uf-asc":
      rows.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
      break;
  }
  return rows;
}

export function ProjectionDashboard({
  payments,
  enrolledByUf,
  enrolledUnavailable,
  dataNotice,
}: ProjectionDashboardProps) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const ufStats = useMemo(
    () => buildUfStats(payments, enrolledByUf),
    [payments, enrolledByUf],
  );

  /** Partição: cada elemento é um array de UFs que pertencem ao mesmo grupo/polo. */
  const [partition, setPartition] = useState<string[][]>(() =>
    ALL_UFS.map((uf) => [uf]),
  );

  /** Conjunto de IDs (de grupos) selecionados para a próxima ação. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortMode, setSortMode] = useState<SortMode>("custo-desc");

  const groups = useMemo(
    () => partition.map((members) => buildGroupFromMembers(members, ufStats)),
    [partition, ufStats],
  );

  const sortedGroups = useMemo(
    () => sortGroups(groups, sortMode),
    [groups, sortMode],
  );

  /** Sub-conjunto de groups que estão atualmente selecionados (para a ação de criar polo). */
  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedIds.has(g.id)),
    [groups, selectedIds],
  );

  const polos = useMemo(() => groups.filter((g) => g.isPolo), [groups]);

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleCreatePolo() {
    if (selectedGroups.length < 2) return;
    const newMembers = selectedGroups.flatMap((g) => g.members);
    const remaining = partition.filter(
      (members) => !selectedIds.has(partitionGroupId(members)),
    );
    remaining.push(newMembers);
    setPartition(remaining);
    setSelectedIds(new Set());
  }

  function handleUndoPolo(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group || !group.isPolo) return;
    const remaining = partition.filter(
      (members) => partitionGroupId(members) !== groupId,
    );
    for (const uf of group.members) remaining.push([uf]);
    setPartition(remaining);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(groupId);
      return next;
    });
  }

  function handleReset() {
    setPartition(ALL_UFS.map((uf) => [uf]));
    setSelectedIds(new Set());
  }

  const totalsAtuais = useMemo(() => {
    let valor = 0;
    let inscritos = 0;
    for (const uf of ALL_UFS) {
      valor += ufStats[uf].valor;
      inscritos += ufStats[uf].inscritos;
    }
    return { valor, inscritos };
  }, [ufStats]);

  const totalsProjetados = useMemo(() => {
    let valor = 0;
    let inscritos = 0;
    for (const g of groups) {
      valor += g.valor;
      inscritos += g.inscritos;
    }
    return { valor, inscritos };
  }, [groups]);

  const diff = totalsProjetados.valor - totalsAtuais.valor;
  const diffPct =
    totalsAtuais.valor > 0 ? (diff / totalsAtuais.valor) * 100 : 0;

  const chartData = useMemo(
    () =>
      sortedGroups.map((g) => ({
        id: g.id,
        label: g.label,
        valor: g.valor,
        inscritos: g.inscritos,
        custoPorCandidato: g.custoPorCandidato,
        isPolo: g.isPolo,
        members: g.members,
      })),
    [sortedGroups],
  );

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="rounded-xl bg-gradient-to-br from-violet-900 via-violet-800 to-indigo-900 px-6 py-7 text-white shadow-lg">
        <h1 className="text-2xl font-bold md:text-3xl">Projeção de Gastos</h1>
        <p className="mt-2 max-w-3xl text-sm text-violet-100 md:text-base">
          Simule a criação de <strong>polos regionais</strong> a partir de
          duas ou mais UFs. Ao agrupar, os inscritos são somados e o valor
          projetado é a <strong>maior despesa</strong> entre as UFs do polo
          acrescida de <strong>25%</strong>.
        </p>
      </header>

      {dataNotice && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
        >
          <p className="font-medium text-amber-900">Aviso de dados</p>
          <p className="mt-1 leading-relaxed">
            Não foi possível ler os pagamentos do Supabase. Verifique as
            variáveis de ambiente e políticas RLS.
          </p>
        </div>
      )}

      {enrolledUnavailable && (
        <div
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
        >
          <p className="font-medium text-amber-900">Inscritos indisponíveis</p>
          <p className="mt-1 leading-relaxed">
            A tabela <code className="rounded bg-amber-100 px-1">qtd_inscrit_uf</code>{" "}
            não pôde ser lida. UFs sem inscritos ficam com{" "}
            <em>custo por candidato</em> em branco.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Despesa atual (Subcomissões)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {currency.format(totalsAtuais.valor)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {integer.format(totalsAtuais.inscritos)} inscritos no total
          </p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
            Projeção com polos
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-900">
            {currency.format(totalsProjetados.valor)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {polos.length === 0
              ? "Nenhum polo criado — espelho dos valores atuais."
              : `${polos.length} polo${polos.length > 1 ? "s" : ""} ativo${polos.length > 1 ? "s" : ""}.`}
          </p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Diferença vs. atual
          </p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              diff > 0 ? "text-rose-700" : diff < 0 ? "text-emerald-700" : "text-slate-900"
            }`}
          >
            {diff >= 0 ? "+" : "−"}
            {currency.format(Math.abs(diff))}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {diff === 0
              ? "Sem variação."
              : `${diff >= 0 ? "+" : "−"}${Math.abs(diffPct).toFixed(1).replace(".", ",")}% em relação ao quadro atual.`}
          </p>
        </article>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Distribuição por unidade
            </h2>
            <p className="text-xs text-slate-500">
              Cada barra representa o <strong>valor projetado</strong> do grupo
              (R$). A ordenação segue o <strong>custo por candidato</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-slate-600">
              Ordenar por:
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="custo-desc">
                  Custo por candidato (maior → menor)
                </option>
                <option value="custo-asc">
                  Custo por candidato (menor → maior)
                </option>
                <option value="valor-desc">Valor (maior → menor)</option>
                <option value="valor-asc">Valor (menor → maior)</option>
                <option value="uf-asc">UF (A → Z)</option>
              </select>
            </label>
          </div>
        </div>

        <div
          className="w-full"
          style={{ height: Math.max(440, chartData.length * 28 + 80) }}
        >
          {isClient && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 60, bottom: 8, left: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrencyTick}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                        <p className="font-semibold text-slate-900">
                          {p.label}
                          {p.isPolo && (
                            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
                              Polo
                            </span>
                          )}
                        </p>
                        {p.isPolo && (
                          <p className="mt-1 text-slate-600">
                            UFs: {p.members.join(" + ")}
                          </p>
                        )}
                        <p className="mt-1 text-slate-700">
                          <span className="text-slate-500">Inscritos:</span>{" "}
                          <span className="font-semibold tabular-nums">
                            {integer.format(p.inscritos)}
                          </span>
                        </p>
                        <p className="text-slate-700">
                          <span className="text-slate-500">Valor:</span>{" "}
                          <span className="font-semibold tabular-nums">
                            {currencyFine.format(p.valor)}
                          </span>
                          {p.isPolo && (
                            <span className="ml-1 text-[10px] text-violet-700">
                              (maior despesa × 1,25)
                            </span>
                          )}
                        </p>
                        <p className="text-slate-700">
                          <span className="text-slate-500">
                            Custo por candidato:
                          </span>{" "}
                          <span className="font-semibold tabular-nums">
                            {p.custoPorCandidato != null
                              ? currencyFine.format(p.custoPorCandidato)
                              : "—"}
                          </span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="valor"
                  name="Valor projetado"
                  radius={[0, 6, 6, 0]}
                  minPointSize={2}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.id}
                      fill={entry.isPolo ? "#7c3aed" : "#2563eb"}
                    />
                  ))}
                  <LabelList
                    dataKey="valor"
                    position="right"
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value);
                      return Number.isFinite(n) ? currency.format(n) : "";
                    }}
                    style={{ fontSize: 10, fill: "#0f172a" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {isClient && chartData.length === 0 && (
            <p className="flex h-full items-center justify-center text-sm text-slate-500">
              Sem dados para projeção.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Montar polo
            </h2>
            <p className="text-xs text-slate-500">
              Selecione <strong>2 ou mais</strong> unidades para agrupar em um
              polo. UFs já dentro de um polo aparecem com o badge{" "}
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
                Polo
              </span>{" "}
              e podem ser desfeitas individualmente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreatePolo}
              disabled={selectedGroups.length < 2}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Criar polo
              {selectedGroups.length >= 2 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                  {selectedGroups.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpar seleção
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={polos.length === 0 && selectedIds.size === 0}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Resetar tudo
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="w-10 px-3 py-2 font-medium text-slate-700"></th>
                <th className="px-3 py-2 font-medium text-slate-700">Unidade</th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">
                  Inscritos
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">
                  Valor projetado
                </th>
                <th className="px-3 py-2 text-right font-medium text-slate-700">
                  R$ / inscrito
                </th>
                <th className="w-24 px-3 py-2 text-right font-medium text-slate-700"></th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((g, idx) => (
                <tr
                  key={g.id}
                  className={`border-b border-slate-100 last:border-0 ${
                    g.isPolo ? "bg-violet-50/60" : ""
                  }`}
                >
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(g.id)}
                      onChange={() => toggleSelection(g.id)}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      aria-label={`Selecionar ${g.label}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    <span className="mr-2 text-xs text-slate-400 tabular-nums">
                      {idx + 1}.
                    </span>
                    <span className="font-medium">{g.label}</span>
                    {g.isPolo && (
                      <>
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
                          Polo
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          ({g.members.join(" + ")})
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {integer.format(g.inscritos)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {currencyFine.format(g.valor)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {g.custoPorCandidato != null
                      ? currencyFine.format(g.custoPorCandidato)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {g.isPolo && (
                      <button
                        type="button"
                        onClick={() => handleUndoPolo(g.id)}
                        className="rounded-md border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                      >
                        Desfazer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-slate-800">
                  Total ({sortedGroups.length}{" "}
                  {sortedGroups.length === 1 ? "unidade" : "unidades"})
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {integer.format(totalsProjetados.inscritos)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                  {currencyFine.format(totalsProjetados.valor)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {totalsProjetados.inscritos > 0
                    ? currencyFine.format(
                        totalsProjetados.valor / totalsProjetados.inscritos,
                      )
                    : "—"}
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          <strong>Regra do polo:</strong> nome = UF do polo com maior nº de
          inscritos da seleção; inscritos = soma das UFs; valor projetado =
          maior despesa do grupo × 1,25.
        </p>
      </section>
    </section>
  );
}
