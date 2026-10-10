# Comunicação — M6

## Regras editáveis

`tenant_configuration`: `communication/rules` contém timezone, startHour inclusiva, endHour exclusiva, maxPerDay por cliente (todos os canais), maxAttempts, retrySeconds, texto de saída e escalões crescentes. `message_template` contém nome, texto/variáveis, canal sugerido, active e metadados do template WhatsApp. `automation` contém enabled, activatedAt, evento, offsetDays, template e canal. Valores iniciais são dados, não normas legais; todas as automações começam desligadas.

Vencimento: offset negativo antes, zero no dia, positivo depois. A tarefa compara a data civil configurada com vencimentos exactos não pagos, depois de actualizar a mora diária. Recibo/pedido/aprovação/recusa/desembolso usam acontecimentos posteriores à activação; cada acontecimento/vencimento tem chave única. Activar uma automação não reenvia acontecimentos antigos. Uma interrupção que atravessa uma data de lembrete exige revisão operacional; não são enviados lembretes tardios por suposição.

## Estados e repetição

queued → accepted → delivered por confirmação assinada. Rejeição explícita 429 mantém queued com backoff `retrySeconds × 2^(attempts−1)`, até maxAttempts. Recusa definitiva é failed; falta de consentimento/contacto/acesso/cancelamento é suppressed. Timeout/5xx/interrupção depois do início persistido é uncertain; conferir no provedor antes de repetir. HTTP genérico recebe Idempotency-Key. Não existe promessa de exactamente uma entrega quando o provedor não suporta idempotência; o comportamento conserva a incerteza em vez de duplicar automaticamente.

O worker confirma consentimento, bloqueio permanente do canal, contacto actual, agência, acesso do remetente, janela, frequência e limite do plano. Transacções bloqueiam tenant/cliente durante a submissão. Antes da rede grava uncertain/dispatching duravelmente. Custos confirmados são bigint/string; incertos mostram custo por confirmar. Uma mensagem aceite conta para os limites; uma tentativa que pode ter sido aceite também reserva o limite.

## Consentimento e segmentos

Autorização por canal tem origem e evento imutável; CSV não autoriza. SAIR cria bloqueio separado e desactiva o canal. Editar a ficha não apaga esse bloqueio. `set_communication_consent` regista nova autorização explícita ou opt-out; `provider_callback` só altera consentimento com assinatura correcta. Leads não recebem campanhas até existir ficha de cliente autorizada; não há inferência automática de consentimento por conversão.

Campanhas guardam agência, segmento e hora; preview conta apenas clientes com autorização, sem bloqueio e com contacto no canal. Segmentos: província, produto no histórico, sem crédito activo, aniversário hoje, última liquidação há pelo menos X meses, classe A–E registada. O score real entra em M8; ausência de classe não é classificada artificialmente. Expansão revalida o criador; cada cliente/campanha tem chave única. Cancelar impede os envios ainda pendentes, sem desfazer os que já foram submetidos.

Modelos com `{valor}` ou `{numero}` exigem contexto financeiro real. Campanhas e mensagens gerais usam modelos sem essas variáveis; não se substitui um valor desconhecido por zero. A pré-visualização de lembrete resolve a próxima prestação por pagar no servidor, usando valores exactos.

## Integrações e callbacks

O adaptador console regista no log privado do worker e custa zero em desenvolvimento. Mock só para testes. HTTP: POST JSON `{id,to,body,channel}`, Bearer, Idempotency-Key; responde JSON `{id}` quando aceite. HTTPS, porta 443, DNS público fixado, sem redireccionamentos. Não guardar credenciais no URL. WhatsApp Cloud: template aprovado, idioma e ordem de variáveis configurados; o conteúdo aprovado deve incluir instrução de saída. Não há mensagens livres para contornar as regras do fornecedor.

Metadados sem segredo são visíveis em tenant_configuration/integration; a configuração completa é cifrada AES-256 em communication_private.integrations. Chave e ciphertext não têm acesso Auth/PostgREST. Worker restrito chama os helpers autorizados; a identidade LOGIN é configurada pelo operador, sem segredo no repositório.

Callback público: `/api/message-webhooks/{tenant_uuid}/{sms|whatsapp|email}`. HTTP usa `x-loma-signature` (HMAC SHA-256 hexadecimal sobre bytes exactos) e `{id,status:"delivered"|"failed"}` ou `{from,message:"SAIR"}`. WhatsApp usa App Secret / `x-hub-signature-256`, payload oficial de statuses/messages e verifyToken para challenge. Limite 100 kB, deduplicação de assinatura, tenant/canal explícitos e nenhuma credencial em logs/resposta.

## Operação e fronteiras

`pnpm services:start` inicia worker local; `messages:run` faz uma passagem e `messages:watch` corre continuamente. `test:messages` pausa/repõe apenas o worker local, usa Auth/RLS reais e console/mock. Não testar contra bases alojadas nem enviar a números reais. Histórico de mensagens/actividades entra na linha do tempo do cliente; actividades são append-only. Cobranças usam planos/saldos do M5, e metas/atribuições não alteram contratos.

Uma nova atribuição reinicia a data de contagem da meta do cobrador. Recebimentos desde essa data são somados em centavos, com exclusão dos pagamentos estornados. Atribuição exige colaborador activo com permissão de cobranças e acesso à agência; contacto de cobrança também respeita a agência actual do cliente.

M7: captura pública de leads, pedido por telemóvel e área do cliente. M8: scoring real, relatórios e demonstração completa. A configuração do provedor real, entrega externa e deploy/recuperação alojados permanecem por validar com credenciais e destinos autorizados.
