import Link from "next/link";
import { redirect } from "next/navigation";

import { ProjectionDashboard } from "@/components/projection-dashboard";
import { clearSession, requireSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/payments";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await clearSession();
  redirect("/login");
}

export default async function ProjecaoPage() {
  const user = await requireSessionUser();
  const { payments, enrolledByUf, enrolledUnavailable, dataNotice } =
    await getDashboardData();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8 md:py-8">
      <header className="mx-auto mb-4 flex w-full max-w-7xl flex-col gap-3 rounded-lg bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          Conectado como <strong>{user.email}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span aria-hidden>←</span>
            Voltar ao painel
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <ProjectionDashboard
        payments={payments}
        enrolledByUf={enrolledByUf}
        enrolledUnavailable={enrolledUnavailable}
        dataNotice={dataNotice}
      />
    </div>
  );
}
