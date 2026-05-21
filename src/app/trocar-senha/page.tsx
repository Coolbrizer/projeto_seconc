import { clearSession, requireSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

import { TrocarSenhaForm } from "./trocar-senha-form";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await clearSession();
  redirect("/login");
}

export default async function TrocarSenhaPage() {
  const user = await requireSessionUser();
  const provisional = user.mustChangePassword;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Trocar senha</h1>
        <p className="mt-1 text-sm text-slate-600">
          Conectado como{" "}
          <strong className="text-slate-800">{user.nome || user.email}</strong>
          .
        </p>

        {provisional && (
          <div
            role="status"
            className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            Você está usando uma <strong>senha provisória</strong>. Escolha uma
            senha pessoal para continuar.
          </div>
        )}

        <div className="mt-6">
          <TrocarSenhaForm />
        </div>

        <form action={logoutAction} className="mt-4">
          <button
            type="submit"
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sair sem trocar
          </button>
        </form>
      </section>
    </main>
  );
}
