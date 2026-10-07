# Decisões

## 2026-10-07 — M0

- Nome inicial: LOMA, do repositório; marca de cada tenant será configurável.
- Stack solicitada: Next.js App Router, TypeScript estrito, pnpm workspace, Tailwind com tokens próprios, Radix, Phosphor regular, next-intl, Vitest e Playwright.
- M0 inclui apenas fundações e catálogo de componentes; não apresenta dados financeiros fictícios como funcionalidades operacionais.
- Fontes Instrument Sans e Newsreader servidas localmente por pacotes Fontsource, evitando dependência de Google Fonts em runtime/build.
- `/design` existe apenas em desenvolvimento; produção devolve 404.
- pnpm 10 é a linha escolhida para reprodutibilidade e compatibilidade com Node 24.
- Configuração Supabase, autenticação e isolamento real são entregas de M1, não simulados em M0.

- next-intl 4.4.0 fixado: oferece os recursos de internacionalização necessários sem o extractor experimental dependente de SWC nativo, incompatível com a propriedade dos directórios deste sandbox. Não há alteração às verificações de integridade/TLS.
- ESLint 9.39.5 mantido por compatibilidade com os plugins react/import/jsx-a11y da configuração Next; a migração para 10 aguarda suporte declarado desses plugins.
- Tabela usa TanStack; o componente opta explicitamente por não usar memoização do React Compiler devido aos callbacks mutáveis da biblioteca. Uma excepção de lint local e documentada cobre apenas esse aviso de optimização.
- Controlos interactivos só ficam activos depois da hidratação, evitando que cliques iniciais se percam em redes lentas. Testes aguardam a mesma prontidão visível nos controlos.
- `next-env.d.ts` é gerado e ignorado; `next typegen` precede o typecheck, conforme documentação Next 16.
