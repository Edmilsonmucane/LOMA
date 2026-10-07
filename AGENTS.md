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

## Comandos previstos (M0)

- pnpm install --frozen-lockfile
- pnpm dev
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm test:e2e
- pnpm build
- pnpm format:check

## Memória

Ler docs/DECISIONS.md, docs/ARCHITECTURE.md e docs/DESIGN.md antes de alterações estruturais. Não declarar marcos aceites sem validação executada.
