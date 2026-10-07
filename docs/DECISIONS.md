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

## 2026-10-07 — M1

- Auth e autorização reais, sem modo de autenticação simulado. Cliente SSR por sessão; service-role exclusivo do servidor para convites após validação de tenant, perfil e agência.
- Resolução pelo Host validado contra PLATFORM_BASE_DOMAIN; um subdomínio por tenant. Cookies ficam no host, sem domínio wildcard. Domínios desconhecidos e reservados são recusados. Domínios próprios ficam preparados na fronteira de resolução, sem implementação prematura.
- Base local: PostgreSQL 17-alpine, imagens oficiais GoTrue/PostgREST, Mailpit e proxy Node mínimo. A imagem monolítica Supabase/Postgres ficou retida no descarregamento/preparação pelo Docker vfs; a alternativa menor mantém SDKs, JWT, sessões reais e RLS. Produção mantém Supabase alojado.
- CLI Supabase 2.75.0 fixado para geração de tipos: o CLI recente tentou escrever na pasta pessoal restrita. Checksum oficial do binário verificado pelo instalador. Registro ECR bloqueado nesta rede; imagem de postgres-meta equivalente obtida do Docker Hub para tipos.
- Configuração local gera segredos aleatórios, ficheiros 0600 e volume persistente. Seed inicial idempotente cria dois tenants e cinco perfis; não repõe dados ou palavras-passe. Serviços aplicam migrações em transacção com lock e checksum.
- Presets guardados em JSON editável na base: cinco perfis e configurações iniciais de quatro produtos, duas mensagens e site. Taxas financeiras ficam por confirmar e os produtos/automação/site não são publicados em M1. O assistente de produtos entra em M2.
- Provisionamento atómico por RPC autorizado do super-admin. Cria agência Sede, perfis, gestor inicial e configuração. Limites de utilizadores reforçados por trigger com lock do tenant; limites de créditos e mensagens ficam preparados para os seus módulos.
- Perfis têm interruptores de permissões. Utilizador limitado a agência não gere marca nem equipa global, mesmo que o perfil inclua essas permissões. FKs compostas impedem associar perfil/agência de outro tenant. Trigger preserva o último gestor e o acesso essencial do perfil gestor.
- Auditoria de configuração, perfis, marca e acessos registada por triggers/RPC, incluindo actor e valores anterior/novo; UPDATE, DELETE e TRUNCATE bloqueados por triggers. Administração global tem auditoria separada.
- Segurança do tenant: MFA TOTP opcional/obrigatório e tempo de sessão verificados por RLS contra auth.sessions e aal. Activar MFA exige primeiro verificar o factor do gestor para evitar bloqueá-lo. Mínimo de palavra-passe validado na aplicação; o mínimo global deve também ser configurado no Auth. O endpoint directo do fornecedor segue a política global, não o campo adicional do tenant.
- Marca: nome, cor derivada com contraste, URL HTTPS de logótipo, contactos, licença e rodapé. URL do logótipo é uma primeira opção reversível; carregamento privado de documentos entra em M3, editor do site em M7.
- Navegação limita-se aos seis módulos principais mais Relatórios/Definições; itens sem permissão não são mostrados. Pesquisa global em M1 cobre navegação e equipa autorizada. Pesquisa por cliente/BI/NUIT entra com Clientes em M3.

- O proxy de rede do ambiente é injectado nos contentores; NO_PROXY inclui os serviços Docker internos para o Auth obter o modelo português de convite. O callback usa o Host validado para preservar o subdomínio externo, evitando o endereço interno do servidor Next. Ambos verificados no fluxo de aceitação do convite.
