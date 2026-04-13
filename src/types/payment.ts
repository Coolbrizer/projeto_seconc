export type PaymentRecord = {
  id: string;
  uf: string;
  reference_month: string;
  amount: number;
  created_at: string;
  source: "coord" | "uf";
};

/** Linhas da tabela `pgto_banca` (atividade, valor, ano). */
export type BancaPaymentRecord = {
  id: string;
  atv: string;
  ano: number;
  amount: number;
};

export type DashboardDataNotice = "missing_supabase" | "supabase_fetch_error";

export type DashboardData = {
  payments: PaymentRecord[];
  /** Pagamentos à banca examinadora (tabela `pgto_banca`). */
  bancaPayments: BancaPaymentRecord[];
  enrolledByUf: Record<string, number>;
  /** Quando não há dados reais ou falhou leitura (evita confundir com demo). */
  dataNotice?: DashboardDataNotice;
  /** True se a tabela qtd_inscrit_uf não pôde ser lida (pagamentos seguem ok). */
  enrolledUnavailable?: boolean;
};
