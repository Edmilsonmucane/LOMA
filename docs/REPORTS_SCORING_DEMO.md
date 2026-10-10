# Relatórios, score e demonstração

## Consultar e exportar

Abra Relatórios, escolha o tipo, as datas e os filtros, e carregue em Consultar. Os seis relatórios são carteira por escalão, desembolsos/recebimentos, previsão, carteira por produto/agência/agente, extracto de cliente e fecho de caixa. Para o extracto, escolha um cliente; pesquise por nome para reduzir a lista. Caixa aceita apenas agência e período.

Saldos e provisões são de hoje em Africa/Maputo. Datas filtram movimentos efectivos e vencimentos; não existe reconstrução de saldos históricos. Recebimentos e desembolsos têm totais separados; um estorno é um movimento negativo na sua própria data, preservando o pagamento original. Provisões arredondam por crédito antes de agregar. As percentagens e a base (capital ou saldo total) são configuração do microcrédito, não uma interpretação legal da plataforma.

CSV e PDF usam o mesmo RPC, filtros, datas, montantes exactos e totais da consulta. O CSV é UTF-8, separado por ponto e vírgula, com células entre aspas e fórmulas neutralizadas. O PDF incorpora Instrument Sans e cria páginas adicionais. Até 5 000 linhas são mostradas/exportadas; quando há mais, aparece um aviso para restringir os filtros. Totais abrangem o conjunto filtrado completo. Ambas as saídas exigem sessão e `reports.read`, respeitam tenant/agência, registam auditoria e usam `private, no-store`. Não são links públicos.

## Configurar score e escalões

Abra Definições → Score e escalões de atraso. Ajuste os sete pesos relativos, pontos para informação em falta, intervalos, score mínimo de cada classe e limite sugerido em MT. Peso zero desliga um critério. A pré-visualização usa um cliente real do tenant ou um caso explicitamente sem histórico. Pode adicionar/remover intervalos e escalões. Valores inválidos impedem a gravação; uma alteração concorrente exige actualizar a página.

A classe A–E avalia o cliente; o escalão mede os dias de atraso de um crédito. Nunca os confunda. O limite é uma sugestão para análise, não aprovação automática nem alteração de condições assinadas. A configuração recalcula classes guardadas para campanhas e preserva os contratos.

A ficha e o pedido mostram a classe, os pontos, o limite sugerido e a decomposição por critério. O pedido usa a maior prestação proposta para a relação prestação/rendimento, sem sobrescrever a avaliação geral do cliente. Emprego e referências só contam como factos quando um colaborador regista informação comprovada e uma nota de origem. Sem evidência, aplica-se a pontuação configurada para informação em falta.

Avaliações guardam configuração, métricas e resultado, em histórico imutável. Perfil, informação comprovada, plano desembolsado, pagamentos/estornos e mora actualizam o cache. O agendador e a pré-visualização de campanhas actualizam a antiguidade/atraso uma vez por dia de Maputo. Clientes sem rendimento ou sem prestações não recebem uma relação inventada de zero.

## Experimentar e repor

`pnpm seed` prepara os utilizadores locais e o tenant `demonstracao`, com 120 clientes sintéticos, 60 créditos, pagamentos/recibos, pedidos pendentes e mensagens console. Mantém os tenants anteriores `demo` e `beira`. Credenciais aleatórias permanecem exclusivamente em `.local/accounts.json`; o utilizador local `sales` gere a demonstração. Repetir a seed preserva a geração já preparada, sem apagar operações ou redefinir palavras-passe.

A administração só pode activar demonstração num tenant vazio, pelo RPC `enable_demo`. Não é permitido transformar uma carteira real em demonstração. O gestor desse tenant vê o aviso de dados sintéticos e Definições → Demonstração → Repor demonstração. O painel pede confirmação do efeito. Pedidos simultâneos/confirmações antigas não criam duas gerações.

A reposição valida sessão, permissão, geração esperada e payload assinado pelo servidor com domínio de assinatura `demo:`. O browser nunca fornece planos. A transacção arquiva o tenant anterior (inactivo), cria o novo no mesmo subdomínio e copia a equipa. Contratos, recibos, razão e auditoria antigos ficam preservados. As consultas operacionais passam à geração nova; jobs diários deixam de operar gerações arquivadas. A recuperação administrativa de um arquivo exige o procedimento de backup/retenção, não reactivação pelo gestor.

Dados e evidências são identificados como sintéticos. Produtos da demonstração usam presets editáveis com exigências documentais vazias para os créditos históricos; não se fabricam ficheiros no Storage. O gestor pode configurar novas exigências para experimentar pedidos reais de teste. Mensagens são forçadas para console; integrações externas são recusadas. Isto não é prova de entrega SMS/WhatsApp/email. Auth por SMS de um ambiente alojado tem configuração separada e deve usar números de teste autorizados.

## Verificações

`pnpm test:m8` usa Auth/PostgreSQL reais para verificar relatórios/exportações, tenant/agência, auditoria, score, evidência, revisão, preservação de contratos, provisões exactas, restrição console, assinatura e arquivo de gerações. `pnpm test:fresh` aplica as migrações numa base temporária vazia, sobre os esquemas Auth/Storage oficiais, e remove apenas essa base ao terminar. Nenhum volume operacional é reposto.

Playwright usa demonstrações isoladas por projecto de navegador. O fluxo completo cria um produto pelo assistente, simula no site, confirma SMS nativo, submete PDF privado, aprova por um actor diferente, desembolsa, paga com recibo, verifica lembrete console e regista cobrança. Para testar vencimento sem esperar um mês, a fixture local define a data da proposta antes da aprovação e, por um trigger temporário limitado a essa proposta sintética, a data do acontecimento de aprovação no INSERT. O trigger é removido ao terminar. Nenhum contrato/plano financeiro já aprovado é reescrito e todos os controlos de datas de produção continuam activos. Não há controlo de relógio nem bypass exposto na aplicação.
