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
