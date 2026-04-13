## Controle Orçamentário - 31º CPR

Aplicação web para controle de pagamentos mensais por UF, com gráficos dinâmicos e filtros para análises comparativas.

## Tecnologias

- [Next.js](https://nextjs.org/) (frontend e deploy na Vercel)
- [Supabase](https://supabase.com/) (base de dados PostgreSQL)
- [Recharts](https://recharts.org/) (gráficos dinâmicos)

## Configuração

1. Copie as variáveis de ambiente:

```bash
cp .env.example .env.local
```

2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Garanta que as tabelas abaixo existam no Supabase com os nomes/colunas exatos:
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
3. Configure as variáveis de ambiente do Supabase no painel da Vercel.
