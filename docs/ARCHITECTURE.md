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
