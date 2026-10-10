# Site público e área do cliente — M7

## Operar

Cada subdomínio tem início, produtos, simulador, como funciona, perguntas frequentes, agências/contactos, termos e privacidade. Só versões publicadas de produtos entram no site; um rascunho novo não retira a versão publicada anterior. Produtos arquivados não aceitam novos pedidos.

Em Definições → Marca e site, o gestor muda tema Clássico/Moderno, título, apresentação, imagem HTTPS, ordem das cinco secções, etapas, perguntas, termos/privacidade e limites de acesso. O nome, logótipo, contacto/licença e cor continuam em Marca. A pré-visualização do editor reflecte tema/textos/ordem; a ligação abre o site publicado. O gestor deve confirmar os textos de privacidade/termos conforme a sua operação; presets não estabelecem obrigações legais fixas.

Simulação usa o motor v1 no servidor, com bigint/Decimal. Ranges usam valores exactos em centavos; JavaScript só apresenta o resultado e pede novo cálculo. Sem JavaScript, o botão Calcular envia a mesma simulação por GET. Apresenta primeira prestação, total, juros, comissões/impostos, taxa efectiva anual, desembolso e aviso de prestações variáveis/última ajustada.

O cliente confirma o telefone por SMS antes de preencher. Dados → rendimento/crédito → documentos → confirmação; cada avanço grava um rascunho próprio. Pode sair e retomar na Área do cliente. Documentos exigidos são os dados do produto. Imagens usam canvas no telemóvel, máximo de 1600px e compressão JPEG; PDFs conservam bytes, máximo 5 MB. O servidor confere assinatura de formato/tamanho, reserva o path, envia com JWT do cliente e confirma metadata no Storage. Ficheiros concluídos não podem ser substituídos.

Ao enviar, o pedido entra nos Pedidos da agência e guarda aceitação, data e cópia dos termos/privacidade. O mesmo rascunho só gera um pedido. Aprovação continua independente, com as condições e documentos do M4; o cliente não tem permissões do pessoal. Uma versão retirada exige nova simulação, sem substituir silenciosamente o produto do rascunho.

Primeiro vínculo a uma ficha existente exige o telefone **principal** confirmado (primeiro telefone na lista, mesmo que um email o preceda). O vínculo fica estável pelo utilizador Auth, não por dados editáveis enviados pelo navegador. Dados novos de uma ficha existente ficam como proposta visível na análise; não sobrescrevem a ficha nem consentimento/opt-out. Uma ficha criada por este pedido recebe os dados finais na primeira submissão. Identidade em outra ficha gera erro e exige conferência da agência, sem ligação automática por BI/NUIT.

Área do cliente actualiza encargos dos seus créditos até hoje e mostra só os seus pedidos/decisão, créditos/saldo, próximas prestações, pagamentos/estornos e contacto da agência. Não expõe pareceres internos, referências, auditoria, credenciais ou outros clientes. Cookies `sb-loma-customer` ficam separados dos do pessoal; proxy renova a sessão antes dos ecrãs privados. Todos os RPCs conferem telefone confirmado, sessão vigente, tenant activo/site e propriedade. Membership nunca é criado por signup.

Captura de contacto no simulador exige autorização expressa e CAPTCHA. Regista lead com origem, agência e estado Simulou; não entra automaticamente em campanhas sem ficha e consentimento próprio. Conversão por submissão liga a ficha/pedido real, sem inferir consentimento de mensagens.

## Desenvolvimento e produção

Local: `pnpm services:start`, `pnpm local:env`, `pnpm local:seed`, `pnpm dev`. Auth nativo tem telefone activo, código real e hook Send SMS PostgreSQL `public.console_sms_hook`. Contentor **auth-console** imprime códigos em logs privados; `portal_private.auth_codes` guarda temporariamente os códigos para testes locais. Nunca publicar logs/traces/códigos nem usar o hook console em produção. O cliente não recebe códigos em nenhuma API do site. Signup não concede acesso ao painel sem membership.

Produção: activar telefone no Supabase Auth, configurar um provedor SMS suportado, personalizar o texto SMS do Auth em pt-MZ e activar CAPTCHA Turnstile nativo do Auth. `NEXT_PUBLIC_CAPTCHA_SITE_KEY` é pública; o segredo de CAPTCHA e credenciais SMS ficam nas definições seguras do Supabase, não no Git. OTP é autenticação transaccional da plataforma; tem limites próprios do Auth, não consentimento/horário de campanhas M6. Entrega real externa exige conta e destinos autorizados e não é comprovada pelo console.

Configurar `PUBLIC_REQUEST_SIGNING_KEY` no servidor, igual à chave aleatória em `portal_private.request_key`, separada das chaves financeira e de mensagens. Não é uma chave Auth/service-role: só atesta tenant, acção, telefone, instante e hash de IP. RPCs de gateway/lead/submissão rejeitam contexto alterado/expirado; taxa de IP e telefone é guardada na base. Limites por telefone/hora ou dia e duração de sessão são dados editáveis no site. Novos rascunhos também têm limite derivado dos pedidos/dia. Auth aplica os seus próprios limites de emissão/verificação.

`TRUSTED_CLIENT_IP_HEADER` deve indicar apenas um cabeçalho que o proxy de produção remova/substitua: confirmar o contrato da plataforma de deploy antes de escolher. Sem configuração, usa bucket conservador partilhado, não confia em IP livre enviado pelo cliente. CAPTCHA visual local é básico, com desafio/cookie separados por imagem para evitar corridas; **não substitui** o CAPTCHA nativo do Auth em produção, porque o endpoint público do Auth também emite códigos. Não configurar um cabeçalho arbitrário do cliente como origem de IP.

PWA tem manifest por tenant, ícones PNG e página offline. O service worker só guarda o fallback público: nenhum API, ficheiro, ecrã de cliente/pedido ou pessoal entra na cache. Retenção offline não é implementada para agentes. `pnpm public:assets` regenera o fallback a partir do catálogo pt-MZ e os ícones locais; assets gerados são versionados. Metadados de partilha, canonical e robots protegem as rotas privadas de indexação.

## Verificar e recuperar

`pnpm test:public`, após as verificações M4/M5 e antes de Playwright, usa Auth/Storage/RLS reais e o hook local. Cria produto publicado e clientes próprios; código errado, isolamento, duplicados/revisões, limites assinados, documento privado, pedido idempotente, aprovação/desembolso/pagamento e proposta de dados existentes são comprovados. Nunca correr testes contra Supabase alojado.

Backups incluem as três tabelas de negócio de portal, Auth, Storage e chave privada de entrada. Códigos OTP locais são efémeros e não devem ser exportados como dados de negócio. Não mudar a chave sem actualizar o ambiente do servidor; sessões Auth e propriedade não dependem dela, mas novas operações públicas atestadas deixam de funcionar se divergir.

`pnpm test:site-quality` exige um servidor de produção na porta 3200 e Chromium (por exemplo `CHROME_PATH=/usr/bin/chromium`). Verifica início/simulador com Lighthouse móvel e throttling simulado: desempenho/acessibilidade ≥ 90 e JavaScript inicial transferido < 150 000 bytes, incluindo framework/cabeçalhos. Usa o tenant publicado de `test:public`, ou `PUBLIC_SITE_TEST_URL` explícito. A medição refere-se aos recursos efectivamente carregados, não apenas ao script próprio. Código de tradução do painel fica nos layouts internos; imagens públicas são HTML com dimensões explícitas; CAPTCHA externo só carrega no login após hidratação. Formulários pessoais só activam envio quando prontos e usam POST, preservando dados fora da query string.
