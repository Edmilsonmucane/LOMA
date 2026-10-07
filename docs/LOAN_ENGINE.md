# Motor de crédito — M2

API pura em packages/loan-engine/src/index.ts. simulate recebe principal bigint em centavos, periods inteiro, startDate ISO e Terms serializáveis. validateTerms valida limites e regras; dados recebidos do exterior passam também por Zod no web. Métodos: flat, annuity (Price), sac, interest_only e bullet. Taxas são fracções decimais ("0.1" = 10%), valores fixos são strings de centavos. Precisão Decimal: 60 algarismos; arredondamento HALF_UP ao centavo.

## Plano e invariantes

Flat arredonda prestação e deixa a diferença para a última. Price arredonda juros em cada saldo real e ajusta o último pagamento. SAC calcula juros sobre o saldo teórico de amortização igual, distribui o capital ao centavo e absorve o resto no fim. Assim os três vectores obrigatórios são reproduzidos exactamente, sem saldo negativo ou residual. Todos os métodos suportam taxa zero.

Carência acrescenta períodos ao prazo de amortização. Pode ser gratuita, só juros ou capitalizada. Cada período aparece no plano: capitalisedInterest identifica juros acrescentados ao saldo, sem cobrança nesse dia. A amortização posterior incide sobre financed + capitalisedInterest; a soma de principal das linhas é esse valor. Juros pagos e capitalizados são somados em Quote.interest; os capitalizados não são reclassificados artificialmente nas prestações finais nem duplicados no custo. Instalment.total é principal + juros cobrados nessa data.

Quote.total é a soma das prestações mais cobranças pagas à parte no início. Portanto soma(instalments.total) = total - separate; sem cobranças à parte, soma das prestações = total. financed é o capital inicial mais encargos financiados, antes da carência. disbursed é o capital pedido menos encargos deduzidos; cost = total - disbursed inclui todas as modalidades de encargos. Fees e taxes são identificados separadamente. Encargos percentuais usam o capital pedido; impostos têm base configurável (capital, comissões ou juros) e vigência inclusiva na data de desembolso. Impostos financiados sobre juros são recalculados até estabilidade ao centavo, com recusa de não convergência.

Datas mensais preservam o dia de origem, limitando ao fim do mês quando necessário (31 jan → 28 fev → 31 mar). Datas diárias, semanais e quinzenais são civis; ajuste ao próximo dia útil usa apenas fins de semana e feriados configurados. A TIR considera fluxos reais: desembolso líquido de cobranças iniciais e pagamentos nas datas ajustadas; annualRate é fracção decimal anual, com yearDays do produto. Métodos de cálculo e convergência são técnicos, não taxas comerciais fixas.

## Funções adicionais

lateCharges conta atraso desde o dia seguinte ao vencimento, desconta tolerância e calcula mora diária sobre o montante em atraso; multa única só quando não aplicada. allocatePayment copia os dados, percorre prestações antigas primeiro e aplica a cascata configurada; distingue adiantamento às seguintes de saldo a favor. earlySettlement aceita dívida não paga e data de liquidação; oferece juros contratuais restantes, juros proporcionais por dias ou apenas juros vencidos. Não debita nem persiste: M5 fornecerá os saldos reais. eligibility verifica idade/rendimento definidos e encontra o perfil de aprovação pelo montante; controlo de aprovação do pedido entra em M4.

## Verificação

pnpm test:engine exige ≥95% em instruções, ramos, funções e linhas. Vectores flat, Price, SAC e mora; cinco métodos, carências, três tratamentos de comissões, impostos por base/vigência, calendários, pagamentos parciais/excedentes, liquidações, TIR e rejeição de entradas inválidas. 3 000 combinações determinísticas verificam soma das prestações, amortização e saldo final. Bigint é testado acima do limite inteiro exacto de Number. Isolamento e versões são verificados separadamente por pnpm test:rls na base/Auth reais.

## Contratos históricos (M4)

O motor desta fase permanece em `src/v1.ts`; `src/index.ts` reexporta a API e fornece `simulateContract(version, input)`. Contratos imutáveis guardam `engine_version=1`, principal/prazo/data/condições. Cálculos históricos são sempre projectados pela versão correspondente, sem aceitar totais do cliente. Uma mudança no comportamento financeiro exige v2 preservando v1. Cobertura inclui o motor financeiro completo v1 e o dispatch histórico. Versão suportada/desconhecida é testada no pacote puro; snapshot e texto são também testados no domínio de contratos.
