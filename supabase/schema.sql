create extension if not exists "pgcrypto";

create table if not exists public.monthly_payments (
  id uuid primary key default gen_random_uuid(),
  uf text not null check (char_length(uf) = 2),
  reference_month date not null,
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (uf, reference_month)
);

create index if not exists idx_monthly_payments_reference_month
  on public.monthly_payments (reference_month);

create index if not exists idx_monthly_payments_uf
  on public.monthly_payments (uf);

alter table public.monthly_payments enable row level security;

drop policy if exists "Leitura publica pagamentos" on public.monthly_payments;
create policy "Leitura publica pagamentos"
  on public.monthly_payments
  for select
  to anon, authenticated
  using (true);

-- Aplicação de prova (fiscalização): tipo + valor + ano.
create table if not exists public.pgto_fiscalizacao (
  tipo text not null,
  valor numeric(14, 2) not null check (valor >= 0),
  ano int not null check (ano >= 2000 and ano <= 2100),
  primary key (tipo, ano)
);

create index if not exists idx_pgto_fiscalizacao_ano on public.pgto_fiscalizacao (ano);

alter table public.pgto_fiscalizacao enable row level security;

drop policy if exists "Leitura publica pgto_fiscalizacao" on public.pgto_fiscalizacao;
create policy "Leitura publica pgto_fiscalizacao"
  on public.pgto_fiscalizacao
  for select
  to anon, authenticated
  using (true);

-- Comissão especial de avaliação (valores por mês).
create table if not exists public.pgto_comissao_medica (
  mes text not null,
  valor numeric(14, 2) not null check (valor >= 0),
  ano int not null check (ano >= 2000 and ano <= 2100),
  primary key (mes, ano)
);

create index if not exists idx_pgto_comissao_medica_ano on public.pgto_comissao_medica (ano);

alter table public.pgto_comissao_medica enable row level security;

drop policy if exists "Leitura publica pgto_comissao_medica" on public.pgto_comissao_medica;
create policy "Leitura publica pgto_comissao_medica"
  on public.pgto_comissao_medica
  for select
  to anon, authenticated
  using (true);
