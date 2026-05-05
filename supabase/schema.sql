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

-- Assessoria especial: uma linha por ano; colunas no formato mai./25, jan./26, etc.
create table if not exists public.pgto_assessoria_2025 (
  id uuid primary key default gen_random_uuid(),
  uf text not null default 'BR' check (char_length(uf) = 2),
  "jan./25" numeric(14, 2),
  "fev./25" numeric(14, 2),
  "mar./25" numeric(14, 2),
  "abr./25" numeric(14, 2),
  "mai./25" numeric(14, 2),
  "jun./25" numeric(14, 2),
  "jul./25" numeric(14, 2),
  "ago./25" numeric(14, 2),
  "set./25" numeric(14, 2),
  "out./25" numeric(14, 2),
  "nov./25" numeric(14, 2),
  "dez./25" numeric(14, 2),
  constraint pgto_assessoria_2025_uf_unique unique (uf)
);

alter table public.pgto_assessoria_2025 enable row level security;

drop policy if exists "Leitura publica pgto_assessoria_2025" on public.pgto_assessoria_2025;
create policy "Leitura publica pgto_assessoria_2025"
  on public.pgto_assessoria_2025
  for select
  to anon, authenticated
  using (true);

create table if not exists public.pgto_assessoria_2026 (
  id uuid primary key default gen_random_uuid(),
  uf text not null default 'BR' check (char_length(uf) = 2),
  "jan./26" numeric(14, 2),
  "fev./26" numeric(14, 2),
  "mar./26" numeric(14, 2),
  "abr./26" numeric(14, 2),
  "mai./26" numeric(14, 2),
  "jun./26" numeric(14, 2),
  "jul./26" numeric(14, 2),
  "ago./26" numeric(14, 2),
  "set./26" numeric(14, 2),
  "out./26" numeric(14, 2),
  "nov./26" numeric(14, 2),
  "dez./26" numeric(14, 2),
  constraint pgto_assessoria_2026_uf_unique unique (uf)
);

alter table public.pgto_assessoria_2026 enable row level security;

drop policy if exists "Leitura publica pgto_assessoria_2026" on public.pgto_assessoria_2026;
create policy "Leitura publica pgto_assessoria_2026"
  on public.pgto_assessoria_2026
  for select
  to anon, authenticated
  using (true);

-- Dados iniciais (uma linha BR por tabela). Reexecutar: delete antes ou use on conflict.
insert into public.pgto_assessoria_2025 (uf, "mai./25", "jun./25", "jul./25", "ago./25", "set./25", "out./25", "nov./25", "dez./25")
values ('BR', 17809.44, 15265.24, 18445.49, 18763.52, 20671.67, 25124.04, 21625.75, 15901.29)
on conflict (uf) do update set
  "mai./25" = excluded."mai./25",
  "jun./25" = excluded."jun./25",
  "jul./25" = excluded."jul./25",
  "ago./25" = excluded."ago./25",
  "set./25" = excluded."set./25",
  "out./25" = excluded."out./25",
  "nov./25" = excluded."nov./25",
  "dez./25" = excluded."dez./25";

insert into public.pgto_assessoria_2026 (uf, "jan./26", "fev./26", "mar./26", "abr./26")
values ('BR', 14629.18, 19717.60, 24806.01, 18445.49)
on conflict (uf) do update set
  "jan./26" = excluded."jan./26",
  "fev./26" = excluded."fev./26",
  "mar./26" = excluded."mar./26",
  "abr./26" = excluded."abr./26";
