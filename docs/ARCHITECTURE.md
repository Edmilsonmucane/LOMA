# Arquitectura

## Estrutura

- apps/web: Next.js App Router, aplicação de gestão e futuro site público.
- packages/ui: tokens CSS e componentes React acessíveis sobre Radix; conteúdo recebido por props.
- packages/loan-engine: domínio financeiro puro, sem UI ou base de dados; implementação em M2.
- supabase/migrations: esquema versionado e RLS a partir de M1.

## Fronteiras

O web orquestra autenticação e operações; o motor calcula em centavos bigint e decimal exacto. Postgres guarda dados com tenant_id e políticas RLS. Storage privado fornece URLs assinadas. Configuração financeira versionada é copiada para cada contrato aprovado. Segredos por tenant serão cifrados no servidor.

## M0

Catálogo /design em desenvolvimento. Testes de componentes e navegação por teclado; build de produção e verificação de ausência do catálogo. Não há ainda persistência, serviços financeiros ou autenticação.

## Próximos marcos

M1 tenants/auth; M2 motor/produtos; M3 clientes; M4 pedidos/contratos; M5 pagamentos/caixa; M6 comunicações; M7 site/área cliente; M8 relatórios/demonstração/acabamento.

## M1 — Identidade e isolamento

Browser → proxy.ts renova sessão Auth → context.ts valida Host, tenant, sessão e perfil → Server Actions validam dados Zod → SDK SSR envia JWT → PostgREST → RLS PostgreSQL. A autorização no servidor e RLS são verificadas em conjunto; escondê-la na interface não é controlo de segurança.

Globais: platform_admins, plans, presets, platform_audit_events. Negócio: tenants, branches, tenant_roles, memberships, tenant_configuration, audit_events. Todas têm RLS; todos os registos subordinados têm tenant_id e FKs compostas. Helpers security-definer têm search_path vazio. Descoberta pública do tenant expõe apenas marca e requisitos de acesso.

Provisionamento usa RPC e transacção única. Planos/limites/features e presets são dados editáveis. Convites ligam utilizadores existentes sem modificar a sua identidade/password global, ou criam convites Auth. Perfil e agência são sempre verificados no tenant de origem.

O ambiente local expõe API 54321, PostgreSQL 54322 e caixa de email 54324, apenas em loopback. O proxy serve /auth/v1, /rest/v1 e o template de convite; não substitui o gateway do Supabase de produção. Segredos e fixtures vivem em .local e apps/web/.env.local ignorados. PostgreSQL guarda dados num volume; migrações versionadas são aplicadas sob lock.

M1 não inclui Storage/cron, clientes, motor financeiro ou contratos. Essas fronteiras permanecem reservadas para M2–M8. Limites monetários e regras jurídicas continuam fora do código.
