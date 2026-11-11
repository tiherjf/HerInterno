# Redesenho Visual — Etapas 0 (Base) e 1 (Início) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à intranet a identidade do HER (direção A2 · Azul discreto): tokens, menu, cabeçalho com busca, login, carregamento e nova página inicial.

**Architecture:** Tokens shadcn em `app/globals.css` passam a ser o azul HER, então toda tela herda a cor. Menu, cabeçalho, login e Início são reescritos à mão. A busca é uma rota `/api/busca` com consultas `ilike` em paralelo e um dropdown no cabeçalho. Aniversariantes exige a coluna `profiles.birth_date` (migração 048).

**Tech Stack:** Next.js 14 App Router, Tailwind v4 (tokens via `@theme inline`), shadcn/ui, lucide-react, Supabase.

**Spec:** `docs/superpowers/specs/2026-11-11-redesign-visual-design.md`

## Global Constraints

- Azul HER `#1f3b9c` (`226 67% 37%`); accent `#eaf0fd`; background `#f8fafc`; border slate-200; `--radius: 0.75rem`.
- Direção A2: azul só em detalhes; item ativo do menu = fundo accent + texto azul + barra 3px azul à esquerda.
- Arquivos CRLF; textos de interface em português.
- Sem framework de teste: lógica pura testada com scripts `node --experimental-strip-types` em `scripts/tests/`; telas verificadas com `npx tsc --noEmit`, `npx next lint`, `npm run build` e captura headless.
- Aniversariantes mostram só dia/mês, nunca ano/idade.
- Não quebrar: badges de não lidas (notícias/chat), status do chat, menu recolhível, menu mobile, filtragem por papel.

## Review Focus

- Busca com `%`, `_`, `,`, `(` ou `)` no termo — não pode quebrar o filtro `or()` do PostgREST nem virar curinga; esperado: tratado como texto literal. → teste em Task 3.
- Busca com menos de 2 caracteres ou só espaços — esperado: lista vazia sem consultar o banco. → teste em Task 3.
- Usuário cujo papel não tem o módulo no menu — esperado: aquele grupo não aparece na busca. → teste em Task 3.
- Saudação à meia-noite/madrugada no fuso de São Paulo com servidor em UTC — esperado: "Boa noite" de 18h a 4h59, "Bom dia" 5h–11h59, "Boa tarde" 12h–17h59 no horário de Brasília. → teste em Task 7.
- Banco sem a migração 048 — esperado: Início abre normalmente, card mostra "Nenhum aniversariante este mês". → teste em Task 7.

---

### Task 1: Tokens, logo, layouts e carregamento

**Files:**
- Modify: `app/globals.css` (bloco `:root`)
- Modify: `app/layout.tsx` (`themeColor`)
- Create: `public/brand/logo-horizontal.png`, `public/brand/logo-quadrado.png` (copiar das imagens enviadas)
- Modify: `app/intranet/layout.tsx`, `app/admin/layout.tsx` (fundo `bg-background`; `<main>` com `p-4 md:p-8` e wrapper `max-w-7xl mx-auto`)
- Create: `app/intranet/loading.tsx`, `app/admin/loading.tsx`
- Create: `components/layout/PageSkeleton.tsx`

**Interfaces:**
- Produces: `PageSkeleton(): JSX.Element` (título + 3 cartões + bloco grande, `animate-pulse`, cores `bg-slate-200/70`); `/brand/logo-horizontal.png`, `/brand/logo-quadrado.png`.

- [ ] **Step 1:** Trocar `:root` em `globals.css`: `--primary: 226 67% 37%`, `--primary-foreground: 0 0% 100%`, `--ring: 226 67% 37%`, `--accent: 223 85% 95%`, `--accent-foreground: 226 67% 37%`, `--background: 210 40% 98%`, `--foreground: 222 47% 11%`, `--card`/`--popover: 0 0% 100%` com foreground igual, `--secondary`/`--muted: 210 40% 96%`, `--muted-foreground: 215 16% 47%`, `--border`/`--input: 214 32% 91%`, `--radius: 0.75rem`. `themeColor: "#1f3b9c"`.
- [ ] **Step 2:** Copiar logos, ajustar os dois layouts, criar `PageSkeleton` e os dois `loading.tsx` que o renderizam.
- [ ] **Step 3:** `npx tsc --noEmit` → sem erros.
- [ ] **Step 4:** Commit `feat(visual): identidade HER nos tokens, logo e tela de carregamento`.

### Task 2: Menu lateral

**Files:**
- Modify: `components/layout/Sidebar.tsx` (bloco `<aside>`, `NavLink`, cabeçalho do logo)

**Interfaces:**
- Consumes: `/brand/logo-horizontal.png` (Task 1).
- Produces: nada novo; props de `Sidebar` inalteradas.

- [ ] **Step 1:** `<aside>`: `bg-white border-r border-border text-slate-600`. Topo: expandido → `<img src="/brand/logo-horizontal.png" alt="Hospital Evandro Ribeiro" className="h-10 w-auto">`; recolhido → selo `HER` (`w-9 h-9 rounded-lg bg-primary text-white text-xs font-bold`). Botão recolher em `hover:bg-slate-100`.
- [ ] **Step 2:** `NavLink`: normal `text-slate-600 hover:bg-slate-100 hover:text-slate-900`, ícone `text-slate-400`; ativo `bg-accent text-primary font-semibold` + `before:` barra `w-[3px]` azul à esquerda (link `relative`), ícone `text-primary`. Títulos de categoria `text-[11px] text-slate-400`; separadores `border-slate-200`.
- [ ] **Step 3:** `npx tsc --noEmit` e `npx next lint --file components/layout/Sidebar.tsx` → limpo.
- [ ] **Step 4:** Commit `feat(visual): menu lateral branco com logo do HER`.

### Task 3: API de busca

**Files:**
- Create: `lib/busca/query.ts` (lógica pura)
- Create: `app/api/busca/route.ts`
- Test: `scripts/tests/busca-query.test.mts`

**Interfaces:**
- Produces:
  - `normalizeSearchTerm(raw: string | null): string | null` — trim, colapsa espaços, remove `%`, `_`, `,`, `(`, `)`, `*`, `\`; `null` se resultado < 2 caracteres.
  - `type SearchGroupKey = "ramais" | "noticias" | "corpo-clinico" | "procedimentos" | "documentos"`
  - `searchGroupsForMenu(menuKeys: string[]): SearchGroupKey[]` — grupo entra só se a chave de menu correspondente estiver em `menuKeys` (`ramais`→`ramais`, `noticias`→`noticias`, `corpo-clinico`→`corpo-clinico`, `procedimentos`→`procedimentos`, `documentos`→`documentos`).
  - `interface SearchHit { group: SearchGroupKey; id: string; title: string; subtitle?: string; href: string }`
  - `GET /api/busca?q=` → `{ hits: SearchHit[] }` (até 5 por grupo, staff autenticado via `requireStaff`, grupos via `getMenuForRole`).

- [ ] **Step 1: Teste que falha** em `scripts/tests/busca-query.test.mts` (node:assert):
  - `normalizeSearchTerm("  a ") === null`; `normalizeSearchTerm(null) === null`; `normalizeSearchTerm("   ") === null`
  - `normalizeSearchTerm("50%_off") === "50off"`; `normalizeSearchTerm("uti, (bloco)") === "uti bloco"`; `normalizeSearchTerm("  Raio   X ") === "Raio X"`
  - `searchGroupsForMenu(["ramais","chat"])` deepEqual `["ramais"]`; `searchGroupsForMenu([])` deepEqual `[]`
- [ ] **Step 2:** `node --experimental-strip-types scripts/tests/busca-query.test.mts` → falha (módulo inexistente).
- [ ] **Step 3:** Implementar `lib/busca/query.ts`. Na rota: termo normalizado → `ilike` `%termo%` com `.or()` por grupo em `Promise.all`, cliente de usuário (`createClient` do servidor, respeita RLS): ramais (`numero`,`descricao`, embed `ramal_setores(name)`, `active=true`) → `/intranet/ramais?q=`; news (`title`,`summary`, `status=published`) → `/intranet/noticias/{id}`; corpo_clinico (`nome`,`especialidade`, `ativo=true`) → `/intranet/corpo-clinico?q=`; procedimentos (`nome`, `ativo=true`) → `/intranet/procedimentos?q=`; documents (`title`) → `/intranet/documentos?q=`. Erro de um grupo não derruba os outros (grupo vazio).
- [ ] **Step 4:** Teste passa; `npx tsc --noEmit` limpo.
- [ ] **Step 5:** Commit `feat(busca): rota de busca geral por ramais, notícias, médicos, procedimentos e documentos`.

### Task 4: Cabeçalho com busca

**Files:**
- Create: `components/layout/GlobalSearch.tsx` (client)
- Modify: `components/layout/Header.tsx`

**Interfaces:**
- Consumes: `GET /api/busca?q=` → `{ hits: SearchHit[] }`, tipos de `lib/busca/query.ts` (Task 3).
- Produces: `GlobalSearch(): JSX.Element`.

- [ ] **Step 1:** `GlobalSearch`: input `placeholder="Buscar ramal, notícia, médico, documento…"` com ícone `Search`, selo `Ctrl K`; debounce 250ms; `AbortController` cancela requisição anterior; dropdown agrupado (rótulos: Ramais, Notícias, Corpo Clínico, Procedimentos, Documentos), ↑/↓/Enter/Esc, clique fora fecha, "Nenhum resultado para “…”" quando vazio; Ctrl+K/Cmd+K foca.
- [ ] **Step 2:** `Header`: fundo branco, remove quadrado "HER" e textos no desktop; no mobile (`lg:hidden`) mostra `/brand/logo-horizontal.png` `h-7` ao lado do botão de menu; `GlobalSearch` em `flex-1 max-w-md` (oculto < `sm`, com botão-lupa que expande no mobile); ações da direita mantidas.
- [ ] **Step 3:** tsc + lint limpos.
- [ ] **Step 4:** Commit `feat(visual): cabeçalho com busca geral (Ctrl+K)`.

### Task 5: Login, esqueci e nova senha

**Files:**
- Modify: `app/(auth)/login/page.tsx`, `app/(auth)/esqueci-senha/page.tsx`, `app/(auth)/nova-senha/page.tsx`
- Create: `components/auth/AuthShell.tsx`

**Interfaces:**
- Produces: `AuthShell({ title, description, children, footer? }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }): JSX.Element` — fundo `bg-gradient-to-br from-slate-50 via-white to-[#eaf0fd]`, logo horizontal `h-14` centralizado, cartão branco `rounded-2xl shadow-xl`, rodapé "Acesso restrito a colaboradores…".

- [ ] **Step 1:** Criar `AuthShell` e envolver as três páginas, preservando toda a lógica de formulário.
- [ ] **Step 2:** tsc + lint limpos.
- [ ] **Step 3:** Commit `feat(visual): telas de login com a identidade do HER`.

### Task 6: Data de nascimento no perfil

**Files:**
- Create: `supabase/migrations/048_profiles_birth_date.sql` (`alter table public.profiles add column if not exists birth_date date;`)
- Modify: `app/api/perfil/route.ts` (GET devolve, PATCH aceita `birth_date` `YYYY-MM-DD` ou `null`)
- Modify: `app/intranet/perfil/page.tsx` (campo `type="date"` "Data de nascimento", com nota "Só dia e mês aparecem para os colegas")
- Modify: edição de usuário em `app/admin/usuarios` + sua rota de API (mesmo campo)

**Interfaces:**
- Produces: `profiles.birth_date: date | null`.

- [ ] **Step 1:** Migração + rota de perfil: PATCH valida `/^\d{4}-\d{2}-\d{2}$/` ou `null`, senão 400 `"Data de nascimento inválida"`.
- [ ] **Step 2:** Campos na tela de perfil e na edição do admin.
- [ ] **Step 3:** tsc + lint limpos.
- [ ] **Step 4:** Commit `feat(perfil): data de nascimento para aniversariantes`.

### Task 7: Nova página inicial

**Files:**
- Create: `lib/home/greeting.ts`
- Test: `scripts/tests/greeting.test.mts`
- Create: `components/home/HeroNews.tsx`, `components/home/BirthdaysCard.tsx`, `components/home/UpcomingEventsCard.tsx`, `components/home/MyTicketsCard.tsx`
- Modify: `app/intranet/page.tsx`, `components/home/NewsFeed.tsx` (prop `excludeId?: string`)

**Interfaces:**
- Consumes: `profiles.birth_date` (Task 6), tokens (Task 1).
- Produces:
  - `greetingFor(date: Date): "Bom dia" | "Boa tarde" | "Boa noite"` (hora em `America/Sao_Paulo`: 5–11 dia, 12–17 tarde, resto noite)
  - `formatLongDatePtBR(date: Date): string` → ex. `"quarta-feira, 11 de novembro"`, fuso São Paulo
  - `birthdaysOfMonth(people: { id: string; full_name: string; avatar_url: string | null; birth_date: string | null }[], now: Date): { id: string; full_name: string; avatar_url: string | null; day: number; isToday: boolean }[]` — só mês corrente (fuso SP), ordenado por dia, ignora `null`/inválidas.

- [ ] **Step 1: Teste que falha** `scripts/tests/greeting.test.mts`:
  - `greetingFor(new Date("2026-11-11T02:30:00Z")) === "Boa noite"` (23h30 SP)
  - `greetingFor(new Date("2026-11-11T08:00:00Z")) === "Bom dia"` (05h SP)
  - `greetingFor(new Date("2026-11-11T15:00:00Z")) === "Boa tarde"` (12h SP)
  - `greetingFor(new Date("2026-11-11T21:00:00Z")) === "Boa noite"` (18h SP)
  - `formatLongDatePtBR(new Date("2026-11-11T15:00:00Z")) === "quarta-feira, 11 de novembro"`
  - `birthdaysOfMonth([{id:"a",full_name:"Ana",avatar_url:null,birth_date:"1990-11-11"},{id:"b",full_name:"Bia",avatar_url:null,birth_date:"1985-11-03"},{id:"c",full_name:"Caio",avatar_url:null,birth_date:"1992-12-11"},{id:"d",full_name:"Dani",avatar_url:null,birth_date:null}], new Date("2026-11-11T15:00:00Z"))` → ids `["b","a"]`, `a.isToday === true`, `b.isToday === false`
  - `birthdaysOfMonth([], new Date())` deepEqual `[]`
- [ ] **Step 2:** Rodar → falha.
- [ ] **Step 3:** Implementar `lib/home/greeting.ts` (Intl.DateTimeFormat com `timeZone: "America/Sao_Paulo"`).
- [ ] **Step 4:** Teste passa.
- [ ] **Step 5:** Reescrever `app/intranet/page.tsx` conforme spec (Etapa 1): em `Promise.all` — destaque (`news` published com `cover_url` não nulo, mais recente; fallback mais recente sem capa), eventos (3), treinamentos pendentes (lógica atual), perfis ativos com `birth_date` (service client; erro → `[]`), contagem de tickets do usuário com status em aberto (`requester_id = profile.id`, `.not("status","in",'("resolved","closed","cancelled")')`, `count: "exact", head: true`). Montar: saudação → `HeroNews` → grid 3 cartões → `NewsFeed excludeId` (2/3) + treinamentos (1/3). Remove banner preto e os 4 atalhos coloridos.
- [ ] **Step 6:** tsc + lint limpos.
- [ ] **Step 7:** Commit `feat(inicio): nova página inicial no estilo A2`.

### Task 8: Verificação final

- [ ] **Step 1:** `npm run build` → exit 0.
- [ ] **Step 2:** Rodar `next start`, entrar com sessão real (cookie `sb-<ref>-auth-token`) e capturar via Chrome headless: `/login`, `/intranet` (desktop 1440px e mobile 390px), `/intranet/chamados`, `/admin/chamados`, menu recolhido e expandido, busca com "ti" aberta. Conferir visualmente contra o mockup A2.
- [ ] **Step 3:** Corrigir o que destoar; commit.
