# Backups e recuperação

## Desenvolvimento local

`pnpm backup:local` cria um dump PostgreSQL privado (0600) em `.local/backups`. Inclui dados Auth e de auditoria: tratar como informação sensível, não partilhar nem colocar no Git. Preservar também `.local/runtime.json`, `.local/supabase.json` e `.local/accounts.json` num destino privado para manter as ligações de desenvolvimento; não são um método de gestão de segredos em produção.

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

O restauro de um projecto Supabase alojado e a política de backup automática de produção dependem do projecto e plano reais; ainda não foram executados. Storage, contratos e documentos exigirão verificação de recuperação quando entrarem em M3/M4.
