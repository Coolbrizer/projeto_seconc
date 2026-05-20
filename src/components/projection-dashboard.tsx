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

import { BrazilMap } from "./brazil-map";

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

/** Cenário salvo (persistido em localStorage). Apenas a partição é guardada. */
type SavedScenario = {
  id: string;
  name: string;
  createdAt: number;
  partition: string[][];
};

const SCENARIOS_STORAGE_KEY = "seconc:projection-scenarios:v1";

/** Métricas usadas no comparativo entre cenários. */
type ScenarioMetrics = {
  id: string;
  name: string;
  kind: "baseline" | "current" | "saved";
  createdAt?: number;
  unidades: number;
  polos: number;
  individuais: number;
  inscritos: number;
  valor: number;
  custoMedio: number | null;
  custoMin: { value: number; label: string } | null;
  custoMax: { value: number; label: string } | null;
};

function computeScenarioMetrics(
  partition: string[][],
  ufStats: Record<string, UfStats>,
  name: string,
  id: string,
  kind: ScenarioMetrics["kind"],
  createdAt?: number,
): ScenarioMetrics {
  const built = partition.map((m) => buildGroupFromMembers(m, ufStats));
  let inscritos = 0;
  let valor = 0;
  let polos = 0;
  const custos: { value: number; label: string }[] = [];
  for (const g of built) {
    inscritos += g.inscritos;
    valor += g.valor;
    if (g.isPolo) polos += 1;
    if (g.custoPorCandidato != null) {
      custos.push({ value: g.custoPorCandidato, label: g.label });
    }
  }
  return {
    id,
    name,
    kind,
    createdAt,
    unidades: built.length,
    polos,
    individuais: built.length - polos,
    inscritos,
    valor,
    custoMedio: inscritos > 0 ? valor / inscritos : null,
    custoMin:
      custos.length > 0
        ? custos.reduce((a, b) => (b.value < a.value ? b : a))
        : null,
    custoMax:
      custos.length > 0
        ? custos.reduce((a, b) => (b.value > a.value ? b : a))
        : null,
  };
}

/** Sanitiza partição vinda do storage: garante todas as UFs presentes e sem duplicatas. */
function sanitizePartition(input: unknown): string[][] {
  if (!Array.isArray(input)) return ALL_UFS.map((u) => [u]);
  const seen = new Set<string>();
  const clean: string[][] = [];
  const allUfs = new Set<string>(ALL_UFS);
  for (const grp of input) {
    if (!Array.isArray(grp)) continue;
    const filtered: string[] = [];
    for (const uf of grp) {
      if (typeof uf !== "string") continue;
      const up = uf.toUpperCase();
      if (!allUfs.has(up) || seen.has(up)) continue;
      filtered.push(up);
      seen.add(up);
    }
    if (filtered.length > 0) clean.push(filtered);
  }
  for (const uf of ALL_UFS) {
    if (!seen.has(uf)) clean.push([uf]);
  }
  return clean;
}

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

  /** ID do polo em edição (null = nenhum). Mantém isolado da seleção principal. */
  const [editingPoloId, setEditingPoloId] = useState<string | null>(null);
  /** UFs marcadas no rascunho de edição. */
  const [editDraft, setEditDraft] = useState<Set<string>>(new Set());

  const [sortMode, setSortMode] = useState<SortMode>("custo-desc");

  /** Cenários salvos (persistência em localStorage). */
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [savingScenario, setSavingScenario] = useState(false);
  const [scenarioNameDraft, setScenarioNameDraft] = useState("");

  // Carrega cenários do localStorage (apenas no cliente).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const valid: SavedScenario[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        if (
          typeof obj.id === "string" &&
          typeof obj.name === "string" &&
          typeof obj.createdAt === "number" &&
          Array.isArray(obj.partition)
        ) {
          valid.push({
            id: obj.id,
            name: obj.name,
            createdAt: obj.createdAt,
            partition: sanitizePartition(obj.partition),
          });
        }
      }
      setScenarios(valid);
    } catch (err) {
      console.warn("Falha ao carregar cenários do localStorage:", err);
    }
  }, []);

  function persistScenarios(next: SavedScenario[]) {
    setScenarios(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("Falha ao salvar cenários no localStorage:", err);
    }
  }

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

  /**
   * Nome do cenário salvo que bate com a partição atual (se houver).
   * Usado como legenda do mapa quando o usuário carrega um cenário.
   */
  const activeScenarioName = useMemo(() => {
    const partitionKey = [...partition.map((g) => [...g].sort().join("|"))]
      .sort()
      .join("||");
    const match = scenarios.find((s) => {
      const k = [...s.partition.map((g) => [...g].sort().join("|"))]
        .sort()
        .join("||");
      return k === partitionKey;
    });
    return match?.name ?? null;
  }, [partition, scenarios]);

  /** Mapa UF → grupo atual (para exibir “está em Polo X” na edição). */
  const ufToGroup = useMemo(() => {
    const map = new Map<string, Group>();
    for (const g of groups) {
      for (const m of g.members) map.set(m, g);
    }
    return map;
  }, [groups]);

  const editingPolo = useMemo(
    () => groups.find((g) => g.id === editingPoloId) ?? null,
    [groups, editingPoloId],
  );

  /** Pré-visualização do polo enquanto o usuário marca/desmarca UFs no modal. */
  const editPreview = useMemo(() => {
    if (!editingPolo) return null;
    const members = [...editDraft];
    if (members.length === 0) {
      return {
        members,
        inscritos: 0,
        valor: 0,
        custoPorCandidato: null as number | null,
        label: "(polo será dissolvido)",
        isPolo: false,
        empty: true,
      };
    }
    const built = buildGroupFromMembers(members, ufStats);
    return {
      members: built.members,
      inscritos: built.inscritos,
      valor: built.valor,
      custoPorCandidato: built.custoPorCandidato,
      label: built.label,
      isPolo: built.isPolo,
      empty: false,
    };
  }, [editingPolo, editDraft, ufStats]);

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
    setEditingPoloId(null);
    setEditDraft(new Set());
  }

  function handleStartSaveScenario() {
    const defaultName = `Cenário ${scenarios.length + 1}`;
    setScenarioNameDraft(defaultName);
    setSavingScenario(true);
  }

  function handleCancelSaveScenario() {
    setSavingScenario(false);
    setScenarioNameDraft("");
  }

  function handleConfirmSaveScenario() {
    const name =
      scenarioNameDraft.trim() || `Cenário ${scenarios.length + 1}`;
    const newScenario: SavedScenario = {
      id: `cen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: Date.now(),
      partition: partition.map((g) => [...g]),
    };
    persistScenarios([...scenarios, newScenario]);
    setSavingScenario(false);
    setScenarioNameDraft("");
  }

  function handleLoadScenario(id: string) {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;
    setPartition(sanitizePartition(target.partition));
    setSelectedIds(new Set());
    setEditingPoloId(null);
    setEditDraft(new Set());
  }

  function handleDeleteScenario(id: string) {
    persistScenarios(scenarios.filter((s) => s.id !== id));
  }

  function handleOverwriteScenario(id: string) {
    const next = scenarios.map((s) =>
      s.id === id
        ? {
            ...s,
            partition: partition.map((g) => [...g]),
            createdAt: Date.now(),
          }
        : s,
    );
    persistScenarios(next);
  }

  function isScenarioEqualToCurrent(s: SavedScenario): boolean {
    const a = [...s.partition.map((g) => [...g].sort().join("|"))].sort();
    const b = [...partition.map((g) => [...g].sort().join("|"))].sort();
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  function handleStartEdit(poloId: string) {
    const polo = groups.find((g) => g.id === poloId);
    if (!polo || !polo.isPolo) return;
    setEditingPoloId(poloId);
    setEditDraft(new Set(polo.members));
    // Importante: não tocamos em selectedIds nem em partition → a seleção principal é preservada.
  }

  function handleCancelEdit() {
    setEditingPoloId(null);
    setEditDraft(new Set());
  }

  function handleToggleDraftUf(uf: string) {
    setEditDraft((current) => {
      const next = new Set(current);
      if (next.has(uf)) {
        next.delete(uf);
      } else {
        next.add(uf);
      }
      return next;
    });
  }

  function handleSaveEdit() {
    if (!editingPolo) return;
    const oldMembers = editingPolo.members;
    const draft = editDraft;

    // 1) Reconstrói a partição removendo o polo em edição e descontando as UFs
    //    do draft de qualquer outro grupo onde estejam (UFs que “migram” para este polo).
    const newPartition: string[][] = [];
    for (const group of partition) {
      const groupId = partitionGroupId(group);
      if (groupId === editingPolo.id) continue;
      const filtered = group.filter((m) => !draft.has(m));
      if (filtered.length > 0) newPartition.push(filtered);
    }

    // 2) UFs que estavam no polo original e foram desmarcadas viram singletons.
    for (const uf of oldMembers) {
      if (!draft.has(uf)) newPartition.push([uf]);
    }

    // 3) O novo grupo editado (pode virar singleton se sobrou 1 UF; nada se 0).
    if (draft.size > 0) newPartition.push([...draft]);

    setPartition(newPartition);
    // Atualiza seleção: se o polo antigo estava marcado, marca o novo (mesmo conjunto = mesmo id ou novo id).
    setSelectedIds((current) => {
      if (!current.has(editingPolo.id)) return current;
      const next = new Set(current);
      next.delete(editingPolo.id);
      if (draft.size > 0) next.add(partitionGroupId([...draft]));
      return next;
    });
    setEditingPoloId(null);
    setEditDraft(new Set());
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
        /** Valor numérico não nulo para o recharts renderizar a barra (0 quando sem inscritos). */
        custoBar: g.custoPorCandidato ?? 0,
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
              Cada barra representa o <strong>custo por candidato</strong> do
              grupo (R$ / inscrito). O <strong>valor total projetado</strong>{" "}
              aparece ao final da barra, para consulta eventual.
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
                margin={{ top: 8, right: 140, bottom: 8, left: 16 }}
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
                  dataKey="custoBar"
                  name="Custo por candidato"
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
                      return Number.isFinite(n)
                        ? `Total: ${currency.format(n)}`
                        : "";
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

      <BrazilMap
        polos={polos.map((g) => ({
          id: g.id,
          label: g.label,
          members: g.members,
        }))}
        caption={
          activeScenarioName
            ? `Visualizando: ${activeScenarioName}`
            : polos.length > 0
              ? `${polos.length} polo${polos.length > 1 ? "s" : ""} ativo${polos.length > 1 ? "s" : ""}`
              : undefined
        }
      />

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
            <button
              type="button"
              onClick={handleStartSaveScenario}
              disabled={savingScenario}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="Salva a configuração atual de polos como cenário"
            >
              <span aria-hidden>💾</span>
              Salvar cenário
            </button>
          </div>
        </div>

        {savingScenario && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
            <label className="text-xs font-medium text-emerald-900">
              Nome do cenário:
            </label>
            <input
              type="text"
              value={scenarioNameDraft}
              onChange={(e) => setScenarioNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmSaveScenario();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancelSaveScenario();
                }
              }}
              autoFocus
              maxLength={60}
              placeholder="Ex.: Polos pretendidos"
              className="flex-1 min-w-[200px] rounded-md border border-emerald-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleConfirmSaveScenario}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={handleCancelSaveScenario}
              className="rounded-md border border-emerald-400 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Cancelar
            </button>
          </div>
        )}

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
                <th className="w-40 px-3 py-2 text-right font-medium text-slate-700"></th>
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
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(g.id)}
                          className="rounded-md border border-violet-500 bg-violet-600 px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
                          title="Adicionar ou remover UFs deste polo"
                        >
                          Editar polo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUndoPolo(g.id)}
                          className="rounded-md border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100"
                          title="Voltar a separar todas as UFs deste polo"
                        >
                          Desfazer
                        </button>
                      </div>
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

      <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Cenários salvos
          </h2>
          <p className="text-xs text-slate-500">
            Armazenados localmente no seu navegador (
            <code className="rounded bg-slate-100 px-1">localStorage</code>).
            Não são sincronizados entre dispositivos.
          </p>
        </div>

        {scenarios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum cenário salvo ainda. Configure os polos acima e clique em{" "}
            <strong>Salvar cenário</strong> para armazenar para consulta.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scenarios
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((s) => {
                const metrics = computeScenarioMetrics(
                  s.partition,
                  ufStats,
                  s.name,
                  s.id,
                  "saved",
                  s.createdAt,
                );
                const isCurrent = isScenarioEqualToCurrent(s);
                return (
                  <li
                    key={s.id}
                    className={[
                      "flex flex-col gap-3 rounded-lg border p-4",
                      isCurrent
                        ? "border-violet-400 bg-violet-50/70 ring-1 ring-violet-200"
                        : "border-slate-200 bg-slate-50/70",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {s.name}
                          {isCurrent && (
                            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
                              em uso
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Salvo em{" "}
                          {new Date(s.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">Unidades</dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {metrics.unidades}{" "}
                          <span className="font-normal text-slate-500">
                            ({metrics.polos} polo
                            {metrics.polos === 1 ? "" : "s"})
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Inscritos</dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {integer.format(metrics.inscritos)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Valor projetado</dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {currency.format(metrics.valor)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">
                          Custo médio / cand.
                        </dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {metrics.custoMedio != null
                            ? currencyFine.format(metrics.custoMedio)
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadScenario(s.id)}
                        disabled={isCurrent}
                        className="rounded-md border border-violet-500 bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOverwriteScenario(s.id)}
                        disabled={isCurrent}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Sobrescrever este cenário com a configuração atual"
                      >
                        Sobrescrever
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            typeof window !== "undefined" &&
                            window.confirm(
                              `Excluir o cenário "${s.name}"? Esta ação não pode ser desfeita.`,
                            )
                          ) {
                            handleDeleteScenario(s.id);
                          }
                        }}
                        className="ml-auto rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <ComparativeTable
        ufStats={ufStats}
        partition={partition}
        scenarios={scenarios}
      />

      {editingPolo && editPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Editar ${editingPolo.label}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelEdit();
          }}
        >
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Editar <span className="text-violet-700">{editingPolo.label}</span>
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Marque as UFs que devem compor este polo. UFs que estiverem em{" "}
                  <strong>outros polos</strong> sairão do polo de origem ao serem
                  selecionadas aqui. Sua seleção de checkboxes na tabela{" "}
                  <strong>não é perdida</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                aria-label="Fechar edição"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                {ALL_UFS.map((uf) => {
                  const inDraft = editDraft.has(uf);
                  const currentGroup = ufToGroup.get(uf);
                  const isInThisPolo = editingPolo.members.includes(uf);
                  const isInOtherPolo =
                    !!currentGroup &&
                    currentGroup.isPolo &&
                    currentGroup.id !== editingPolo.id;
                  return (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => handleToggleDraftUf(uf)}
                      className={[
                        "flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-xs transition",
                        inDraft
                          ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-violet-400 hover:bg-violet-50",
                      ].join(" ")}
                      title={
                        isInOtherPolo
                          ? `Atualmente em ${currentGroup!.label}`
                          : isInThisPolo
                            ? "Já está neste polo"
                            : "UF disponível"
                      }
                    >
                      <span className="text-sm font-semibold">{uf}</span>
                      <span
                        className={[
                          "mt-0.5 text-[10px]",
                          inDraft ? "text-violet-100" : "text-slate-500",
                        ].join(" ")}
                      >
                        {ufStats[uf].inscritos > 0
                          ? `${integer.format(ufStats[uf].inscritos)} insc.`
                          : "sem insc."}
                      </span>
                      {isInOtherPolo && !inDraft && (
                        <span className="mt-0.5 truncate text-[10px] text-amber-600">
                          em {currentGroup!.label}
                        </span>
                      )}
                      {inDraft && isInOtherPolo && (
                        <span className="mt-0.5 truncate text-[10px] text-amber-100">
                          ← {currentGroup!.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Prévia do polo após salvar
              </p>
              {editPreview.empty ? (
                <p className="mt-1 text-sm text-amber-700">
                  Nenhuma UF marcada — ao salvar, este polo será dissolvido e
                  suas UFs voltam a ser individuais.
                </p>
              ) : (
                <div className="mt-1 grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-slate-500">
                      {editPreview.isPolo ? "Polo" : "Unidade"}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {editPreview.label}
                    </p>
                    {editPreview.isPolo && (
                      <p className="text-[11px] text-slate-500">
                        ({editPreview.members.join(" + ")})
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500">Inscritos</p>
                    <p className="font-semibold tabular-nums text-slate-900">
                      {integer.format(editPreview.inscritos)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">
                      Valor projetado
                      {editPreview.isPolo && (
                        <span className="ml-1 text-[10px] text-violet-700">
                          (×1,25)
                        </span>
                      )}
                    </p>
                    <p className="font-semibold tabular-nums text-slate-900">
                      {currencyFine.format(editPreview.valor)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Custo / candidato:{" "}
                      {editPreview.custoPorCandidato != null
                        ? currencyFine.format(editPreview.custoPorCandidato)
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type ComparativeTableProps = {
  ufStats: Record<string, UfStats>;
  partition: string[][];
  scenarios: SavedScenario[];
};

function ComparativeTable({
  ufStats,
  partition,
  scenarios,
}: ComparativeTableProps) {
  const rows = useMemo<ScenarioMetrics[]>(() => {
    const baseline = computeScenarioMetrics(
      ALL_UFS.map((u) => [u]),
      ufStats,
      "Base — sem polos",
      "baseline",
      "baseline",
    );
    const current = computeScenarioMetrics(
      partition,
      ufStats,
      "Configuração atual",
      "current",
      "current",
    );
    const saved = scenarios
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) =>
        computeScenarioMetrics(
          s.partition,
          ufStats,
          s.name,
          s.id,
          "saved",
          s.createdAt,
        ),
      );
    return [baseline, current, ...saved];
  }, [ufStats, partition, scenarios]);

  const currentValor = rows.find((r) => r.kind === "current")?.valor ?? 0;

  const minCusto = useMemo(() => {
    const v = rows
      .map((r) => r.custoMedio)
      .filter((c): c is number => c != null);
    return v.length ? Math.min(...v) : null;
  }, [rows]);
  const maxCusto = useMemo(() => {
    const v = rows
      .map((r) => r.custoMedio)
      .filter((c): c is number => c != null);
    return v.length ? Math.max(...v) : null;
  }, [rows]);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Comparativo entre cenários
        </h2>
        <p className="text-xs text-slate-500">
          Inclui o cenário <strong>base</strong> (todas as UFs individuais), a
          <strong> configuração atual</strong> e os cenários salvos.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[60rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-700">Cenário</th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Unidades
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Polos
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                UFs solo
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Inscritos
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Valor projetado
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Custo médio / cand.
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Menor R$/cand.
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Maior R$/cand.
              </th>
              <th className="px-3 py-2 text-right font-medium text-slate-700">
                Δ vs. atual
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const isCurrent = m.kind === "current";
              const delta = m.valor - currentValor;
              const deltaPct =
                currentValor > 0 ? (delta / currentValor) * 100 : 0;
              const isMinCusto =
                minCusto != null && m.custoMedio === minCusto && rows.length > 1;
              const isMaxCusto =
                maxCusto != null && m.custoMedio === maxCusto && rows.length > 1;
              return (
                <tr
                  key={m.id}
                  className={[
                    "border-b border-slate-100 last:border-0",
                    isCurrent ? "bg-violet-50/60" : "",
                  ].join(" ")}
                >
                  <td className="px-3 py-2 text-slate-800">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {m.name}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
                            atual
                          </span>
                        )}
                        {m.kind === "baseline" && (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700">
                            base
                          </span>
                        )}
                      </span>
                      {m.createdAt && (
                        <span className="text-[10px] text-slate-500">
                          Salvo em{" "}
                          {new Date(m.createdAt).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {m.unidades}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {m.polos}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {m.individuais}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {integer.format(m.inscritos)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {currency.format(m.valor)}
                  </td>
                  <td
                    className={[
                      "px-3 py-2 text-right tabular-nums",
                      isMinCusto
                        ? "font-semibold text-emerald-700"
                        : isMaxCusto
                          ? "font-semibold text-rose-700"
                          : "text-slate-900",
                    ].join(" ")}
                    title={
                      isMinCusto
                        ? "Menor custo médio por candidato"
                        : isMaxCusto
                          ? "Maior custo médio por candidato"
                          : undefined
                    }
                  >
                    {m.custoMedio != null
                      ? currencyFine.format(m.custoMedio)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {m.custoMin ? (
                      <span title={`UF/Polo: ${m.custoMin.label}`}>
                        {currencyFine.format(m.custoMin.value)}{" "}
                        <span className="text-[10px] text-slate-500">
                          ({m.custoMin.label})
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {m.custoMax ? (
                      <span title={`UF/Polo: ${m.custoMax.label}`}>
                        {currencyFine.format(m.custoMax.value)}{" "}
                        <span className="text-[10px] text-slate-500">
                          ({m.custoMax.label})
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={[
                      "px-3 py-2 text-right tabular-nums",
                      isCurrent
                        ? "text-slate-500"
                        : delta > 0
                          ? "text-rose-700"
                          : delta < 0
                            ? "text-emerald-700"
                            : "text-slate-700",
                    ].join(" ")}
                  >
                    {isCurrent ? (
                      "—"
                    ) : (
                      <>
                        {delta >= 0 ? "+" : "−"}
                        {currency.format(Math.abs(delta))}
                        {currentValor > 0 && (
                          <span className="ml-1 text-[10px] text-slate-500">
                            ({delta >= 0 ? "+" : "−"}
                            {Math.abs(deltaPct).toFixed(1).replace(".", ",")}%)
                          </span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle"></span>{" "}
          Menor custo médio por candidato.
        </li>
        <li>
          <span className="inline-block h-2 w-2 rounded-full bg-rose-600 align-middle"></span>{" "}
          Maior custo médio por candidato.
        </li>
        <li>
          <strong>Base</strong>: nenhuma UF agrupada (referência).{" "}
          <strong>Atual</strong>: configuração em tela.
        </li>
      </ul>
    </section>
  );
}
