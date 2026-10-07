# Arquitectura

## Estrutura

- apps/web: Next.js App Router, aplicação de gestão e futuro site público.
- packages/ui: tokens CSS e componentes React acessíveis sobre Radix; conteúdo recebido por props.
- packages/loan-engine: domínio financeiro puro implementado, sem UI ou base de dados; API documentada em LOAN_ENGINE.md.
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

## M2 — Motor e produtos

React Hook Form + Zod → simulador puro local → Server Action autenticada → validação financeira exacta → RPC save_product → versões imutáveis + cabeçalho + auditoria numa transacção. O motor não conhece tenant nem permissões. O pacote web fornece os dados editáveis e controla autorização.

products guarda revisão actual e active_version; product_versions guarda nome e condições completos por revisão. FK composta inclui tenant_id e impede referências cruzadas. Um rascunho pode coexistir com versão publicada; consumidores devem consultar active_version, nunca assumir que a última revisão está publicada. As configurações iniciais de M1 passam a gerar quatro produtos em rascunho no mesmo provisionamento. M4 copia a versão publicada para o contrato imutável, com versão do motor histórico.

As tabelas adicionais têm RLS de leitura; escrita só pelo RPC autorizado. Constraints e trigger validam a forma das condições e os perfis do tenant. A validação financeira do web evita produtos sem desembolso líquido positivo ou impostos sem solução. Actualização de tipos reflecte o esquema realmente aplicado. CI executa testes puros, cobertura do motor, isolamento real, navegador e build.

## M3 — Clientes e documentos

clients (tenant/agência/revisão/perfil/consentimento), client_keys (duplicados), client_events (timeline imutável) e client_documents (metadados/reserva). As quatro têm RLS; vínculos subordinados incluem tenant_id. Escritas só por save_client/add_client_note/import_clients/reserve_client_document/complete_client_document. Auditoria conserva valores anterior/novo; eventos registam acções da ficha.

ClientEditor usa RHF/Zod partilhado com o servidor. Pesquisa /api/clients/search usa sessão, tenant do Host e RPC autorizado; fornece resumos paginados à lista e paleta global. SQL search_clients é security-definer: valida has_permission e agencia do membership antes de seleccionar apenas aquele tenant/âmbito. Leituras directas continuam protegidas por RLS. Importação valida no browser/servidor e novamente na base, com excepção por linha e sem substituição de fichas.

Documentos: browser → Route Handler com Origin e leitura limitada → validar formato → reservar metadata pelo RPC → upload SDK com JWT de sessão → Storage RLS verifica path/cliente → confirmar metadata do objecto → evento. Leituras usam URL assinada curta pelo mesmo JWT. Bucket não público e sem política de substituição de ficheiros prontos. Fotografia é um documento de tipo photo. Base guarda metadados, volume local guarda bytes; backup precisa dos dois. Storage inicializa o seu esquema antes das migrações da aplicação, no arranque local.

## M4 — Fluxo de crédito

`applications` liga cliente, agência e versão imutável de produto. Rascunho → submetido → em análise → aprovado/recusado; rascunho pode ser retomado antes da decisão; cancelamento preserva histórico. `save_application`, `transition_application` e `disburse_application` são fronteiras SQL com autorização, RLS, tenant/agência, revisão e locks. Escrita directa não é concedida.

`contracts` guarda snapshot imutável e versão do motor; `loans` nasce uma vez por contrato no desembolso. `application_events` é append-only, com autor/nome e decisão. As quatro tabelas têm RLS, índices tenant/agência, FKs compostas e auditoria. Principal tem representação bigint nativa gerada; o transporte usa strings.

`/app/applications` tem pesquisa paginada via RPC, filtro e quadro; `/app/applications/[id]` analisa requisitos, rendimento, documentos privados, parecer, simulação e histórico. Criar/editar/desembolsar em drawers. `/app/loans/[id]` apresenta o contrato e o plano aprovado. `/api/contracts/[id]` gera PDF exclusivamente com snapshot e motor histórico; RLS decide acesso, incluindo caixa e leitura. Definições de documentos editam o modelo apenas para aprovações futuras.

O plano contractual é derivado com `simulateContract(1, ...)` e o motor v1 preservado. Não há saldos de pagamentos reais antes do M5; esta projecção não simula recebimentos. PDF usa a fonte instalada/traçada no build, não uma dependência de rede em cada pedido.

Pesquisa de créditos usa `search_loans`, com identidade/montante do snapshot aprovado, RLS explícita e paginação de 50. Eventos do pedido alimentam também a linha do tempo do cliente por trigger, preservando o autor.

Consulta/download de contrato regista `log_contract_access` individualmente na auditoria, com contrato, autor e agência. Desembolso usa `loans.disburse`, independente de `payments.manage`, para não dar essa autoridade ao cobrador por defeito. Produtos com rascunho pendente continuam a usar o nome/condições da versão publicada; apenas arquivo retira a disponibilidade.
