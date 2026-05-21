"use client";

import { useActionState } from "react";

import {
  trocarSenhaAction,
  type TrocarSenhaActionState,
} from "./actions";

const INITIAL_STATE: TrocarSenhaActionState = {};

export function TrocarSenhaForm() {
  const [state, action, pending] = useActionState(
    trocarSenhaAction,
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label
          htmlFor="nova_senha"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Nova senha
        </label>
        <input
          id="nova_senha"
          name="nova_senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={120}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div>
        <label
          htmlFor="confirmar_senha"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Confirmar nova senha
        </label>
        <input
          id="confirmar_senha"
          name="confirmar_senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={120}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
          placeholder="Repita a nova senha"
        />
      </div>

      {state.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Definir nova senha"}
      </button>
    </form>
  );
}
