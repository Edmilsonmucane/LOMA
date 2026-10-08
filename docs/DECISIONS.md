# Decisões

## 2026-10-07 — M0

- Nome inicial: LOMA, do repositório; marca de cada tenant será configurável.
- Stack solicitada: Next.js App Router, TypeScript estrito, pnpm workspace, Tailwind com tokens próprios, Radix, Phosphor regular, next-intl, Vitest e Playwright.
- M0 inclui apenas fundações e catálogo de componentes; não apresenta dados financeiros fictícios como funcionalidades operacionais.
- Fontes Instrument Sans e Newsreader servidas localmente por pacotes Fontsource, evitando dependência de Google Fonts em runtime/build.
- `/design` existe apenas em desenvolvimento; produção devolve 404.
- pnpm 10 é a linha escolhida para reprodutibilidade e compatibilidade com Node 24.
- Configuração Supabase, autenticação e isolamento real são entregas de M1, não simulados em M0.

- next-intl 4.4.0 fixado: oferece os recursos de internacionalização necessários sem o extractor experimental dependente de SWC nativo, incompatível com a propriedade dos directórios deste sandbox. Não há alteração às verificações de integridade/TLS.
- ESLint 9.39.5 mantido por compatibilidade com os plugins react/import/jsx-a11y da configuração Next; a migração para 10 aguarda suporte declarado desses plugins.
- Tabela usa TanStack; o componente opta explicitamente por não usar memoização do React Compiler devido aos callbacks mutáveis da biblioteca. Uma excepção de lint local e documentada cobre apenas esse aviso de optimização.
- Controlos interactivos só ficam activos depois da hidratação, evitando que cliques iniciais se percam em redes lentas. Testes aguardam a mesma prontidão visível nos controlos.
- `next-env.d.ts` é gerado e ignorado; `next typegen` precede o typecheck, conforme documentação Next 16.

## 2026-10-07 — M1

- Auth e autorização reais, sem modo de autenticação simulado. Cliente SSR por sessão; service-role exclusivo do servidor para convites após validação de tenant, perfil e agência.
- Resolução pelo Host validado contra PLATFORM_BASE_DOMAIN; um subdomínio por tenant. Cookies ficam no host, sem domínio wildcard. Domínios desconhecidos e reservados são recusados. Domínios próprios ficam preparados na fronteira de resolução, sem implementação prematura.
- Base local: PostgreSQL 17-alpine, imagens oficiais GoTrue/PostgREST, Mailpit e proxy Node mínimo. A imagem monolítica Supabase/Postgres ficou retida no descarregamento/preparação pelo Docker vfs; a alternativa menor mantém SDKs, JWT, sessões reais e RLS. Produção mantém Supabase alojado.
- CLI Supabase 2.75.0 fixado para geração de tipos: o CLI recente tentou escrever na pasta pessoal restrita. Checksum oficial do binário verificado pelo instalador. Registro ECR bloqueado nesta rede; imagem de postgres-meta equivalente obtida do Docker Hub para tipos.
- Configuração local gera segredos aleatórios, ficheiros 0600 e volume persistente. Seed inicial idempotente cria dois tenants e cinco perfis; não repõe dados ou palavras-passe. Serviços aplicam migrações em transacção com lock e checksum.
- Presets guardados em JSON editável na base: cinco perfis e configurações iniciais de quatro produtos, duas mensagens e site. Taxas financeiras ficam por confirmar e os produtos/automação/site não são publicados em M1. O assistente de produtos entra em M2.
- Provisionamento atómico por RPC autorizado do super-admin. Cria agência Sede, perfis, gestor inicial e configuração. Limites de utilizadores reforçados por trigger com lock do tenant; limites de créditos e mensagens ficam preparados para os seus módulos.
- Perfis têm interruptores de permissões. Utilizador limitado a agência não gere marca nem equipa global, mesmo que o perfil inclua essas permissões. FKs compostas impedem associar perfil/agência de outro tenant. Trigger preserva o último gestor e o acesso essencial do perfil gestor.
- Auditoria de configuração, perfis, marca e acessos registada por triggers/RPC, incluindo actor e valores anterior/novo; UPDATE, DELETE e TRUNCATE bloqueados por triggers. Administração global tem auditoria separada.
- Segurança do tenant: MFA TOTP opcional/obrigatório e tempo de sessão verificados por RLS contra auth.sessions e aal. Activar MFA exige primeiro verificar o factor do gestor para evitar bloqueá-lo. Mínimo de palavra-passe validado na aplicação; o mínimo global deve também ser configurado no Auth. O endpoint directo do fornecedor segue a política global, não o campo adicional do tenant.
- Marca: nome, cor derivada com contraste, URL HTTPS de logótipo, contactos, licença e rodapé. URL do logótipo é uma primeira opção reversível; carregamento privado de documentos entra em M3, editor do site em M7.
- Navegação limita-se aos seis módulos principais mais Relatórios/Definições; itens sem permissão não são mostrados. Pesquisa global em M1 cobre navegação e equipa autorizada. Pesquisa por cliente/BI/NUIT entra com Clientes em M3.

- O proxy de rede do ambiente é injectado nos contentores; NO_PROXY inclui os serviços Docker internos para o Auth obter o modelo português de convite. O callback usa o Host validado para preservar o subdomínio externo, evitando o endereço interno do servidor Next. Ambos verificados no fluxo de aceitação do convite.

## 2026-10-07 — M2

- Motor puro sem UI/base: bigint em centavos, decimal.js com 60 algarismos e arredondamento meio para cima. Nunca converter dinheiro ou taxas para Number; datas ISO sem hora e calendários do produto evitam efeitos de fuso.
- Taxa guardada como fracção decimal em string. Condições JSON usam strings para centavos, por compatibilidade com transporte/persistência; o motor converte para bigint.
- Carência acrescenta períodos antes da amortização. Juros capitalizados aparecem explicitamente nos períodos de carência e no custo; o capital de amortização inclui-os. SAC mantém amortização constante sobre esse novo saldo. Ver docs/LOAN_ENGINE.md para invariantes e convenções.
- Taxa efectiva anual pela TIR com datas reais e ano configurável. Raiz calculada com Decimal, sem aproximação Number. Impostos financiados sobre juros resolvidos até estabilidade ao centavo; uma configuração sem solução convergente é recusada.
- Produtos têm cabeçalho e versões append-only; edição cria versão nova. Publicação aponta a versão activa, rascunho preserva a anterior. Snapshot do contrato será copiado em M4; não há contratos implementados neste marco.
- Gravação atómica via save_product, autorização tenant.manage, lock e revisão esperada. RLS nas duas tabelas; sem escrita directa do utilizador; histórico protegido contra UPDATE/DELETE/TRUNCATE e auditado. Perfis de aprovação devem existir no mesmo tenant.
- Conflito de revisão usa SQLSTATE PT409/HTTP 409. O código 40001 originou tentativas repetidas pelo PostgREST real; uma migração posterior corrigiu-o sem editar migrações aplicadas.
- Quatro presets materializados em rascunho a partir de dados; o gestor edita os produtos-modelo e pode criar outros por cópia. Taxas sugeridas não constituem regras legais. Impostos e penalizações por confirmar ficam sem cobrança.
- Assistente em três passos, detalhes avançados recolhidos, simulador sempre ligado ao mesmo motor. Validação Zod e financeira no servidor inclui datas de início futuras de impostos. História abre no mesmo drawer em modo de consulta.
- Limites técnicos de 1 200 períodos de amortização/carência e 256 iterações para impostos protegem recursos; não são limites comerciais ou regulamentares.
- Logs de argumentos de Server Actions desactivados no Next 16, incluindo desenvolvimento; o callback de Auth é excluído dos logs de pedidos para proteger códigos de acesso.

## 2026-10-07 — M3

- Ficha com colunas de identidade/agência/revisão e perfil JSON validado para identificação, múltiplos contactos, morada, actividade, rendimento, despesas, referências e fiadores. Income/expenses são também colunas bigint geradas; JSON conserva strings exactas no transporte. Nunca usar os números JSON do PostgREST para cálculos monetários.
- Chaves únicas por tenant para BI/NUIT/passaporte/DIRE normalizados e telefones internacionais. Partilha de telefone entre duas fichas é recusada nesta fase: o gestor deve rever a ficha existente. Referências/fiadores não criam chaves de duplicado. Mensagem de duplicado não revela nomes de outra agência.
- Escrita atómica só por RPC, com permissão clients.manage e agência antiga/nova autorizadas. Edits optimistas usam PT409. Não há eliminação de clientes no M3: retenção/exportação/eliminação de privacidade dependem das políticas e operações dos marcos seguintes.
- Linha do tempo append-only para criação, edição, notas, consentimento e documentos. Guarda actor, nome da equipa quando disponível e data. Pedidos/pagamentos/mensagens acrescentarão os seus eventos quando existirem. Alterações completas da ficha também ficam na auditoria imutável.
- Consentimento por canal, sem autorizações por defeito; activação exige origem/forma da autorização. Toda alteração gera evento com valores anterior/novo. CSV não aceita autorização de mensagens: confirmar com o cliente na ficha evita inferir consentimento de folhas antigas.
- Importação CSV UTF-8 com vírgula/ponto e vírgula, BOM, aspas escapadas, campos multilinha e números de linha físicos. Até 1 000 registos/2 MB, escolha de colunas, preview de 20, validação e relatório completo. Cada linha válida é uma subtransacção; erros não desfazem outras linhas. Repetir não duplica fichas graças às chaves únicas. Não importar créditos antigos até existirem as operações financeiras correspondentes.
- Pesquisa com debounce de 150 ms, páginas de 50, nome sem distinção de acentos e identificação/telefone normalizados. RPC valida permissão/sessão e resolve agência uma vez, em vez de repetir joins de autorização por cada resultado. Isolamento explícito verificado. Listas/API enviam apenas resumo; rendimento, referências e consentimento só na ficha.
- Supabase Storage API v1.33.0 oficial acrescentado à stack local; backend file em volume persistente, bucket privado e políticas RLS por path reservado/cliente/agência. Produção continua a usar o Storage alojado. Porta pública só pelo proxy local em loopback.
- Upload pela rota autenticada com controlo de Origin, limite real de corpo de 6 MB, ficheiro até 5 MB e assinatura PDF/JPEG/PNG/WebP conferida. Reserva antes de upload, confirmação apenas se tamanho/MIME armazenados conferem. Ficheiros concluídos não têm política de alteração/remoção. Falhas antes de confirmar podem deixar reservas pendentes invisíveis ao gestor; limpeza operacional futura não deve tocar documentos concluídos.
- URLs assinadas por 60 segundos, download de documentos e apresentação de fotografia autorizada. MIME restrito exclui SVG/HTML. Validade não obriga a um período legal fixo. Backup local inclui dump e TAR do volume de ficheiros; produção exige backup separado de Storage.
- Labels de meses em catálogo e composição de datas evitam abreviaturas inconsistentes do ICU pt-MZ neste ambiente. Datas de nascimento futuras recusadas segundo Africa/Maputo; nenhum mínimo legal de idade foi introduzido.

## M4 — Pedidos e contratos

- Pedidos usam a versão publicada, com revisão esperada. Um rascunho de produto pendente preserva a versão publicada; só o arquivo retira o produto. A gravação rejeita uma versão diferente da pré-visualização. Se a versão publicada mudar antes da aprovação, o pedido volta ao rascunho para revisão; os montantes e prazos continuam editáveis nessa fase.
- Decisões usam `applications.manage`, o nível de aprovação configurado no produto e separação entre criador e decisor, aplicados no SQL. O gestor pode decidir os níveis do tenant; nenhum gestor pode aprovar o pedido que criou. Parecer obrigatório para aprovação e recusa. O caixa recebe consulta de pedidos por defeito, editável nos perfis, para conferir o contrato antes do desembolso.
- Aprovação copia condições, versão do produto, dados do cliente, marca, modelo, finalidade e garantias numa linha de contrato imutável. A aprovação é atómica com a decisão e o histórico. Contratos cancelados permanecem consultáveis.
- O plano é uma projecção exacta dos inputs imutáveis, identificada por `engine_version=1`. O código financeiro v1 foi preservado em `packages/loan-engine/src/v1.ts`; alterações de comportamento futuras exigem uma nova versão e não substituem a v1. Não se aceita um plano financeiro enviado pelo navegador. Isto evita confiar em totais/juros forjados via RPC. M5 persistirá os saldos/lançamentos de pagamentos sobre este plano.
- Dinheiro viaja como strings exactas em JSON; pedidos e contratos têm colunas bigint geradas para guardar/validar centavos nativos. Sem passagem por Number.
- Documento inicial é editável, sem cláusulas legais inventadas. O gestor revê o texto em Definições → Mensagens e documentos. Substituição de variáveis num único passo; dados do cliente não são interpretados como variáveis. PDF privado sob sessão/RLS, sem cache; Instrument Sans incorporada e plano paginado.
- Desembolso usa permissão própria `loans.disburse` (gestor/caixa por defeito), editável nos perfis. Registar pagamentos não dá autoridade de desembolso ao cobrador. Exige contrato aprovado, referência, método e assinatura declarada. A data efectiva tem de coincidir com a acordada; assinatura entre aprovação (data civil Maputo) e desembolso, sem desembolso futuro. Mudanças após aprovação exigem cancelar e criar novo pedido. A entrega em papel é confirmada pelo funcionário; não representa assinatura electrónica.
- Documentos obrigatórios são ligados pelo título configurado no produto, sem códigos jurídicos fixos, e validados à data acordada. Garantias declaradas por checklist. Capacidade mostra a maior prestação/rendimento, sem limite arbitrário; a periodicidade e as despesas devem ser analisadas. Score real fica no M8, explicitamente pendente na ficha.
- Limite de créditos activos serializado por tenant; duplo desembolso impedido por lock/revisão/contrato único. Razão, recibos e pagamentos pertencem ao M5.

### Validação M4 — 7 out 2026

- Typecheck, lint, formatação e build verdes. Instalação com lockfile congelado e arranque repetido dos serviços verificados.
- 141 testes unitários em 9 ficheiros; 90 do motor. Cobertura do pacote financeiro/dispatch: 98,17% instruções, 98,39% ramos, 100% funções, 99,28% linhas.
- 29 verificações Auth/RLS existentes, 4 grupos Clientes/Storage/500 linhas e 12 grupos Pedidos/Contratos/Créditos com base/Auth reais. Incluem creator/níveis, documentos/garantias, idade/rendimento, versão publicada com rascunho pendente, snapshot, corrida de desembolso, auditoria de acesso, isolamento/agência e linha do tempo.
- Regressão Playwright: 43 passaram, 1 omitido (importação de 500 linhas em móvel, repetida e verificada em computador). Os 6 testes M4 foram repetidos após a última alteração: fluxo completo, recusa do PDF entre tenants, modelo/quadro, teclado/axe e ausência de overflow a 390px. Scan de contraste do catálogo aguarda o fim das animações finitas, mantendo os mesmos critérios AA.
- Stack temporária nova com PostgreSQL/Auth/Storage oficiais: 28 migrações aplicadas e 20 tabelas com RLS. Apenas os recursos temporários foram removidos; a base de trabalho foi preservada.
- Produção local: login → pedido → PDF privado → crédito/móvel, `/design` recusado e nenhum erro de navegador. Fonte PDF incluída no trace de deploy; texto extraído conferiu total, juros, última prestação e taxa anual. Revisão visual em 1440/390px e PDF; tabelas com scroll local e foco, sem cartões de controlo vazios.
- Próximo marco: M5 — pagamentos, recibos, estornos, caixa/razão, tarefas diárias e Hoje. Deploy alojado, scoring M8 e site/cliente M7 não foram declarados concluídos.

## 2026-10-08 — M5

- O plano histórico é calculado exclusivamente no servidor com v1 e atestado por HMAC (tenant, contrato imutável, funcionário e validade de cinco minutos). A chave vive no esquema privado da base e no ambiente do servidor, nunca no navegador. O RPC verifica a assinatura; autorização, datas, revisão e RLS continuam a ser verificadas independentemente. Evita duplicar o motor histórico em SQL ou confiar num plano enviado pelo cliente.
- SQL é a autoridade de imputação e saldos. Preview e gravação usam a mesma cascata do snapshot, lock por tenant/crédito, revisão e dia esperado; chave idempotente impede duplicar pagamentos. Recibo, contador, saldos, razão e histórico entram na mesma transacção. Um estorno preserva o recibo e restaura os componentes hoje, sem reescrever mora de dias anteriores.
- O razão guarda partidas equilibradas e imutáveis por movimento. Recebíveis contratuais (capital e juros) são reconhecidos contra desembolso e rendimento diferido; encargos pagos à parte ficam numa linha inicial separada, sem alterar o plano histórico. Encargos capitalizados integram capital amortizável. Esta representação é operacional, não substitui contabilidade financeira formal.
- Mora acumula o valor decimal exacto por intervalo sobre capital/juros por pagar; apenas o total acumulado é arredondado. Pagamento/estorno actualizam primeiro a mora até hoje; novos saldos contam a partir do dia seguinte. Multa é avaliada uma única vez após tolerância. Execução diária e consulta são idempotentes.
- Caixa partilhado por agência/dia; abertura e fecho pelo perfil com autoridade de desembolso. Numerário exige caixa aberto; estorno pelo gestor. Diferenças no fecho exigem motivo e lançamento equilibrado. Caixa é um atalho de Hoje, preservando os seis itens principais.
- Créditos M4 recebem plano e lançamento inicial uma única vez, mediante atestação; novos desembolsos já os criam na mesma transacção. O procedimento de preparação/backfill deve preceder a activação de tarefas diárias em produção.

- A abertura transporta para o razão a diferença entre numerário contado e saldo contabilístico anterior, sem duplicar a caixa do dia anterior. A conferência no fecho usa abertura + movimentos; diferenças são partidas separadas. Foi acrescentada uma comparação ao centavo entre saldo de numerário do razão e contagem final, além da carteira.
- O arranque cloud foi actualizado em `start_skill` para incluir o worker, backfill e ligação privada de atestação. Instalação congelada e arranque/seed repetidos sem repor dados. O rascunho está guardado; a publicação do ambiente continua nas definições e não equivale a deploy Vercel/Supabase.

### Validação M5 — 8 out 2026

- Typecheck, lint, formatação, build e instalação congelada verdes. 146 testes unitários; cobertura histórica do motor acima de 95% em todas as métricas, sem alterar v1.
- 36 verificações Auth/RLS, quatro grupos clientes/Storage/500, 12 de pedidos e 15 pagamentos/caixa/razão reais. Somas da carteira e numerário coincidem com o razão ao centavo. O worker processou uma data pendente; repetições não acrescentaram auditoria.
- Playwright: 49 passaram, um omitido (500 em móvel, repetido em computador). M4/M5 repetidos com 12 verdes depois do ajuste de tabelas e acções; seis M5 novamente com a apresentação final de dinheiro. Scans axe e layout móvel sem violações detectadas.
- Base vazia: 39 migrações, 28 tabelas públicas com RLS. Produção local final: login, Hoje/saldo/preview, PDF privado/QR, caixa/modelos e 390px; catálogo recusado, sem erros de navegador. Fonte incluída no trace; nenhum segredo financeiro nos assets do cliente.
- Próximo marco M6. Arranque cloud guardado em rascunho, sem publicação/deploy alojado; limites e procedimentos registados em PROGRESS.md/RECOVERY.md.

## M6 — comunicação e cobranças

- Escritas do pessoal continuam por sessão/RLS e RPC. Actividades de cobrança são append-only; atribuição e metas são dados editáveis. Escalões são configuração do tenant, distintos do score M8.

- Fila persistente com chave idempotente, tentativas, agendamento, custo em centavos e eventos imutáveis. O worker técnico não expõe uma rota pública nem aceita SQL/payloads do navegador. Revalida consentimento, bloqueio de canal, contacto, limite e horário em cada tentativa; serializa por tenant e cliente.
- Regras, modelos, horário e frequência são dados editáveis. Automações vêm desligadas; activar não envia acontecimentos antigos. Lembretes usam vencimentos e saldos reais após a tarefa financeira. Campanhas têm pré-visualização e contagem, mas destinatários são novamente filtrados no envio.
- Credenciais cifradas com chave técnica separada em esquema privado; nunca são devolvidas ao pessoal. Provedor console funciona sem contas pagas. Integrações HTTP usam HTTPS, sem redireccionamentos e com defesa contra endereços privados. Aceitação pelo provedor e entrega confirmada são estados distintos.
- Leads manuais neste marco; captura pública fica em M7. Segmentos de risco só usam classificação registada, sem inventar score antes de M8. Nenhuma mensagem real externa será usada na validação.

- O início do despacho é confirmado numa transacção separada antes da rede. A segunda transacção revalida o contexto e fixa o contacto actual sob lock. Tentativas incertas reservam frequência/limite, sem reenvio automático; apenas rejeições explícitas libertam a reserva para retry. O papel NOLOGIN loma_message_worker pode executar os helpers e actualizar o estado técnico permitido, mas não ler clientes, chave/ciphertext ou escrever operações financeiras. A identidade LOGIN de produção fica a cargo do operador.
- Modelos com valor/número financeiro exigem crédito ou acontecimento real. Mensagens gerais/campanhas não fabricam valores de zero; a pré-visualização no servidor usa o mesmo contexto da fila e inclui a instrução de saída. A atribuição de cobrador redefine a data inicial da meta, indicada na interface; recebimentos e estornos são somados exactamente desde essa data.

### Validação M6 — 8 out 2026

- Typecheck, lint, formatação, build e instalação congelada verdes. 165 testes unitários; motor v1 intacto, 90 testes e todas as dimensões de cobertura acima de 95%.
- 42 verificações Auth/RLS, quatro grupos Clientes/Storage/500, 12 de Pedidos, 15 de Pagamentos e 14 de Comunicações passaram. Testado o papel técnico restrito, custos bigint, cifra e ausência de leitura pública de credenciais, consentimento/SAIR, callbacks assinados, idempotência, retry/incerteza, campanhas, metas e estornos.
- Lembretes configurados −3/0/1/7/15 dias executados pelo console com valor real e chave única; automações de recibo/decisão verificadas. Worker automático local processou a fila. Aceitação não foi confundida com entrega externa.
- Playwright completo: 57 passaram e um omitido (500 linhas em móvel, lote validado em computador). Os oito testes M6 foram repetidos após os ajustes finais; axe, teclado e ausência de overflow a 390px verificados.
- Base vazia: 68 migrações, 34 tabelas públicas com RLS e protecção adicional do esquema privado. Produção local final com login, Hoje, cobranças/drawers, preview financeiro/campanha, todas as rotas M6, linha do tempo e catálogo recusado; nenhum erro de navegador.
- Arranque cloud actualizado e guardado em rascunho, sem publicação/deploy. M7/M8, entrega externa, restauro cloud e ensaio com gestor real permanecem por validar; limites em PROGRESS.md/COMMUNICATIONS.md.

## 2026-10-08 — M7

- Site público renderizado no servidor, com simulador progressivo: campos/ranges enviam inputs e recebem cálculos do motor no servidor. Evita transportar o motor, bibliotecas de formulários e catálogo interno para o site. Templates Clássico/Moderno partilham estrutura; textos, imagem e ordem de secções são dados editáveis.
- Clientes usam Supabase Auth nativo por telefone/código, com cookies separados dos do pessoal. Autenticação não concede membership. RPCs específicos conferem telefone confirmado, sessão, tenant e vínculo estável ao cliente; nunca há leitura de notas internas, configuração privada ou carteira alheia. Dados de pedido de clientes existentes são conservados como proposta para análise, sem sobrescrever a ficha do gestor.
- Desenvolvimento usa hook PostgreSQL Send SMS do Auth e caixa privada de códigos no console. Produção usa um provedor SMS suportado pelo Supabase e CAPTCHA nativo configurado no Auth. Códigos não são devolvidos por API. CAPTCHA visual e limites por IP/telefone protegem a entrada local; confiança em IP encaminhado depende da configuração explícita do proxy de produção.
- Documentos são enviados com JWT real do cliente, em caminhos reservados para um rascunho próprio. RLS do Storage confere propriedade e estado; sem service-role. Imagens são comprimidas no telemóvel; PDF conserva bytes. Ficheiros privados nunca entram na cache PWA.

- O orçamento de JavaScript é a transferência inicial comprimida, incluindo recursos do framework e cabeçalhos, não apenas site.js. Lighthouse móvel com throttling simulado mede início e simulador sobre Next start; o comando falha abaixo de 90 ou a partir de 150 000 bytes. Provider de traduções apenas nos layouts internos, imagens públicas em HTML e CAPTCHA externo apenas no login reduzem a transferência sem remover validação ou acessibilidade.
- Formulários pessoais só activam envio após hidratação/eventos e usam POST, impedindo submissão GET durante carregamento lento. Primeiro telefone na lista é o principal, independentemente de emails. Consulta de saldo actualiza encargos próprios até hoje com a rotina histórica M5; a versão financeira v1 permanece intacta.

### Validação M7 — 8 out 2026

- 169 testes unitários; v1 preservado, 90 testes financeiros com todas as métricas acima de 95%. Typecheck, lint, formatação e build verdes.
- Auth/base/Storage reais: 45 verificações RLS, quatro grupos Clientes/500 linhas, 12 Pedidos, 15 Pagamentos, 14 Comunicações e 11 Site/Portal. Incluem vínculos estáveis, sessão expirada, telefone principal depois de email, código errado/correcto, reserva privada e pedido/aprovação/desembolso/pagamento real.
- Playwright completo final: 63 passaram, um omitido (500 linhas em móvel, repetição do lote validado no computador). Os seis M7 passaram também isoladamente após corrigir a submissão durante carregamento lento.
- Stack vazia temporária: 75 migrações, 37 tabelas públicas com RLS. Instalação congelada e arranque/env/seed repetidos preservaram dados; apenas volumes temporários de verificação foram removidos.
- Produção local: temas 1440/390px, páginas públicas, OTP nativo, carteira própria/pagamento, axe AA, envio desactivado sem eventos, pessoal/editor e cache apenas offline. Lighthouse móvel: início 100/100, simulador 97/100; transferência JavaScript 147 528 bytes. Sem erros inesperados de navegador; catálogo recusado em produção.
- Arranque cloud M7 guardado em rascunho, sem publicar/deploy. SMS externo/CAPTCHA alojado, restauro numa nova tarefa e ensaio com gestor real não foram executados. Próximo marco M8.

## 2026-10-08 — M8: relatórios, scoring e demonstração

- Relatórios consultam saldos/lançamentos reais por RPC com permissão própria, tenant e agência explícitos. Montantes continuam strings de centavos; exportações CSV/PDF partilham os mesmos dados e registam acesso. Data de referência é hoje para saldos, intervalo para movimentos/previsão; não se inventam saldos históricos.
- Score é uma média ponderada exacta com critérios/intervalos/classes/limites em configuração editável. Factos vêm da ficha e do histórico real; critérios sem evidência são indicados. Classes de risco e escalões de atraso/provisão têm configurações distintas. Avaliações guardam revisão/configuração e não alteram contratos aprovados.
- Demonstração tem tenant dedicado e dados sintéticos identificados. Reposição arquiva a geração anterior e cria uma nova no mesmo subdomínio, preservando contratos, razão e auditoria; não desactiva triggers, RLS ou invariantes financeiros. Só uma demonstração identificada pode usar este mecanismo; payload criado e atestado no servidor, nunca no browser.

- Opções de relatórios têm RPC mínimo próprio, evitando conceder gestão de equipa para filtrar agentes. Pesquisa por nome reduz a lista de clientes; dados e exportações continuam no mesmo âmbito. Totais distinguem desembolsos, recebimentos e estornos; provisões arredondam por crédito antes da soma.
- Demonstração local dedicada usa slug demonstracao e conta sales, preservando fixtures demo/beira. Seed repetida não repõe a carteira. Créditos históricos sintéticos usam exigências documentais vazias nos presets de demonstração; não se fabrica evidência Storage.
- Teste completo de navegador usa fixture temporal na proposta ainda não aprovada e no instante de criação do acontecimento de aprovação (trigger temporário privado limitado ao UUID dessa proposta) para exercitar vencimento sem esperar um mês. Nenhum contrato ou lançamento existente é reescrito, e não há endpoint de controlo do relógio.

- Tabelas horizontais de relatórios e decomposição do score têm região identificada e foco por teclado, incluindo Safari móvel. Testes aguardam explicitamente operações de carteira (recalcular 120 clientes e criar 60 créditos), sem substituir confirmação por uma pausa fixa.

- Validação final M8: 175 unitários, motor acima de 95%, 14 grupos nativos M8, 91 migrações numa base vazia/39 tabelas RLS, Playwright completo 71 passados/um omitido e build/typecheck/lint/formatação verdes. Lighthouse móvel 96/100 no início e 97/100 no simulador, 147 528 bytes JS. Instruções cloud guardadas em rascunho; sem publicação alojada, entrega externa ou ensaio com gestor real. Evidência e limites em PROGRESS.md.
