# Progresso dos marcos

## M0 — Fundações e sistema de design

Aceite em 7 out 2026.

- Monorepo pnpm com Next.js, TypeScript estrito, UI e fronteira do motor financeiro.
- Memória do projecto, tokens, fontes locais, Phosphor, Radix, TanStack e catálogo pt-MZ em `/design`.
- Estados normal, foco/hover, desactivado, carregamento, erro, vazio e confirmação; drawers, tabs e pesquisa por teclado.
- 16 testes Vitest e 14 verificações Playwright passaram. Typecheck, lint, formatação e build passaram; scans axe de catálogo, drawer e pesquisa sem violações WCAG AA detectadas, em computador e emulação móvel.
- Produção: página inicial HTTP 200; `/design` HTTP 404 com mensagem pt-MZ. Revisão visual desktop/mobile efectuada. Instalação congelada repetida com sucesso.

## Ambiente

`install_script` e `start_skill` guardados no rascunho do ambiente cloud; script de instalação executado novamente com sucesso. Publicação do snapshot continua a ser uma acção do utilizador nas definições do ambiente. Não foi validada a restauração numa tarefa nova.

## M1 — Tenants, autenticação e estrutura

Aceite em 7 out 2026 após as verificações registadas abaixo.

- PostgreSQL 17, Supabase Auth e PostgREST reais; dez tabelas com RLS, FKs compostas, migrações transaccionais e tipos gerados do esquema aplicado.
- Tenants por subdomínio, painel separado da plataforma, provisionamento por preset, planos/limites/features, login, convites aceites com palavra-passe, cinco perfis editáveis, limites por agência e auditoria imutável.
- Marca editável com contraste derivado, estrutura móvel da aplicação, pesquisa por navegação/equipa autorizada e definições de TOTP, palavra-passe e duração de sessão.
- 26 testes Vitest, 22 verificações reais de base/Auth e 24 testes Playwright passaram (computador e Pixel 7). Criação de tenant ficou abaixo de dois minutos nos dois projectos do navegador; preset criou 4 produtos, 2 mensagens e site em cada tenant.
- Produção local: início e login HTTP 200; /design HTTP 404; aplicação sem sessão redirecciona para login. Login do gestor e página de auditoria verificados; cookies Secure, HttpOnly, SameSite Lax e limitados ao host do tenant.
- Typecheck, lint, formatação e build passaram. Scans axe da aplicação e catálogo sem violações WCAG AA detectadas; revisão visual efectuada. Menu móvel fecha ao navegar, com teste executado.
- Instalação congelada e script de onboarding repetidos com sucesso. Stack de volume vazio e todas as migrações verificadas numa rede/base isolada. Backup restaurado em base temporária, com contagens de tenants, equipa e auditoria e dez tabelas RLS preservadas.
- Instruções M1 guardadas no rascunho cloud, ainda dependentes de Review/Save/Publish pelo utilizador. Restauro numa tarefa cloud nova não validado.

Limites: produção alojada, DNS, entrega externa de convites e recuperação de Supabase alojado não executados. O mínimo adicional de palavra-passe do tenant é aplicado na aplicação; o fornecedor reforça o seu mínimo global. Taxas dos produtos iniciais estão por confirmar e nenhum produto/site/automação é publicado em M1. Storage, cron, dados de clientes e operações de crédito entram nos seus marcos.

## M2 — Motor de crédito e Produtos

Aceite em 7 out 2026 após as verificações abaixo.

- Pacote puro com flat, Price, SAC, só juros e bullet; carência, comissões nos três tratamentos, impostos por vigência/base, calendário editável, mora/multa, cascata, excedente, liquidação antecipada, elegibilidade e TIR anual. Valores bigint/Decimal e diferenças absorvidas no fim.
- Assistente em três passos com pré-visualização viva do mesmo motor, todas as regras editáveis, quatro presets em dados, publicação/rascunho/arquivo e consulta de histórico. Versões imutáveis, revisão optimista, auditoria e RLS nas duas tabelas adicionais.
- 117 testes Vitest passaram, incluindo 88 do motor, quatro vectores obrigatórios e 3 000 combinações determinísticas. Cobertura: instruções 98,15%; ramos 98,38%; funções 100%; linhas 99,28%. CI exige pelo menos 95% em cada dimensão.
- 25 verificações na base/Auth reais passaram: isolamento, escrita autorizada, imutabilidade, versão publicada preservada ao guardar rascunho, conflito HTTP 409, dados inválidos e perfis de outro tenant. Criação de tenant continua a provisionar os produtos em rascunho.
- Suite Playwright completa: 30 testes passaram; os seis testes M2 foram repetidos após a revisão final e passaram em computador/Pixel 7. Criação, simulação, publicação, nova versão, histórico e acesso de leitura verificados. Scans axe do drawer sem violações WCAG AA detectadas, sem overflow da página; revisão visual executada.
- Typecheck, lint, formatação e build de produção passaram. Em produção local: login real, produtos HTTP 200, simulação flat correcta, nenhum erro de navegador e /design HTTP 404. Documentação, comandos e CI actualizados.

Limites: não há ainda clientes, contratos nem registo persistente de pagamentos; o motor fornece cálculos puros para esses marcos. Produtos publicados ainda não são apresentados num site público (M7). A facilidade do assistente foi verificada por fluxo automatizado e revisão, sem ensaio com um gestor real. Produção alojada e restauração do snapshot cloud continuam por validar.

## Próximos marcos

M3: clientes, documentos, duplicados, consentimento, linha do tempo e importação CSV.
M4–M8: pedidos, contratos, pagamentos, comunicações, site público, relatórios e acabamento.

Isolamento e cobertura do motor estão comprovados. O fluxo financeiro completo e Lighthouse do site público aguardam os respectivos marcos; a plataforma financeira não está concluída.
