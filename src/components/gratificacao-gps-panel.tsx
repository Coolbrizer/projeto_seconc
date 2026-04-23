"use client";

import { useMemo, useState } from "react";
import type { GratificacaoGpsRecord } from "@/types/payment";

type GratificacaoGpsPanelProps = {
  rows: GratificacaoGpsRecord[];
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDatePt(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeCsvCell(value: string) {
  if (/[",\n\r;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, lines: string[]) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = "competencia" | "data" | "grupo" | "referencia" | "valor" | "documento";
type SortDir = "asc" | "desc";

export function GratificacaoGpsPanel({ rows }: GratificacaoGpsPanelProps) {
  const [selectedGrupos, setSelectedGrupos] = useState<string[]>([]);
  const [anoFiltro, setAnoFiltro] = useState<number | "todos">("todos");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [busca, setBusca] = useState("");
  const [soPendenteValor, setSoPendenteValor] = useState(false);
  const [soComDocumento, setSoComDocumento] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const gruposUnicos = useMemo(() => {
    const s = new Set(rows.map((r) => r.grupo));
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const anosDisponiveis = useMemo(() => {
    const s = new Set(rows.map((r) => r.competencia_ano));
    return [...s].sort((a, b) => a - b);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (anoFiltro !== "todos" && r.competencia_ano !== anoFiltro) return false;
      if (selectedGrupos.length > 0 && !selectedGrupos.includes(r.grupo)) return false;
      if (soPendenteValor && r.amount != null) return false;
      if (soComDocumento && !r.documento_seconc) return false;
      if (dataDe) {
        const cmp = r.data_lancamento_gps ?? "";
        if (!cmp || cmp < dataDe) return false;
      }
      if (dataAte) {
        const cmp = r.data_lancamento_gps ?? "";
        if (!cmp || cmp > dataAte) return false;
      }
      if (q) {
        const blob = `${r.grupo} ${r.referencia} ${r.documento_seconc ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [
    rows,
    anoFiltro,
    selectedGrupos,
    busca,
    soPendenteValor,
    soComDocumento,
    dataDe,
    dataAte,
  ]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "competencia":
          cmp = a.competencia_ano - b.competencia_ano;
          break;
        case "data": {
          const da = a.data_lancamento_gps ?? "";
          const db = b.data_lancamento_gps ?? "";
          cmp = da.localeCompare(db);
          break;
        }
        case "grupo":
          cmp = a.grupo.localeCompare(b.grupo, "pt-BR");
          break;
        case "referencia":
          cmp = a.referencia.localeCompare(b.referencia, "pt-BR");
          break;
        case "valor": {
          const va = a.amount ?? -1;
          const vb = b.amount ?? -1;
          cmp = va - vb;
          break;
        }
        case "documento":
          cmp = (a.documento_seconc ?? "").localeCompare(b.documento_seconc ?? "", "pt-BR");
          break;
        default:
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return a.referencia.localeCompare(b.referencia, "pt-BR");
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totais = useMemo(() => {
    let soma = 0;
    let comValor = 0;
    let pendente = 0;
    for (const r of filtered) {
      if (r.amount != null) {
        soma += r.amount;
        comValor += 1;
      } else pendente += 1;
    }
    return { soma, comValor, pendente, totalLinhas: filtered.length };
  }, [filtered]);

  const porGrupo = useMemo(() => {
    const m = new Map<string, { soma: number; n: number }>();
    for (const r of filtered) {
      if (r.amount == null) continue;
      const cur = m.get(r.grupo) ?? { soma: 0, n: 0 };
      cur.soma += r.amount;
      cur.n += 1;
      m.set(r.grupo, cur);
    }
    return [...m.entries()]
      .map(([grupo, v]) => ({ grupo, ...v }))
      .sort((a, b) => b.soma - a.soma);
  }, [filtered]);

  function toggleGrupo(g: string) {
    setSelectedGrupos((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function selecionarTodosGrupos() {
    setSelectedGrupos(gruposUnicos.length > 0 ? [...gruposUnicos] : []);
  }

  function limparGrupos() {
    setSelectedGrupos([]);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "data" || key === "valor" ? "desc" : "asc");
    }
  }

  function exportarCsv() {
    const sep = ";";
    const header = [
      "competencia_ano",
      "data_lancamento_gps",
      "grupo",
      "referencia",
      "valor_brl",
      "documento_seconc",
    ];
    const lines = [
      header.join(sep),
      ...sorted.map((r) =>
        [
          String(r.competencia_ano),
          escapeCsvCell(r.data_lancamento_gps ?? ""),
          escapeCsvCell(r.grupo),
          escapeCsvCell(r.referencia),
          r.amount != null
            ? r.amount.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
          escapeCsvCell(r.documento_seconc ?? ""),
        ].join(sep),
      ),
    ];
    downloadCsv(`gratificacao-gps-filtrado-${new Date().toISOString().slice(0, 10)}.csv`, lines);
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  if (rows.length === 0) {
    return (
      <article className="rounded-xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gratificação — lançamentos no GPS</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Nenhum registro na tabela <code className="rounded bg-slate-100 px-1">gratificacao_gps</code>.
          Após aplicar o SQL em <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code>, importe
          os dados da planilha (competência, data GPS, grupo, referência, valor, documento PGR) para filtrar,
          totalizar e exportar aqui.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-xl bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4 border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">Gratificação — lançamentos no GPS</h2>
        <p className="mt-1 text-sm text-slate-600">
          Controle alinhado à planilha (competência, data de lançamento no GPS, equipe/grupo, referência, valor
          e documento SECONC). Filtre por equipe, ano, intervalo de datas e texto; exporte o recorte em CSV.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total filtrado (R$)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {currency.format(totais.soma)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Linhas no filtro</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{totais.totalLinhas}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Com valor informado</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{totais.comValor}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor pendente</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{totais.pendente}</p>
        </div>
      </div>

      {porGrupo.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Somatório por equipe (filtro atual)</h3>
          <div className="max-h-40 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Grupo</th>
                  <th className="px-3 py-2 font-medium text-right">Lançamentos</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {porGrupo.map((g) => (
                  <tr key={g.grupo} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-800">{g.grupo}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{g.n}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-900">
                      {currency.format(g.soma)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Competência (ano)</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black"
              value={anoFiltro === "todos" ? "todos" : String(anoFiltro)}
              onChange={(e) => {
                const v = e.target.value;
                setAnoFiltro(v === "todos" ? "todos" : Number(v));
              }}
            >
              <option value="todos">Todos os anos</option>
              {anosDisponiveis.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Data GPS (de)</label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black"
              value={dataDe}
              onChange={(e) => setDataDe(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Data GPS (até)</label>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black"
              value={dataAte}
              onChange={(e) => setDataAte(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Busca (grupo, referência, PGR)</label>
            <input
              type="search"
              placeholder="Ex.: banca, PGR-001, março…"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={soPendenteValor}
              onChange={(e) => setSoPendenteValor(e.target.checked)}
              className="rounded border-slate-300"
            />
            Somente linhas sem valor (pendente)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={soComDocumento}
              onChange={(e) => setSoComDocumento(e.target.checked)}
              className="rounded border-slate-300"
            />
            Somente com documento SECONC
          </label>
          <button
            type="button"
            onClick={() => {
              setAnoFiltro("todos");
              setDataDe("");
              setDataAte("");
              setBusca("");
              setSoPendenteValor(false);
              setSoComDocumento(false);
              setSelectedGrupos([]);
            }}
            className="text-sm font-medium text-blue-700 underline decoration-blue-300 hover:text-blue-900"
          >
            Limpar filtros
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Exportar CSV (filtrado)
          </button>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-600">
              Equipes (vazio = todas) · {gruposUnicos.length} grupo(s) distinto(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selecionarTodosGrupos}
                className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={limparGrupos}
                className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
              >
                Limpar equipes
              </button>
            </div>
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-2">
              {gruposUnicos.map((g) => {
                const on = selectedGrupos.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrupo(g)}
                    className={`max-w-full truncate rounded-full border px-2.5 py-1 text-left text-xs transition md:text-sm ${
                      on
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    title={g}
                  >
                    {g.length > 42 ? `${g.slice(0, 40)}…` : g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-800 text-white">
            <tr>
              <th className="px-2 py-2">
                <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("competencia")}>
                  Competência{sortIndicator("competencia")}
                </button>
              </th>
              <th className="px-2 py-2">
                <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("data")}>
                  Data GPS{sortIndicator("data")}
                </button>
              </th>
              <th className="px-2 py-2">
                <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("grupo")}>
                  Grupo{sortIndicator("grupo")}
                </button>
              </th>
              <th className="px-2 py-2">
                <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("referencia")}>
                  Referência{sortIndicator("referencia")}
                </button>
              </th>
              <th className="px-2 py-2 text-right">
                <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("valor")}>
                  Valor{sortIndicator("valor")}
                </button>
              </th>
              <th className="px-2 py-2">
                <button type="button" className="font-medium hover:underline" onClick={() => toggleSort("documento")}>
                  Documento{sortIndicator("documento")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/80">
                <td className="px-2 py-2 tabular-nums text-slate-800">{r.competencia_ano}</td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-700">{formatDatePt(r.data_lancamento_gps)}</td>
                <td className="max-w-[14rem] px-2 py-2 text-slate-800">{r.grupo}</td>
                <td className="max-w-md px-2 py-2 text-slate-700">{r.referencia}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium text-slate-900">
                  {r.amount != null ? currency.format(r.amount) : <span className="text-amber-700">Pendente</span>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-slate-600">
                  {r.documento_seconc ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-500">Nenhuma linha com os filtros atuais.</p>
      )}
    </article>
  );
}
