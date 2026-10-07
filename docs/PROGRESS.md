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

## Próximos marcos

M1: tenants, Supabase/Auth, RLS e teste de isolamento, perfis, auditoria e estrutura da aplicação.
M2: motor financeiro, vectores obrigatórios, presets e produtos versionados.
M3–M8: clientes, pedidos, pagamentos, comunicações, site público, relatórios e acabamento.

Os testes de isolamento, cobertura do motor, fluxo financeiro completo e Lighthouse do site público ainda não se aplicam a M0 e não foram executados. A plataforma financeira não está concluída.
