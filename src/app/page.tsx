import { PaymentsDashboard } from "@/components/payments-dashboard";
import { clearSession, requireSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/payments";
import { redirect } from "next/navigation";

/** Sem isso, o Next gera a página no `next build` e os dados do Supabase ficam “congelados” (ex.: tudo zerado). */
export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await clearSession();
  redirect("/login");
}

export default async function Home() {
  const user = await requireSessionUser();
  const {
    payments,
    bancaPayments,
    fiscalizacaoPayments,
    comissaoMedicaPayments,
    execucaoPayments,
    enrolledByUf,
    dataNotice,
    enrolledUnavailable,
  } = await getDashboardData();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8 md:py-8">
      <header className="mx-auto mb-4 flex w-full max-w-7xl items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-700">
          Conectado como <strong>{user.email}</strong>
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sair
          </button>
        </form>
      </header>
      <PaymentsDashboard
        payments={payments}
        bancaPayments={bancaPayments}
        fiscalizacaoPayments={fiscalizacaoPayments}
        comissaoMedicaPayments={comissaoMedicaPayments}
        execucaoPayments={execucaoPayments}
        enrolledByUf={enrolledByUf}
        dataNotice={dataNotice}
        enrolledUnavailable={enrolledUnavailable}
      />
    </div>
  );
}
