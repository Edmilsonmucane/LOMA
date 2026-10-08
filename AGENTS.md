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

## Comandos (M0–M6)

- pnpm install --frozen-lockfile
- pnpm services:start / pnpm services:stop
- pnpm local:env / pnpm local:seed
- pnpm db:types (após migrações)
- pnpm backup:local (dump privado; ver docs/RECOVERY.md)
- pnpm test:rls (antes de Playwright; usa serviços reais)
- pnpm test:clients (base/Auth/Storage reais e lote de 500)
- pnpm test:applications (pedidos/contratos/desembolso e RLS reais)
- pnpm test:payments (pagamentos/recibos/mora/caixa/razão e RLS reais; após test:applications)
- pnpm test:messages (comunicações/campanhas/cobranças reais; após test:applications)
- pnpm messages:run / pnpm messages:watch
- pnpm backfill:local (planos históricos sem repor a base)
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

## Clientes (M3)

save_client é a fronteira de escrita, com revisão esperada e chaves normalizadas únicas por tenant. Agência antiga e nova devem estar autorizadas. search_clients valida sessão/permissão e agência uma vez, dentro do RPC, e restringe o tenant explicitamente; não remover essas condições para acelerar a pesquisa. Histórico e consentimento são append-only. Dinheiro fica em colunas bigint geradas a partir dos valores exactos em JSON; ao transportar montantes use as strings exactas do perfil, não números JavaScript vindos do PostgREST.

Documentos usam sessão do utilizador, nunca service-role. Só paths reservados podem receber upload; ficheiros concluídos não são sobrescritos. Conferir bucket privado e políticas por cliente, tenant e agência. Ligações assinadas e traces de navegador são credenciais temporárias/dados privados: não imprimir nem colocar no Git. Antes de build, terminar verificações em dev; build concorrente com Next dev pode deixar o compilador de desenvolvimento preso neste ambiente.

## Pedidos e contratos (M4)

Decisão/desembolso apenas pelos RPCs autorizados, com revisão e locks. Não permitir auto-aprovação nem modificar contratos/eventos aprovados. Não aceitar um plano financeiro calculado pelo navegador. Contratos usam inputs imutáveis e engine_version; preservar v1 financeiro e introduzir nova versão para mudanças de comportamento. PDF usa snapshot, fonte incorporada e sessão/RLS, sem URLs públicas. A data de desembolso não reescreve vencimentos acordados. Pagamentos, razão e saldos efectivos entram em M5.

## Dinheiro e caixa (M5)

Chave FINANCIAL_SIGNING_KEY apenas no servidor e financial_private.signing_key. Nunca imprimir, incluir no browser ou reutilizar para autenticação. Atestar exclusivamente contratos lidos com sessão/RLS; assinatura não substitui autorização SQL. Desembolso, plano e razão na mesma transacção. SQL calcula imputação a partir dos saldos, revisão e snapshot; nunca aceitar allocations/totais do navegador. Chave idempotente deve sobreviver a tentativas repetidas. Recibo/contador/pagamento/razão/history são atómicos. Estorno append-only restaura componentes, preserva recibo e não recalcula mora histórica. Toda saída de numerário exige caixa aberto e fundos suficientes. Testar saldos por strings, equilíbrio de cada movimento e soma de recebíveis = carteira.

## Comunicação e cobranças (M6)

Credenciais apenas cifradas em communication_private; nunca devolver ou imprimir token/callback secret. Sessões operacionais usam RPC/RLS, nunca a ligação técnica do worker. Custos são strings de centavos. Consentimento e opt-out são conferidos no enqueue e no despacho; uma edição normal não remove bloqueios. Não chamar accepted de delivered. Persistir uncertain/dispatching antes do provedor; interrupção/timeout não pode gerar reenvio automático. Retry apenas em rejeição explícita, com backoff editável. DNS público fixado na ligação TLS, sem destinos privados/redireccionamentos. Callbacks exigem HMAC dos bytes exactos, tenant/canal e deduplicação. Não correr serviços/seed/testes de base durante Playwright; test:messages pausa/retoma apenas o worker que encontrou activo.
