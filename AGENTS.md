# LOMA — regras do projecto

Plataforma SaaS white-label de microcrédito para Moçambique. Interface pt-MZ; código e identificadores em inglês. Moeda inicial MZN, fuso Africa/Maputo.

## Trabalho

- Trabalhar por marcos M0–M8, em ordem. Antes de avançar: typecheck, lint, testes e commit; actualizar docs e relatar feito/falta.
- Escolher decisões simples e reversíveis; registar em docs/DECISIONS.md.
- Não fixar regras financeiras, fiscais ou legais no código. Condições aprovadas são snapshots imutáveis.
- Dinheiro em bigint (centavos); taxas em decimal.js; arredondamento meio para cima.
- Isolamento por tenant e RLS em todas as tabelas de negócio. Nunca guardar segredos no Git.
- Textos visíveis em catálogos next-intl; componentes sem textos fixos.
- Tokens próprios; Phosphor regular; Radix sem estilo; respeitar docs/DESIGN.md.
- Usar o checkout existente: cada tarefa cloud já é isolada. Não criar worktrees sem pedido explícito.

## Comandos (M0–M2)

- pnpm install --frozen-lockfile
- pnpm services:start / pnpm services:stop
- pnpm local:env / pnpm local:seed
- pnpm db:types (após migrações)
- pnpm backup:local (dump privado; ver docs/RECOVERY.md)
- pnpm test:rls (antes de Playwright; usa serviços reais)
- pnpm dev
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm test:engine (cobertura mínima de 95%)
- pnpm test:e2e
- pnpm build
- pnpm format:check

## Memória

Ler docs/DECISIONS.md, docs/ARCHITECTURE.md e docs/DESIGN.md antes de alterações estruturais. Não declarar marcos aceites sem validação executada.

## Segurança de M1

Operações de negócio usam cliente Supabase com cookies do utilizador e RLS. Service-role apenas para convites já autorizados; nunca para contornar políticas. Helpers SQL com search_path vazio; índices e chaves estrangeiras compostas com tenant_id. Não alterar migrações já aplicadas. .local e .env.local são privados, nunca imprimir os seus valores.

## Produtos e motor (M2)

Ler docs/LOAN_ENGINE.md antes de mudar cálculos. Não converter dinheiro ou taxas para Number. Versões de produto são imutáveis; gravação apenas por save_product, com revisão esperada e autorização. Conflitos usam PT409: SQLSTATE 40001 pode provocar repetição automática no PostgREST. Presets são dados editáveis, não regras jurídicas. Não imprimir argumentos de Server Actions; podem conter palavras-passe ou dados pessoais.
