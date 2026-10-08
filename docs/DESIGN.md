# Sistema de design LOMA

## Intenção

Calma, precisão e confiança. Espaço negativo, linhas discretas, hierarquia tipográfica; nenhuma decoração sem função.

## Tokens

Papel #F6F5F2; superfície #FFFFFF; tinta #15171A; secundário #6B6F76; linha #E7E5E0; marca inicial #0E5A4A; erro/atraso #B4452F. Cor de marca editável, com foreground contrastante e hover/fundo suave derivados. Tokens semânticos preparados para futura variante escura, sem activar modo escuro em M0.

Instrument Sans na interface, Newsreader nos títulos editoriais públicos. Escala 12/13/14/16/20/28/40 px. Títulos 600, tracking apertado; números tabulares em dinheiro/datas/tabelas. Grelha 4px; cartões 8px, campos 6px; pílula apenas em etiquetas. Linhas 1px, sombras apenas em superfícies flutuantes.

## Componentes e estados

Botões (primário/secundário/discreto/perigo; hover/foco/desactivado/a carregar); campos com rótulo, ajuda e erro; tabela normal/compacta; drawer; etiquetas de estado; tabs; paleta de comandos; skeleton; estado vazio e erro recuperável. Radix fornece semântica e gestão de foco. Phosphor regular é a única família de ícones. Alvos interactivos >=44px, teclado e foco visível. Movimento funcional 160ms ease-out, desactivado em prefers-reduced-motion.

## Estrutura futura

Sidebar: Hoje, Clientes, Pedidos, Créditos, Cobranças, Mensagens; Relatórios e Definições no fundo. Criar/editar em drawers; uma acção principal por ecrã; Ctrl/Cmd+K abre pesquisa. Mobile utilizável, site público mobile-first.

## Texto

pt-MZ, frases curtas, verbos directos, sem emojis/jargão. Dinheiro `10 000,00 MT`, data `7 out 2026`, telefone `+258 84 123 4567`. Todo o conteúdo vem de catálogos de tradução. Demonstrações moçambicanas, identificadas como tal.

## Proibições

Sem gradientes, vidro, manchas desfocadas, sombras repetidas, ícones em círculos coloridos, cartões com bordas laterais coloridas, ilustrações genéricas, contadores animados ou copy promocional genérica.

## Catálogo

/design apenas em desenvolvimento demonstra variantes, estados e interacções. Validar teclado, foco, mobile e contraste. Temas públicos Clássico/Moderno e scoring ficam nos seus marcos.

## Validação M0

Catálogo revisto visualmente a 1440px e 390px. Testes Playwright em computador e Pixel 7 verificam ausência de overflow da página, foco/restauração do drawer, pesquisa e estados vazios, tabs, densidade, marca e reduced motion. Scans axe WCAG AA passaram nos três contextos (catálogo, drawer, pesquisa). Estados desactivados distinguem-se visualmente; elementos icon-only têm nomes acessíveis. A tabela mantém scroll local em ecrãs estreitos. Avaliação com leitor de ecrã real e metas Lighthouse do site público pertencem ao acabamento dos respectivos marcos.

## M1 — Aplicação autenticada

Barra lateral de 224px, seis módulos principais e dois itens inferiores, filtrados pelas permissões. Em móvel, navegação num drawer e cabeçalho compacto. Conteúdo com linhas finas, espaçamento de 4px, superfícies neutras; marca e contraste derivados da cor do tenant. A página Hoje apresenta preparação real do tenant enquanto os módulos financeiros não existem.

Criar tenant, agência, convite e editar perfis/acessos usam drawers com uma acção principal. Permissões editadas por interruptores, sem matriz. Login com identidade do microcrédito; QR para TOTP; erros curtos em português. A pesquisa por Cmd/Ctrl+K permite abrir definições e encontrar membros autorizados da equipa. Marca, segurança e auditoria usam páginas de detalhe simples. Catálogo /design continua exclusivo de desenvolvimento.

## M2 — Produtos

Lista com nome, modalidade, periodicidade, versão e estado; Criar produto é a acção principal. Criar/editar/consultar num drawer: Condições → Mais opções → Confirmar. Limites, carência, comissões, impostos, penalizações, calendário, imputação, liquidação, requisitos e aprovação usam rótulos em português; perfis mostram o nome editável, não identificadores técnicos.

Simulador mostra prestação, total, custo, desembolso, cobrança inicial e taxa efectiva anual. SAC identifica a primeira prestação; só juros identifica os juros periódicos com capital no fim; bullet identifica pagamento único. Plano mostra datas, capital, juros e prestação, com juros capitalizados quando aplicáveis. Versões anteriores são consultáveis sem edição. Revisão visual em computador e móvel e scans axe do drawer executados; a tabela tem scroll local, sem overflow da página.

## M3 — Clientes

Pesquisa, filtro por lista/agência e Criar cliente acima da tabela; importar é acção secundária. Tabela de nome, contacto, província e estado sem números decorativos. Ficha usa secções com linhas finas, identificação, contactos, morada, actividade, referências, fiadores, consentimento e documentos, seguidas pela linha do tempo. Edição em drawer com básicos à vista e detalhes opcionais recolhidos. Telefone apresentado como +258 84 123 4567; datas com meses pt-MZ do catálogo.

Importação em três passos: escolher CSV → ligar colunas → rever/importar. Contagem real, erros por linha, relatório completo descarregável e explicação de ausência de consentimento. Canais de mensagens por interruptor, origem da autorização junto aos campos. Documentos mostram validade, estado expirado e ajuda sobre ligações temporárias. Estados vazios úteis, carregamento com skeleton, teclado/foco e scans axe da ficha/drawer verificados em computador/móvel.

## M4 — Pedidos e desembolso

Lista com pesquisa por cliente/número, filtro por estado e alternativa quadro; paginação real de 50 e aviso do âmbito do quadro. Ficha com cliente/produto, estado, análise, checklist e plano completo; relação prestação máxima/rendimento, despesas e lista do cliente, sem score inventado. Parecer junto à decisão e explicação quando outro colaborador é necessário. Mais opções reúne rever/cancelar.

Contrato PDF privado, Instrument Sans incorporada, linhas e margens generosas; montantes exactos, taxa efectiva anual e plano paginado. Modelo em linguagem editável pelo gestor; efeito limitado a novas aprovações indicado junto ao formulário. Desembolso num drawer com data contratual, assinatura, método, referência e confirmação do efeito. Estado vazio com próxima acção, skeletons com forma de linhas e foco/teclado dos primitivos existentes.

Validação final M4: revisão visual em produção a 1440px e 390px, PDF e scans axe do pedido/drawer/crédito/modelo em computador/Pixel 7. Plano usa região com foco por teclado e scroll local; dinheiro não quebra entre linhas. Ecrãs encerrados não mostram um painel de acções vazio. O teste do catálogo aguarda a animação de entrada antes de medir contraste, sem mudar o limite AA.

## M5 — Dinheiro diário

Hoje tem quatro números reais, sem gráficos; lista ordenada por vencimento com Ligar e Registar pagamento. Valores sem permissão dizem Sem acesso. Caixa é um atalho, sem acrescentar itens à navegação principal. A paleta encontra Registar pagamento e Caixa. A escolha do cliente abre o drawer, seguido de valor/método e conferência com cascata legível.

Saldo, saldo a favor e prestações por pagar dominam o detalhe do crédito; plano original fica em disclosure e contrato privado. Extracto mantém recibos estornados. Caixa usa contagem de numerário e diferença viva, motivo quando necessário. Tabelas têm scroll local, alvos de 44px, foco e rótulos. Fluxos de pagamentos/caixa foram verificados por teclado/axe e a 390px.

Saldos importantes usam 28px e MT menor/secundário, sem perder o formato exacto. Acções agrupadas têm 12px de espaço. Prestações e caixa preservam dinheiro/datas numa linha com scroll local; revisão final em produção a 1440/390px.

## M6 — cobrança e comunicação

Cobranças são linhas por prioridade de vencimento, com atraso/valor, nota recente e acções directas. Registar contacto abre drawer para contacto, promessa com data/valor, visita ou conclusão. Atribuição/meta ficam em Mais opções. Escalões e carteira própria são filtros simples; nenhum gráfico ou nova entrada principal no menu.

Mensagens mostra texto, canal, custo exacto, tentativas, resultado e motivo legível. Aceite pelo provedor e Entrega confirmada têm rótulos distintos; envios incertos pedem conferência, sem apresentar zero como custo conhecido. Modelos/automações/campanhas/contactos interessados são navegação secundária. Modelos não exigem identificadores técnicos; associação de lead procura o cliente pelo nome. Campanha confere destinatários e texto antes da confirmação. Consentimento e horário são explicados junto à acção.

Configuração usa campos com rótulos, interruptores e estados de confirmação. Credenciais nunca reaparecem e são apagadas do formulário após guardar. Loading mantém a forma das linhas; erro permite tentar de novo. Listas quebram texto e agrupam acções a 390px, sem sombras ou decoração; drawers usam os primitivos acessíveis existentes.

Validação M6: oito fluxos Playwright em computador/Pixel 7, scans axe e revisão visual em produção local a 1440/390px. Selects e interruptores têm alvos de pelo menos 44px; custos, metas e inputs monetários usam números tabulares. Pré-visualização de lembrete mostra prestação real e saída; campanha mostra apenas destinatários autorizados e texto antes de confirmar. Nenhum overflow da página ou erro de navegador detectado. Sem ensaio de usabilidade com gestor real.
