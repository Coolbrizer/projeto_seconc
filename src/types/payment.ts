export type PaymentRecord = {
  id: string;
  uf: string;
  reference_month: string;
  amount: number;
  created_at: string;
  source: "coord" | "uf";
};

export type DashboardData = {
  payments: PaymentRecord[];
  enrolledByUf: Record<string, number>;
};
