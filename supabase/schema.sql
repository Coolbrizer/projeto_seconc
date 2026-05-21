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

-- A partir de 30/05/2026 (novos projetos) e 30/10/2026 (projetos existentes),
-- o Supabase não concede acesso à Data API por padrão. GRANT explícito é obrigatório.
grant select on public.monthly_payments to anon, authenticated;

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

grant select on public.pgto_fiscalizacao to anon, authenticated;

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

grant select on public.pgto_comissao_medica to anon, authenticated;

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

grant select on public.pgto_assessoria_2025 to anon, authenticated;

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

grant select on public.pgto_assessoria_2026 to anon, authenticated;

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

-- Arrecadação com inscrições (não é despesa): parâmetros do concurso.
create table if not exists public.arrecadacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '31º CPR',
  total_inscritos int not null check (total_inscritos >= 0),
  isencoes_deferidas int not null check (isencoes_deferidas >= 0),
  valor_inscricao numeric(14, 2) not null check (valor_inscricao >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arrecadacao_isencoes_lte_total check (isencoes_deferidas <= total_inscritos),
  constraint arrecadacao_nome_unique unique (nome)
);

alter table public.arrecadacao enable row level security;

drop policy if exists "Leitura publica arrecadacao" on public.arrecadacao;
create policy "Leitura publica arrecadacao"
  on public.arrecadacao
  for select
  to anon, authenticated
  using (true);

grant select on public.arrecadacao to anon, authenticated;

insert into public.arrecadacao (nome, total_inscritos, isencoes_deferidas, valor_inscricao)
values ('31º CPR', 10372, 2565, 250.00)
on conflict (nome) do update set
  total_inscritos = excluded.total_inscritos,
  isencoes_deferidas = excluded.isencoes_deferidas,
  valor_inscricao = excluded.valor_inscricao,
  updated_at = now();

-- ============================================================================
-- Usuários da aplicação. Login dos gestores do SECONC.
-- A coluna `senha_hash` guarda um hash bcrypt gerado por `crypt(senha, gen_salt('bf'))`.
-- NUNCA inserir a senha em texto puro nesta coluna — sempre passar pelo `crypt()`.
-- Acesso fechado para anon/authenticated: apenas o service_role (servidor Next.js)
-- consulta esta tabela. Assim os hashes nunca trafegam pelo navegador.
-- ============================================================================
create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  senha_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_usuarios_email on public.usuarios (lower(email));

alter table public.usuarios enable row level security;

drop policy if exists "Nega leitura publica usuarios" on public.usuarios;
create policy "Nega leitura publica usuarios"
  on public.usuarios
  for select
  to anon, authenticated
  using (false);

revoke all on public.usuarios from anon, authenticated;

create or replace function public.usuarios_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_usuarios_set_updated_at on public.usuarios;
create trigger trg_usuarios_set_updated_at
  before update on public.usuarios
  for each row execute function public.usuarios_set_updated_at();

-- Seed inicial dos gestores. As senhas em texto puro NÃO são armazenadas:
-- `crypt(..., gen_salt('bf', 10))` produz um hash bcrypt na hora do insert.
-- O `on conflict (email) do nothing` mantém o arquivo idempotente: reexecutar
-- não duplica e não sobrescreve senhas já cadastradas (use UPDATE manual para isso).
insert into public.usuarios (nome, email, senha_hash)
values
  (
    'Alexandre Cezar Damasceno',
    'alexandredamasceno@mpf.mp.br',
    crypt('Rpvl2027@', gen_salt('bf', 10))
  ),
  (
    'Marcos Silvestre',
    'marcossilvestre@mpf.mp.br',
    crypt('31cprPrincipe', gen_salt('bf', 10))
  )
on conflict (email) do nothing;

-- Exemplo de validação no app (executado com service_role):
--   select id, nome, email
--   from public.usuarios
--   where lower(email) = lower($1)
--     and senha_hash = crypt($2, senha_hash);

-- ============================================================================
-- GRANTs para tabelas mantidas fora deste arquivo (importadas de planilhas).
-- Necessário a partir de 30/10/2026 para o app ler via Data API (supabase-js).
-- O bloco DO ignora silenciosamente as tabelas que ainda não existem.
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'pgto_uf_2025',
    'pgto_uf_2026',
    'pgto_coord_2025',
    'pgto_coord_2026',
    'pgto_banca',
    'pgto_execucao',
    'qtd_inscrit_uf'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format(
        'grant select on public.%I to anon, authenticated',
        t
      );
    end if;
  end loop;
end
$$;
