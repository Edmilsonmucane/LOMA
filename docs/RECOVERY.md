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
