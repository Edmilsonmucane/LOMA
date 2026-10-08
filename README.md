# LOMA

Plataforma SaaS white-label de microcrédito para Moçambique. Interface pt-MZ, moeda inicial MZN e fuso Africa/Maputo.

## Estado

M0–M7: sistema de design, tenants isolados por RLS, autenticação do pessoal, perfis editáveis, agências, marca, auditoria, TOTP e painel da plataforma. Motor financeiro puro com cinco métodos, carência, encargos, mora, imputação e liquidação antecipada. Produtos têm assistente com simulação viva, presets editáveis e versões imutáveis; começam em rascunho e o gestor publica as condições. Clientes têm fichas completas, pesquisa, listas, consentimento, notas, documentos privados e importação CSV. Pedidos têm análise, decisão por outro colaborador, contrato PDF com snapshot imutável e desembolso manual. Pagamentos têm imputação real, recibo PDF numerado com QR e estornos auditados. Caixa por agência inclui abertura, depósitos e fecho com conferência; o razão subjacente é de partidas dobradas. Hoje mostra carteira real e acções directas. Cobranças, modelos, automações, campanhas e contactos interessados usam dados reais; envios têm consentimento, horário e custos auditáveis. Site público por tenant, temas Clássico/Moderno, simulador exacto, pedido em etapas com SMS/documentos privados e área do cliente estão implementados. Relatórios, scoring e demonstração completa entram em M8.

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

O painel da plataforma usa o host raiz na rota `/login`. O microcrédito de demonstração usa `demo.localhost:3000/login`; o segundo tenant usa `beira.localhost:3000/login`. O navegador deve resolver subdomínios de localhost (Chromium faz isso). As credenciais aleatórias dos utilizadores locais estão apenas em `.local/accounts.json`; abra esse ficheiro localmente, sem o partilhar ou colocar no Git. A seed é repetível e não redefine palavras-passe nem apaga dados existentes. Convites de equipa são capturados pelo Mailpit, porta 54324, sem enviar emails externos.

`/design` mostra o catálogo de componentes durante desenvolvimento e devolve 404 em produção. A demonstração financeira com 120 clientes e `pnpm seed` será entregue em M8.

## Verificar

Com os serviços e fixtures locais preparados:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:engine
pnpm test:rls
pnpm test:clients
pnpm test:applications
pnpm test:payments
pnpm test:messages
pnpm test:public
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm build
```

`pnpm test:clients` verifica clientes por tenant/agência, duplicados, versões, consentimento, documentos privados/expiração e um lote de 500 clientes. Cria fixtures num tenant de verificação separado para o lote.

A verificação RLS usa sessões reais do Supabase Auth, PostgreSQL e PostgREST: leitura/escrita entre tenants, restrições de perfil/agência, auditoria, TOTP e validade da sessão. Executá-la antes dos testes do navegador: altera temporariamente a configuração de segurança dos fixtures e repõe-a ao terminar. Playwright testa computador e Pixel 7, criação de tenant, equipa, marca, recusas de acesso e acessibilidade, além de criar/simular/publicar produtos e consultar versões anteriores. `pnpm test:engine` exige cobertura de pelo menos 95% em linhas, funções, instruções e ramos. Chromium existente pode ser usado com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e`.

`pnpm db:types` actualiza os tipos TypeScript a partir do esquema local aplicado; os tipos ficam versionados. Migrações aplicadas têm checksum: criar nova migração em vez de alterar uma já aplicada.

## Clientes e importação

Abra Clientes → Criar cliente ou Importar clientes. O assistente aceita CSV UTF-8 (exportável do Excel), com vírgula ou ponto e vírgula, até 1 000 linhas/2 MB. Faça corresponder nome e telemóvel; os campos opcionais incluem identificação, morada e valores em MT. Montantes como `15 000,00` são convertidos exactamente para centavos. Revise as linhas e descarregue os erros; fichas existentes nunca são substituídas. A importação deixa todos os canais de mensagens sem autorização.

PDF/JPEG/PNG/WebP até 5 MB, com título e validade opcional, ficam no bucket privado `client-documents`. Fotografias usam o mesmo controlo. A consulta gera uma ligação válida por 60 segundos; actualize a ficha para renovar. O limite por agência aplica-se também ao histórico, documentos e pesquisa global. Backups locais agora incluem base e ficheiros; ver docs/RECOVERY.md.

## Base de dados e produção

O ambiente local usa PostgreSQL 17 e imagens oficiais de Supabase Auth/PostgREST, Storage oficial, mais um proxy HTTP mínimo e Mailpit. Inclui Supabase Storage oficial com backend de ficheiros em volume privado; cron e Studio ainda não são necessários. O Docker deste sandbox usa vfs; por isso foi evitada a imagem monolítica de PostgreSQL do CLI Supabase.

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
- `packages/loan-engine`: motor puro implementado e testado; ver docs/LOAN_ENGINE.md.
- `supabase`: migrações, stack local e modelo de convite.
- `scripts`: arranque, bindings locais, fixtures, tipos e teste real de RLS.
- `docs`: decisões, arquitectura, design, recuperação e progresso.

Leia [AGENTS.md](AGENTS.md) e [docs/DECISIONS.md](docs/DECISIONS.md) antes de desenvolver.

### M4 — Pedido até desembolso

Em **Pedidos**, crie um rascunho com cliente, produto publicado, montante, prazo e data acordada. Submeta, inicie análise e registe o parecer. Outro colaborador, com o perfil de aprovação configurado, decide; quem criou não pode decidir. Os requisitos do produto são verificados na base. Se as condições publicadas mudaram antes da decisão, volte ao rascunho e reveja.

Em **Definições → Mensagens e documentos**, personalize o modelo do contrato. Na aprovação, condições, marca, cliente e modelo ficam copiados num contrato imutável. Descarregue o PDF e recolha a assinatura. O caixa regista o desembolso com referência/método e confirmação da assinatura. A data deve corresponder à acordada; ajustes posteriores exigem novo pedido. O crédito e plano aparecem em **Créditos**. Pagamentos, recibos e caixa estão disponíveis no M5.

`pnpm test:applications` verifica o fluxo com PostgreSQL/Auth reais, revisões, requisitos, perfis, auto-aprovação, snapshots, concorrência, RLS e agência. Fixtures locais incluem agora analista e caixa, com credenciais privadas em `.local/accounts.json`; não há palavra-passe pública.

## Pagamentos e caixa — M5

Créditos → Registar pagamento → escolher cliente → valor/método → conferir imputação → confirmar. A paleta Cmd/Ctrl+K tem o mesmo atalho. Hoje abre directamente o pagamento de uma prestação por receber. Numerário exige caixa aberto; outros métodos exigem referência. Preview usa os saldos actuais e condições aprovadas. Pagamento repetido não duplica recibo ou dinheiro; alterações concorrentes pedem nova conferência.

O recibo fica no extracto do crédito e inclui QR de acesso autenticado. Definições → Mensagens e documentos permite editar o modelo apenas para novos recibos. Quem tem permissão de estorno fornece motivo; o original permanece e aparece como estornado. O estorno restaura o saldo hoje, preservando a mora já apurada.

Hoje → Ver caixa → escolher agência. Abrir com numerário contado; registar depósitos; fechar com contagem. Diferenças exigem motivo. Depois do fecho não há movimentos em numerário nesse dia. Comissões pagas à parte aparecem como encargos iniciais, por pagar até registadas; o desembolso não pressupõe recebê-las. Excedentes ficam adiantados ou a favor, conforme o contrato.

`pnpm test:payments` executa após `pnpm test:applications` e verifica base/Auth reais, numeração sem lacunas, pagamentos concorrentes, mora, excedentes, estornos, seis métodos, caixa, task automática e soma do razão/carteira. Os oito novos conjuntos de dados têm RLS; não há escrita financeira directa.

O worker local corre com `pnpm services:start` e processa datas pendentes de forma idempotente. Supabase usa pg_cron, quando disponível, com tarefa a cada 15 minutos; o cálculo continua diário, por data civil. `pnpm backfill:local` inicializa uma vez os planos anteriores ao M5, sem apagar dados. Chave de atestação, preparação de produção e recuperação estão em docs/RECOVERY.md. O M6 acrescenta um worker de mensagens e lembretes configuráveis.

## Cobranças e mensagens — M6

Abra **Cobranças** para ligar, enviar lembrete ou registar contacto, promessa/data/valor e visita. O gestor pode atribuir cobrador e meta por crédito. Escalões de atraso são editáveis em **Definições → Regras de comunicação**. A lista tem pesquisa, filtros por escalão/carteira própria e até 100 resultados por prioridade; mensagens/contactos mostram os 50 registos mais recentes.

Em **Mensagens**, personalize modelos, active automações e crie campanhas com pré-visualização/contagem antes de enviar ou agendar. Sem consentimento não há envio; o opt-out é confirmado novamente no despacho. Na ficha do cliente, **Autorização de mensagens** bloqueia um canal ou regista a nova autorização explícita. Uma importação não cria consentimento. Contactos interessados só convertem com pedidos reais; a captura pública está disponível no M7 e o score entra no M8.

`pnpm services:start` inicia também o worker de mensagens; `pnpm messages:run` processa uma passagem e `pnpm messages:watch` inicia um processo contínuo. Não iniciar um segundo watch desnecessário. Sem contas pagas, console imprime mensagens **nos logs privados do worker**, sem enviar SMS/email reais. HTTP SMS/email e WhatsApp Cloud configuram-se em **Definições → Integrações**; credenciais cifradas nunca são devolvidas. WhatsApp exige modelo aprovado e ordem correcta das variáveis, incluindo a instrução para sair.

`pnpm test:messages` usa PostgreSQL/Auth/RLS reais e mocks/console, após test:applications; pausa e retoma apenas o worker local de mensagens para ensaios determinísticos. Verifica dias, consentimento, campanhas, assinatura de callbacks, opt-out, janela/frequência, repetição/custos exactos, promessas, leads e isolamento. Nunca imprime credenciais ou mensagens com dados pessoais no relatório.

Provedores confirmam entrega em `/api/message-webhooks/{tenant_id}/{channel}`. HTTP assina os bytes JSON com HMAC SHA-256 (hex) no cabeçalho `x-loma-signature`: `{id,status:"delivered"|"failed"}` ou `{from,message:"SAIR"}`. WhatsApp usa `x-hub-signature-256`, App Secret e verificação Meta com verifyToken. Configure estes segredos em Integrações. Respostas repetidas não duplicam eventos. Uma resposta incerta exige conferência no provedor; não é reenviada automaticamente.

## Site público e cliente — M7

O host do microcrédito abre o site, com os produtos publicados. Definições → Marca e site edita tema, textos, imagem, secções, termos/privacidade e limites; Marca edita identidade/cor/contacto/licença. Simulador usa as regras reais no servidor e mostra o custo total. Pedir crédito confirma telefone por código SMS, guarda rascunho a cada etapa e envia documentos pela câmara/ficheiro. O pedido aparece na agência para análise independente.

Área do cliente usa cookies separados dos do pessoal e mostra os pedidos/créditos/prestações/extracto próprios. O desenvolvimento funciona sem contas pagas: Auth real emite códigos pelo hook console, visíveis apenas nos logs privados de auth-console. Nunca partilhar códigos/logs/traces. Produção requer SMS e CAPTCHA configurados no Supabase Auth, chave técnica pública no servidor e origem de IP confiável; ver [PUBLIC_SITE.md](docs/PUBLIC_SITE.md). O console não confirma entrega externa.

`pnpm test:public` verifica o percurso real, RLS, Storage e isolamento de cliente/tenant; executar após as verificações M4/M5 e antes do navegador. PWA instala o site e oferece página offline, sem guardar dados pessoais. `pnpm public:assets` regenera os assets públicos a partir do catálogo/local SVG. Lighthouse e orçamento de JavaScript são medidos sobre build de produção; não medir o compilador de desenvolvimento como experiência final.

Para medir o site: termine o servidor de desenvolvimento, execute `pnpm build`, inicie `pnpm --filter @loma/web start --port 3200` e, noutra sessão, `CHROME_PATH=/usr/bin/chromium pnpm test:site-quality`. O fixture vem de `test:public`; pode indicar um site público diferente com `PUBLIC_SITE_TEST_URL`. O comando verifica Lighthouse móvel ≥ 90 e transferência inicial de JavaScript < 150 000 bytes, incluindo o framework. Relatórios ficam privados em `.local/site-quality`; esta verificação também corre em CI.
