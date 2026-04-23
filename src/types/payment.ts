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

/** Tabela `pgto_fiscalizacao` (tipo de aplicação, valor, ano). */
export type FiscalizacaoPaymentRecord = {
  id: string;
  tipo: string;
  ano: number;
  amount: number;
};

/** Tabela `pgto_comissao_medica` (mês, valor, ano). */
export type ComissaoMedicaPaymentRecord = {
  id: string;
  mes: string;
  ano: number;
  amount: number;
};

/** Tabela `pgto_execucao` (descrição, valor, ano). */
export type ExecucaoPaymentRecord = {
  id: string;
  descricao: string;
  ano: number;
  amount: number;
};

export type DashboardDataNotice = "missing_supabase" | "supabase_fetch_error";

export type DashboardData = {
  payments: PaymentRecord[];
  /** Pagamentos à banca examinadora (tabela `pgto_banca`). */
  bancaPayments: BancaPaymentRecord[];
  /** Fiscalização / aplicação de prova (`pgto_fiscalizacao`). */
  fiscalizacaoPayments: FiscalizacaoPaymentRecord[];
  /** Comissão médica / comissão especial de avaliação (`pgto_comissao_medica`). */
  comissaoMedicaPayments: ComissaoMedicaPaymentRecord[];
  /** Execução do concurso (`pgto_execucao`). */
  execucaoPayments: ExecucaoPaymentRecord[];
  enrolledByUf: Record<string, number>;
  /** Quando não há dados reais ou falhou leitura (evita confundir com demo). */
  dataNotice?: DashboardDataNotice;
  /** True se a tabela qtd_inscrit_uf não pôde ser lida (pagamentos seguem ok). */
  enrolledUnavailable?: boolean;
};
