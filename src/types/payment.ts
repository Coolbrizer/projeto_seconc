export type PaymentRecord = {
  id: string;
  uf: string;
  reference_month: string;
  amount: number;
  created_at: string;
  source: "coord" | "uf";
};

export type DashboardDataNotice =
  | "missing_supabase"
  | "supabase_fetch_error"
  | "enrolled_fetch_error";

export type DashboardData = {
  payments: PaymentRecord[];
  enrolledByUf: Record<string, number>;
  /** Quando não há dados reais ou falhou leitura (evita confundir com demo). */
  dataNotice?: DashboardDataNotice;
};
