# LOMA

Plataforma SaaS white-label de microcrédito para Moçambique. Interface pt-MZ, moeda inicial MZN e fuso Africa/Maputo.

## Estado

M0 e M1: sistema de design, tenants isolados por RLS, autenticação do pessoal, perfis editáveis, agências, marca, auditoria, TOTP e painel da plataforma. Produtos, mensagens e site são criados como configuração inicial **não publicada**. O motor e as operações financeiras começam em M2; os módulos futuros indicam esse estado na interface.

## Instalar e correr

Requisitos: Node.js 24, pnpm 10.34.6 e Docker com Compose v2 em execução. Não são necessárias contas pagas.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm services:start
pnpm local:env
pnpm local:seed
pnpm dev
```

A instalação com imagens em cache demora habitualmente menos de 10 minutos; o primeiro descarregamento depende da rede. O comando de serviços aplica as migrações SQL e preserva o volume existente. `pnpm services:stop` pára os serviços sem apagar dados. Não usar `down --volumes` em bases com dados a preservar.

O painel da plataforma usa o host raiz na rota `/login`. O microcrédito de demonstração usa `demo.localhost:3000/login`; o segundo tenant usa `beira.localhost:3000/login`. O navegador deve resolver subdomínios de localhost (Chromium faz isso). As credenciais aleatórias dos cinco utilizadores locais estão apenas em `.local/accounts.json`; abra esse ficheiro localmente, sem o partilhar ou colocar no Git. A seed é repetível e não redefine palavras-passe nem apaga dados existentes. Convites de equipa são capturados pelo Mailpit, porta 54324, sem enviar emails externos.

`/design` mostra o catálogo de componentes durante desenvolvimento e devolve 404 em produção. A demonstração financeira com 120 clientes e `pnpm seed` será entregue em M8.

## Verificar

Com os serviços e fixtures locais preparados:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:rls
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm build
```

A verificação RLS usa sessões reais do Supabase Auth, PostgreSQL e PostgREST: leitura/escrita entre tenants, restrições de perfil/agência, auditoria, TOTP e validade da sessão. Executá-la antes dos testes do navegador: altera temporariamente a configuração de segurança dos fixtures e repõe-a ao terminar. Playwright testa computador e Pixel 7, criação de tenant, equipa, marca, recusas de acesso e acessibilidade. Chromium existente pode ser usado com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e`.

`pnpm db:types` actualiza os tipos TypeScript a partir do esquema local aplicado; os tipos ficam versionados. Migrações aplicadas têm checksum: criar nova migração em vez de alterar uma já aplicada.

## Base de dados e produção

O ambiente local usa PostgreSQL 17 e imagens oficiais de Supabase Auth/PostgREST, mais um proxy HTTP mínimo e Mailpit. Não inclui Storage, cron nem o painel Studio: entram com os módulos que deles precisam. O Docker deste sandbox usa vfs; por isso foi evitada a imagem monolítica de PostgreSQL do CLI Supabase.

Em produção, usar Supabase alojado e Vercel. Criar variáveis de `.env.example` no ambiente seguro do servidor, configurar o domínio base e wildcard, aplicar `supabase/migrations` e configurar os URLs de convite permitidos no Auth. O modelo de convite está em `supabase/templates/invite.html`; copiar para a configuração de email do projecto. O primeiro super-admin é registado em `platform_admins` por um operador autorizado com acesso administrativo à base, nunca por auto-registo. A chave service-role é exclusiva do servidor e serve apenas os convites após autorização do gestor; as operações do tenant usam a sessão do utilizador e RLS.

A política de tamanho mínimo da palavra-passe é aplicada no formulário/servidor; configurar também o mínimo global do Auth. A política adicional por tenant não substitui a política global do fornecedor. TOTP e validade da sessão são reforçados na base. O provisionamento de produção, DNS, emails externos e restauro de backups alojados não foram validados neste ambiente local.

## Ambiente Codex cloud

A pasta pessoal é restrita e o pnpm global é diferente. Activar os shims e caches exteriores ao checkout:

```sh
export COREPACK_HOME=/workspace/.cache/corepack
export PATH=/workspace/.loma-bin:$PATH
export XDG_CONFIG_HOME=/workspace/.config XDG_DATA_HOME=/workspace/.local/share XDG_CACHE_HOME=/workspace/.cache
mkdir -p /workspace/.loma-bin
corepack enable --install-directory /workspace/.loma-bin
export npm_config_https_proxy="${HTTPS_PROXY:-${https_proxy:-}}"
pnpm install --frozen-lockfile --store-dir /workspace/.pnpm-store --cache-dir /workspace/.pnpm-cache
```

Os processos e contentores devem ser iniciados novamente em cada tarefa. Nunca imprimir `.env.local`, os ficheiros privados de `.local` ou argumentos com credenciais. O rascunho do ambiente inclui os passos reutilizáveis; publicar o snapshot é uma acção nas definições do ambiente.

## Organização

- `apps/web`: Next.js, aplicação e catálogos de tradução.
- `packages/ui`: tokens e componentes Radix/Phosphor/TanStack.
- `packages/loan-engine`: motor puro, reservado para M2.
- `supabase`: migrações, stack local e modelo de convite.
- `scripts`: arranque, bindings locais, fixtures, tipos e teste real de RLS.
- `docs`: decisões, arquitectura, design, recuperação e progresso.

Leia [AGENTS.md](AGENTS.md) e [docs/DECISIONS.md](docs/DECISIONS.md) antes de desenvolver.
