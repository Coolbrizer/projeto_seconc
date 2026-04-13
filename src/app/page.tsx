import { PaymentsDashboard } from "@/components/payments-dashboard";
import { getDashboardData } from "@/lib/payments";

/** Sem isso, o Next gera a página no `next build` e os dados do Supabase ficam “congelados” (ex.: tudo zerado). */
export const dynamic = "force-dynamic";

export default async function Home() {
  const { payments, bancaPayments, enrolledByUf, dataNotice, enrolledUnavailable } =
    await getDashboardData();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8 md:py-8">
      <PaymentsDashboard
        payments={payments}
        bancaPayments={bancaPayments}
        enrolledByUf={enrolledByUf}
        dataNotice={dataNotice}
        enrolledUnavailable={enrolledUnavailable}
      />
    </div>
  );
}
