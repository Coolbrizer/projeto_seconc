"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  carregarUsuariosAction,
  criarUsuarioAction,
  redefinirSenhaAction,
} from "@/app/acessos/actions";
import type { Usuario } from "@/lib/usuarios";

/** Senha provisória exibida no UI (deve bater com `SENHA_PROVISORIA` do servidor). */
const SENHA_PROVISORIA_LABEL = "123456";

type Feedback = {
  tone: "success" | "error" | "info";
  message: string;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateFormatter.format(date);
}

export function AccessModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [formPending, startFormTransition] = useTransition();
  const [resetPendingEmail, setResetPendingEmail] = useState<string | null>(
    null,
  );

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await carregarUsuariosAction();
      if (!result.ok) {
        setUsuarios([]);
        setLoadError(
          "A tabela de usuários ainda não está disponível no banco. " +
            "Confira se `SUPABASE_SERVICE_ROLE_KEY` está no `.env.local` e " +
            "se o bloco da tabela `public.usuarios` já foi aplicado no " +
            "Supabase.",
        );
      } else {
        setUsuarios(result.usuarios);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erro ao carregar usuários.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchUsuarios();
    } else {
      setFeedback(null);
      setNome("");
      setEmail("");
      setResetPendingEmail(null);
    }
  }, [open, fetchUsuarios]);

  function handleAdicionar(formData: FormData) {
    setFeedback(null);
    startFormTransition(async () => {
      const result = await criarUsuarioAction(formData);
      if (result.ok) {
        setFeedback({
          tone: "success",
          message: `Usuário criado. Senha provisória: ${SENHA_PROVISORIA_LABEL}`,
        });
        setNome("");
        setEmail("");
        await fetchUsuarios();
      } else {
        const msg =
          result.error === "duplicado"
            ? "Já existe um usuário com este e-mail."
            : result.error === "indisponivel"
              ? "Tabela `usuarios` indisponível no banco. Aplique o schema e configure `SUPABASE_SERVICE_ROLE_KEY`."
              : (result.message ?? "Erro ao criar usuário.");
        setFeedback({ tone: "error", message: msg });
      }
    });
  }

  async function handleResetSenha(target: Usuario) {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Resetar a senha de "${target.nome}" para a senha provisória ${SENHA_PROVISORIA_LABEL}?`,
      );
      if (!ok) return;
    }
    setFeedback(null);
    setResetPendingEmail(target.email);
    try {
      const result = await redefinirSenhaAction(target.email);
      if (result.ok) {
        setFeedback({
          tone: "success",
          message: `Senha de ${target.email} redefinida para ${SENHA_PROVISORIA_LABEL}.`,
        });
      } else {
        const msg =
          result.error === "nao_encontrado"
            ? "Usuário não encontrado."
            : result.error === "indisponivel"
              ? "Tabela `usuarios` indisponível no banco."
              : (result.message ?? "Erro ao redefinir senha.");
        setFeedback({ tone: "error", message: msg });
      }
    } finally {
      setResetPendingEmail(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
        title="Gerenciar usuários com acesso ao sistema"
      >
        <span aria-hidden>🔐</span>
        Acessos
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar acessos"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Gerenciar acessos
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Usuários cadastrados podem fazer login no sistema. A senha
                  provisória padrão é{" "}
                  <code className="rounded bg-slate-200 px-1 font-mono text-[11px] text-slate-800">
                    {SENHA_PROVISORIA_LABEL}
                  </code>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-4">
              {feedback && (
                <div
                  role="status"
                  className={[
                    "rounded-lg border px-3 py-2 text-sm",
                    feedback.tone === "success"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : feedback.tone === "error"
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : "border-sky-300 bg-sky-50 text-sky-900",
                  ].join(" ")}
                >
                  {feedback.message}
                </div>
              )}

              <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Adicionar novo usuário
                </p>
                <form
                  action={handleAdicionar}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <label
                      htmlFor="novo-usuario-nome"
                      className="text-xs font-medium text-slate-700"
                    >
                      Nome
                    </label>
                    <input
                      id="novo-usuario-nome"
                      name="nome"
                      type="text"
                      required
                      maxLength={120}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex.: Fulano de Tal"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="novo-usuario-email"
                      className="text-xs font-medium text-slate-700"
                    >
                      E-mail
                    </label>
                    <input
                      id="novo-usuario-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="fulano@mpf.mp.br"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={formPending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {formPending ? "Criando..." : "Adicionar"}
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-slate-500">
                  O usuário criado receberá a senha provisória{" "}
                  <strong>{SENHA_PROVISORIA_LABEL}</strong>. Avise para que
                  troque no primeiro acesso.
                </p>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Usuários cadastrados
                </p>
                {loading ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                    Carregando...
                  </p>
                ) : loadError ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <p className="font-medium">Não foi possível carregar.</p>
                    <p className="mt-1 leading-relaxed">{loadError}</p>
                  </div>
                ) : usuarios.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                    Nenhum usuário cadastrado.
                  </p>
                ) : (
                  <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-200 text-left">
                          <th className="px-3 py-2 font-medium text-slate-700">
                            Nome
                          </th>
                          <th className="px-3 py-2 font-medium text-slate-700">
                            E-mail
                          </th>
                          <th className="px-3 py-2 font-medium text-slate-700">
                            Cadastrado em
                          </th>
                          <th className="w-36 px-3 py-2 text-right font-medium text-slate-700"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map((u) => (
                          <tr
                            key={u.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-3 py-2 text-slate-800">
                              {u.nome}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {u.email}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {formatDate(u.createdAt)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleResetSenha(u)}
                                disabled={resetPendingEmail === u.email}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                title={`Redefinir senha para ${SENHA_PROVISORIA_LABEL}`}
                              >
                                {resetPendingEmail === u.email
                                  ? "Resetando..."
                                  : "Resetar senha"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
