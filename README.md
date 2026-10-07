# LOMA

Plataforma de microcrédito SaaS white-label para Moçambique. Interface em pt-MZ, moeda inicial MZN e fuso Africa/Maputo.

## Estado

M0: monorepo, ferramentas de qualidade e sistema de design. Não há ainda autenticação, base de dados ou operações de crédito. O catálogo identifica os dados como demonstrações. O motor financeiro será implementado em M2, e a demonstração com `pnpm seed` em M8.

## Instalar e correr

Requisitos: Node.js 24 e pnpm 10.34.6 (versão fixada no projecto). Com Corepack instalado:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Abra a rota `/design` do servidor de desenvolvimento para consultar os componentes. Não são necessários segredos ou serviços pagos para M0. A instalação habitual demora menos de 10 minutos, dependendo da rede. O catálogo devolve 404 em produção.

## Verificar

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm build
```

Os testes de navegador usam Chromium em computador e emulação de Pixel 7; verificam drawers, foco, pesquisa, tabs, tabelas, contraste, movimento reduzido e regras WCAG AA automatizáveis. A verificação automática não substitui revisão visual e utilização com leitor de ecrã.

Se Chromium já estiver instalado, pode usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e`. A CI instala o navegador do Playwright.

## Ambiente Codex cloud

O ambiente tem um pnpm global diferente e a pasta pessoal é restrita. Use os shims do Corepack e caches exteriores ao checkout:

```sh
export COREPACK_HOME=/workspace/.cache/corepack
export PATH=/workspace/.loma-bin:$PATH
mkdir -p /workspace/.loma-bin
corepack enable --install-directory /workspace/.loma-bin
pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store --cache-dir /workspace/.pnpm-cache
pnpm dev
```

As instruções reutilizáveis do ambiente registam estes passos. Processos precisam de ser iniciados em cada nova tarefa; dependências instaladas podem ser preservadas no snapshot.

## Organização

- `apps/web`: Next.js, catálogos de tradução e aplicação.
- `packages/ui`: tokens, componentes Radix/Phosphor e tabelas TanStack.
- `packages/loan-engine`: fronteira financeira pura, reservada para M2.
- `docs`: decisões, arquitectura, design e progresso dos marcos.

Leia [AGENTS.md](AGENTS.md) e [docs/DECISIONS.md](docs/DECISIONS.md) antes de desenvolver. A stack Supabase, RLS e autenticação entram em M1. Nenhuma configuração legal ou financeira será fixada no código.
