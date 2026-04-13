## Controle Orçamentário - 31º CPR

Aplicação web para controle de pagamentos mensais por UF, com gráficos dinâmicos e filtros para análises comparativas.

## Tecnologias

- [Next.js](https://nextjs.org/) (frontend e deploy na Vercel)
- [Supabase](https://supabase.com/) (base de dados PostgreSQL)
- [Recharts](https://recharts.org/) (gráficos dinâmicos)

## Configuração

### Supabase

1. No [painel do Supabase](https://supabase.com/dashboard), abra o projeto → **Settings** → **API**.

2. Copie:
   - **Project URL** (ex.: `https://rjskuzsghzhwxoujobwo.supabase.co`) → use em `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon public** (JWT longo) → use em `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Crie o arquivo local (não versionado):

```bash
cp .env.example .env.local
```

4. Cole URL e chave **anon** em `.env.local`. Este app usa apenas essas duas variáveis com o cliente `@supabase/supabase-js`.

**Importante:** não coloque a chave **secret** nem **service_role** em variáveis `NEXT_PUBLIC_*` (elas não devem ir para o bundle do navegador). As chaves no formato `sb_publishable_` / `sb_secret_` são alternativas mais recentes; o código atual segue o par **URL + anon JWT** acima.

5. Garanta que as tabelas abaixo existam no Supabase com os nomes/colunas exatos:
   - `pgto_coord_2025`
   - `pgto_coord_2026`
   - `pgto_uf_2025`
   - `pgto_uf_2026`
   - `qtd_inscrit_uf` (colunas `uf` e `qtd_inscrit`)

## Executar localmente

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Estrutura dos dados

As tabelas de pagamento são lidas no formato "colunas por mês" (ex.: `mar./25`, `fev./26`) e normalizadas internamente para o dashboard.

## Funcionalidades implementadas

- Filtro por mês
- Filtro por múltiplas UFs
- Total, média e quantidade de registros
- Gráfico de barras por UF
- Gráfico de linha da evolução mensal
- Gráfico de pizza de participação por UF
- Gráfico comparativo entre UFs ao longo dos meses

## Deploy

1. Envie o código para um repositório no GitHub.
2. Importe o repositório na [Vercel](https://vercel.com/).
3. No painel da Vercel (**Settings** → **Environment Variables**), adicione as mesmas duas variáveis do `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (valores iguais aos do Supabase, não commite o arquivo `.env.local` no Git).
