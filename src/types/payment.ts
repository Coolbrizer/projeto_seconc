export type PaymentRecord = {
  id: string;
  uf: string;
  reference_month: string;
  amount: number;
  created_at: string;
  source: "coord" | "uf";
};

/** Linhas da tabela `pgto_banca` (atividade, valor, ano, ordem). */
export type BancaPaymentRecord = {
  id: string;
  atv: string;
  ano: number;
  amount: number;
  ordem: number | null;
};

/** Linha da tabela `gratificacao_gps` (planilha “Pagamento Gratificação 31º CPR”). */
export type GratificacaoGpsRecord = {
  id: string;
  competencia_ano: number;
  /** ISO `YYYY-MM-DD` ou null se ainda não lançado / “-”. */
  data_lancamento_gps: string | null;
  grupo: string;
  referencia: string;
  /** Null quando o valor ainda não consta na planilha. */
  amount: number | null;
  documento_seconc: string | null;
};

export type DashboardDataNotice = "missing_supabase" | "supabase_fetch_error";

export type DashboardData = {
  payments: PaymentRecord[];
  /** Pagamentos à banca examinadora (tabela `pgto_banca`). */
  bancaPayments: BancaPaymentRecord[];
  /** Lançamentos consolidados no GPS (tabela `gratificacao_gps`). */
  gratificacaoGps: GratificacaoGpsRecord[];
  enrolledByUf: Record<string, number>;
  /** Quando não há dados reais ou falhou leitura (evita confundir com demo). */
  dataNotice?: DashboardDataNotice;
  /** True se a tabela qtd_inscrit_uf não pôde ser lida (pagamentos seguem ok). */
  enrolledUnavailable?: boolean;
};
