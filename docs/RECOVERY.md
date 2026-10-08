# Backups e recuperação

## Desenvolvimento local

`pnpm backup:local` cria um dump PostgreSQL e um TAR de ficheiros Storage privados (0600) em `.local/backups`. Inclui dados Auth e de auditoria: tratar como informação sensível, não partilhar nem colocar no Git. Preservar também `.local/runtime.json`, `.local/supabase.json` e `.local/accounts.json` num destino privado para manter as ligações de desenvolvimento; não são um método de gestão de segredos em produção.

O volume Docker persiste entre arranques e paragens. Parar com `pnpm services:stop`; nunca apagar o volume para resolver problemas de aplicação. Uma migração aplicada é imutável por checksum: corrigir com nova versão.

Para verificar um backup, criar uma base temporária com nome único no contentor PostgreSQL, restaurar com `pg_restore --exit-on-error` e comparar contagens de tenants, memberships e auditoria, políticas RLS e constraints. Apagar apenas essa base de verificação. Foi executado em M1 com sucesso; o original ficou intacto. Um restauro sobre a base de trabalho exige paragem de Auth/PostgREST, backup prévio e decisão explícita de substituir dados.

Exemplo de verificação (substituir nome e caminho por valores locais escolhidos):

```sh
docker exec loma-local-db-1 createdb -U postgres loma_restore_check
docker exec -i loma-local-db-1 pg_restore -U postgres -d loma_restore_check --exit-on-error < .local/backups/ficheiro.dump
docker exec loma-local-db-1 psql -U postgres -d loma_restore_check -c 'select count(*) from public.tenants;'
```

## Supabase alojado

Antes de produção, activar backups automáticos conforme o plano contratado e definir retenção, destino cifrado, responsáveis e objectivos de recuperação. A retenção legal é configuração operacional do microcrédito, não uma constante da aplicação. Credenciais não fazem parte de documentação ou logs.

Procedimento: suspender operações → identificar ponto de recuperação → restaurar num projecto separado → confirmar Auth, RLS, auditoria, contagens e, a partir de M5, saldos do razão → testar login e fluxo crítico → mudar as variáveis seguras do servidor → retomar operações. Guardar registo da decisão e do teste. Nunca editar auditoria para ajustar um restauro.

O restauro de um projecto Supabase alojado e a política de backup automática de produção dependem do projecto e plano reais; ainda não foram executados. Storage exige backup separado de objectos e metadados; o backup normal de PostgreSQL alojado não inclui os bytes. No M4, contratos são snapshots na base e PDFs regenerados pelo motor histórico; o dump inclui as condições e modelos aprovados. Preservar também o código do motor v1 para reconstruir os planos. Ficheiros assinados em papel podem ser carregados nos documentos privados do cliente.

## Documentos — M3

O ficheiro .storage.tar corresponde ao volume /var/lib/storage do Supabase Storage API. Preservar dump e TAR com o mesmo timestamp, num destino cifrado. Suspender uploads durante uma cópia destinada a recuperação consistente: pg_dump é transaccional mas os bytes são copiados separadamente. Não afirmar consistência automática entre os dois em plena escrita.

Verificação reversível: extrair TAR numa pasta temporária privada, conferir os hashes dos ficheiros contra o volume actual e verificar que um restauro de teste da base conserva bucket privado, políticas storage.objects, clients/client_documents, histórico e chaves. Não restaurar sobre o volume activo para testar. Restauro real: suspender operações/Storage/Auth/PostgREST → backup prévio → restaurar base e ficheiros em destinos separados → conferir referências e permissões → iniciar Storage → testar sessão, URL privada recusada e URL assinada → retomar. Segredos/JWT devem ser preservados ou as sessões devem ser renovadas; ligações assinadas antigas não constituem teste de recuperação.

Verificação M3 executada: dump restaurado numa base temporária, contagens de clientes/documentos/eventos e RLS preservadas, bucket privado; 16 ficheiros do TAR extraído conferidos por SHA-256 contra o volume. Base e pasta temporárias removidas, dados de trabalho intactos.

## Contratos — M4

O dump inclui applications/contracts/loans/application_events, FKs/RLS e auditoria dos acessos ao PDF. Preservar código do motor histórico (engine_version) e dependências/fontes do PDF juntamente com o release. Não recalcular contratos restaurados com uma versão financeira diferente. Conferir contagens, snapshot, versão e plano exacto, além dos documentos privados existentes.

## Operações financeiras — M5

O backup integral inclui saldos, prestações, pagamentos, estornos, contador de recibos, caixa, depósitos, razão e `financial_private.signing_key`. Tratar o dump como segredo e dados pessoais. Restaurar os oito conjuntos financeiros juntos; nunca restaurar só pagamentos ou reiniciar o contador. Recibos estornados conservam os seus números. Conferir unicidade de recibos e IDs idempotentes, equilíbrio de cada journal e soma dos recebíveis contra prestações por pagar; verificar também saldo a favor e caixa.

A chave de 32 bytes em hexadecimal nasce aleatoriamente na migração e não é exposta pelo PostgREST. `pnpm local:env` lê-a com a ligação administrativa local e grava `FINANCIAL_SIGNING_KEY` em `.env.local` 0600. Não imprimir o valor, enviar em chat ou pôr em Git. Em produção, copiar com ferramenta administrativa segura para o segredo do servidor Vercel; não usar prefixo NEXT_PUBLIC. Preservar o valor entre releases/restauros. Rotação exige coordenar base e servidor, invalidando as atestações antigas de cinco minutos; pagamentos/recibos já gravados não mudam. Uma divergência falha fechada.

Upgrade de produção: fazer backup, suspender novas operações financeiras, aplicar migrações, instalar o motor histórico preservado e chave do servidor, inicializar os créditos M4 uma vez com o motor v1 (administrador de base, procedimento equivalente ao backfill local), conferir razão/carteira e só depois retomar. Não aceitar um plano fornecido por utilizadores nem usar service-role para contornar operações de negócio. O administrador de migração tem uma função distinta das sessões operacionais. Novos desembolsos já gravam plano/razão atomicamente.

A migração regista `loma-overdue-daily` em pg_cron se a extensão estiver disponível no Supabase. Verificar cron.job activo e cron.job_run_details após deploy; se não disponível, preparar um worker equivalente com ligação administrativa restrita que invoque apenas `financial_private.daily()`. No ambiente local o contentor daily executa essa função a cada 30 segundos e tenta novamente em falhas; somente datas pendentes são processadas. Não há mensagens externas nesta tarefa M5. Vigiar logs do worker e estado das datas processadas.

Pagamento, estorno ou consulta de crédito actualizam mora até ao dia actual antes de alterar saldos. Dias passados usam o saldo anterior; estorno devolve dívida hoje e não reescreve juros passados. Registo de pagamentos retroactivos não está activo; usar a data efectiva actual e referência, para não alterar intervalos fechados sem reprocessamento financeiro. Restauro deve incluir os acumuladores decimais e a data de apuramento.

## Mensagens — M6

O dump inclui fila, eventos, campanhas, leads, actividades/atribuições e communication_private (chave de cifra, integrações, recibos de callbacks e heartbeat). Guardar num destino cifrado com acesso restrito; a chave junto aos dados permite recuperação, mas torna o dump um segredo. Não restaurar só a fila: preservar IDs idempotentes, estado/custo/provider_id e eventos juntos.

Suspender o worker antes de restaurar. Conferir consentimento/bloqueios, horário, agendamento, limites e credenciais após restauro; renovar segredos de callbacks se houver exposição. Mensagens accepted/delivered não voltam à fila. Mensagens uncertain/dispatching podem ter chegado ao provedor: conferir por ID antes de qualquer reenvio e preservar a decisão auditada. Nunca converter todas as incertas em queued. Um timeout/5xx não prova que não houve entrega. Console só demonstra a execução em desenvolvimento.

Produção: Vercel executa o web e recebe callbacks; um serviço Node 24 contínuo executa `node scripts/message-worker.mjs --watch` com COMMUNICATION_DATABASE_URL server-only e TLS/certificados verificados. A migração cria o grupo NOLOGIN `loma_message_worker`, limitado às colunas de fila, helpers privados necessários, heartbeat e transições/eventos do worker. O operador cria um LOGIN privado membro deste grupo e usa-o na ligação; não disponibilizar esta identidade ao PostgREST ou navegador. O stack local usa o administrador apenas por ser um ambiente de desenvolvimento privado. Não configurar o worker com JWT service-role nem usar esta ligação em Server Actions. O papel restrito é testado localmente com SET ROLE, incluindo recusas de leitura de clientes/chave/credenciais; a criação do LOGIN seguro e a configuração alojada ainda não foram executadas.

Permitir saída apenas para os provedores escolhidos (WhatsApp: graph.facebook.com; SMS/email: host HTTPS contratado). O worker recusa IPs literais, DNS privado, portas não HTTPS, redireccionamentos e fixa o endereço durante a ligação TLS. Guardar tokens em Integrações, verificar os modelos aprovados da Meta, custo contratado, App Secret/verifyToken e o callback público HTTPS. Não testar envios reais sem destinatários autorizados. Logs console contêm dados pessoais e devem ter acesso e retenção definidos pelo operador.

Vigiar communication_private.worker_health.last_run, jobs queued com available_at passado, tentativas/erros e jobs uncertain. Heartbeat recente prova passagem do agendador; os testes de integração verificam o despacho real via console/mock. `services:start` inicia e verifica o worker; é repetível e não repõe dados. `test:messages` pausa/retoma apenas o contentor local que estava activo. Não reiniciar serviços durante os testes de navegador.

## M7 — Portal e telefone

Restaurar customer_accounts, portal_drafts, portal_documents, Auth e ficheiros privados em conjunto. Portal não pode ser reconstruído ligando clientes por BI/NUIT ou por telefone secundário: preservar vínculos explícitos. Recuperar portal_private.request_key e PUBLIC_REQUEST_SIGNING_KEY correspondente antes de voltar a aceitar operações públicas. A chave não substitui Auth/RLS nem pode ser reutilizada para assinar JWT.

OTP do hook console local é efémero; não usar estes códigos como backup de negócio nem publicar logs. Em Supabase alojado, activar telefone, configurar SMS e CAPTCHA do Auth e conferir um destino autorizado. TRUSTED_CLIENT_IP_HEADER só pode referir um valor que o proxy confiável substitua. Validar duração da sessão, limites e exposição pública das configurações após restauro. Provedor console, migrações locais e draft cloud não demonstram entrega externa ou restauro alojado. Detalhes em PUBLIC_SITE.md.
