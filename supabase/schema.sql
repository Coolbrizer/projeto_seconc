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

-- Lançamentos de gratificação no GPS (espelho da planilha: competência, data, grupo, referência, PGR).
create table if not exists public.gratificacao_gps (
  id uuid primary key default gen_random_uuid(),
  competencia_ano int not null check (competencia_ano >= 2000 and competencia_ano <= 2100),
  data_lancamento_gps date,
  grupo text not null,
  referencia text not null,
  amount numeric(14, 2) check (amount is null or amount >= 0),
  documento_seconc text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gratificacao_gps_competencia
  on public.gratificacao_gps (competencia_ano);

create index if not exists idx_gratificacao_gps_grupo
  on public.gratificacao_gps (grupo);

create index if not exists idx_gratificacao_gps_data_gps
  on public.gratificacao_gps (data_lancamento_gps);

alter table public.gratificacao_gps enable row level security;

drop policy if exists "Leitura publica gratificacao_gps" on public.gratificacao_gps;
create policy "Leitura publica gratificacao_gps"
  on public.gratificacao_gps
  for select
  to anon, authenticated
  using (true);
