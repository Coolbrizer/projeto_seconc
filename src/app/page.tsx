import { PaymentsDashboard } from "@/components/payments-dashboard";
import { getDashboardData } from "@/lib/payments";

export default async function Home() {
  const { payments, enrolledByUf } = await getDashboardData();

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8 md:py-8">
      <PaymentsDashboard payments={payments} enrolledByUf={enrolledByUf} />
    </div>
  );
}
