# Redesenho Etapa 2 — Notícias e Eventos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar lista/abertura de Notícias e de Eventos no estilo A2, sem cortar cartazes, mantendo intacta a lógica atual de inscrição, fila, leituras, curtidas e comentários.

**Architecture:** Regras puras (datas relativas, tempo de leitura, agrupamento por mês, ranking de leituras, arquivo `.ics`) em `lib/` com testes node. Peças visuais compartilhadas (`CoverImage`, `DateBlock`) em `components/ui-her/`. As telas são reestilizadas no lugar, preservando handlers e chamadas de API existentes.

**Tech Stack:** Next.js 14 App Router, Tailwind v4 (tokens em `app/globals.css`), Supabase, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-11-redesign-etapa-2-noticias-eventos-design.md`

## Global Constraints

- Nenhuma dependência nova; nenhuma migração.
- Datas sempre em `America/Sao_Paulo`.
- Arquivos do repo são CRLF; preservar (editar via Edit ou script que normaliza `\r\n`; arquivo novo: `sed -i 's/$/\r/'`).
- Permissões só por `canEditMenuItem` (servidor) / `useMenuPermission` (cliente); nada novo de RLS.
- Textos de interface exatos: "Mais lidas", "Próximos eventos", "Mais notícias", "PRÓXIMO EVENTO", "Minhas inscrições", "Anteriores", "Evento encerrado", "Você participou", "Adicionar à minha agenda", "N inscritos", "N min de leitura", "Ampliar", "hoje", "amanhã", "em N dias".
- Teste: `node --experimental-strip-types --no-warnings scripts/tests/<nome>.test.mts`; checagem geral: `npx tsc --noEmit -p .`, `npx next lint`, `npm run build`.
- Trabalho no branch `redesign-etapa-2` (criado a partir de `main`); merge/push só com confirmação do usuário.

## Review Focus

- Evento com `max_slots` 0/nulo ou `slots_used` > `max_slots`: barra de vagas não pode estourar nem dividir por zero; sem limite → sem barra.
- Notícia sem capa, evento sem capa, cartaz muito alto ou URL de imagem quebrada: nada cortado, nenhum buraco preto gigante.
- Evento hoje às 23h visto às 22h e evento meia-noite: "hoje"/"amanhã" calculados pelo dia de São Paulo, não por diferença de 24h (teste em Task 1).
- Título/descrição com vírgula, ponto e vírgula, quebra de linha ou acento no `.ics`: escapados conforme RFC 5545, linhas terminadas em CRLF (teste em Task 2).
- Usuário comum abrindo evento: não vê nomes de inscritos nem chama `/participantes` (o componente só chama com `isOrganizer`).

---

### Task 1: Regras puras de datas, leitura e ranking

**Files:**
- Create: `lib/eventos/dates.ts`, `lib/news/reading.ts`
- Test: `scripts/tests/eventos-dates.test.mts`, `scripts/tests/news-reading.test.mts`

**Interfaces:**
- Produces:
  - `relativeDaysLabel(eventIso: string, now: Date): string | null` → `"hoje" | "amanhã" | "em N dias"` para 0..30 dias de calendário em SP; `null` se passado ou > 30.
  - `groupByMonth<T extends { event_date: string }>(items: T[]): { key: string; label: string; items: T[] }[]`; `key` = `"2026-11"`, `label` = `"novembro"` (ou `"novembro de 2027"` quando o ano difere do primeiro item), mantendo a ordem de entrada.
  - `readingMinutes(html: string | null): number`: remove tags, conta palavras, `Math.max(1, Math.ceil(palavras/200))`.
  - `topRead(reads: { news_id: string }[], max: number, minItems: number): { news_id: string; count: number }[]`: conta, ordena desc (empate: ordem da primeira aparição), corta em `max`; devolve `[]` se o resultado tiver menos que `minItems`.

- [ ] **Step 1: Escrever os testes**

```ts
// eventos-dates.test.mts
const now = new Date("2026-11-11T15:00:00Z"); // 12h SP
assert.equal(relativeDaysLabel("2026-11-12T01:30:00Z", now), "hoje");    // 22h30 SP do dia 11
assert.equal(relativeDaysLabel("2026-11-12T03:30:00Z", now), "amanhã");  // 00h30 SP do dia 12
assert.equal(relativeDaysLabel("2026-11-14T17:00:00Z", now), "em 3 dias");
assert.equal(relativeDaysLabel("2026-12-11T17:00:00Z", now), "em 30 dias");
assert.equal(relativeDaysLabel("2026-12-12T17:00:00Z", now), null);
assert.equal(relativeDaysLabel("2026-11-10T17:00:00Z", now), null);
const g = groupByMonth([{ event_date: "2026-11-14T17:00:00Z" }, { event_date: "2026-11-21T13:00:00Z" }, { event_date: "2026-12-18T22:00:00Z" }, { event_date: "2027-01-05T13:00:00Z" }]);
assert.deepEqual(g.map(x => [x.key, x.label, x.items.length]), [["2026-11","novembro",2],["2026-12","dezembro",1],["2027-01","janeiro de 2027",1]]);
assert.equal(groupByMonth([{ event_date: "2026-12-01T02:00:00Z" }])[0].key, "2026-11"); // 23h SP de 30/11

// news-reading.test.mts
assert.equal(readingMinutes(null), 1);
assert.equal(readingMinutes("<p>" + "palavra ".repeat(401) + "</p>"), 3);
assert.equal(readingMinutes("<p>um<br>dois</p>"), 1);
assert.deepEqual(topRead([{news_id:"a"},{news_id:"b"},{news_id:"b"},{news_id:"c"}], 2, 2), [{news_id:"b",count:2},{news_id:"a",count:1}]);
assert.deepEqual(topRead([{news_id:"a"}], 5, 2), []);
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: erro de módulo não encontrado.
- [ ] **Step 3: Implementar** os quatro, seguindo o padrão `Intl.DateTimeFormat` com `timeZone` de `lib/home/greeting.ts` (dia de calendário SP via `formatToParts`).
- [ ] **Step 4: Rodar os dois testes** — Expected: saem sem erro (exit 0).
- [ ] **Step 5: Commit** `feat(etapa2): regras de datas relativas, leitura e ranking`

### Task 2: Arquivo `.ics` e rota de download

**Files:**
- Create: `lib/eventos/ics.ts`, `app/api/eventos/[id]/ics/route.ts`
- Test: `scripts/tests/eventos-ics.test.mts`

**Interfaces:**
- Produces: `buildIcs(ev: { id: string; title: string; description: string | null; location: string | null; meeting_link: string | null; event_date: string }, url: string, now: Date): string`.
  - VCALENDAR/VEVENT com `UID:<id>@intranet-her`, `DTSTAMP` = now, `DTSTART` = event_date, `DTEND` = +1h (UTC, formato `YYYYMMDDTHHMMSSZ`), `SUMMARY`, `LOCATION` (local ou o link), `DESCRIPTION` (descrição + link da reunião + url), `URL`.
  - Escape RFC 5545: `\` → `\\`, `;` → `\;`, `,` → `\,`, quebra → `\n`. Linhas unidas por `\r\n`.
- Rota `GET`: `requireStaff()`; busca o evento `active=true` com service client; 404 se não existir; responde `text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="evento.ics"`; `url` = `${req.nextUrl.origin}/intranet/eventos/${id}`.

- [ ] **Step 1: Testes**

```ts
const ics = buildIcs({ id: "e1", title: "NR-32, módulo 1; parte A", description: "Linha 1\nLinha 2", location: "Auditório", meeting_link: null, event_date: "2026-11-14T17:00:00Z" }, "https://x/intranet/eventos/e1", new Date("2026-11-11T15:00:00Z"));
assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
assert.ok(ics.includes("\r\nDTSTART:20261114T170000Z\r\n"));
assert.ok(ics.includes("\r\nDTEND:20261114T180000Z\r\n"));
assert.ok(ics.includes("SUMMARY:NR-32\\, módulo 1\\; parte A"));
assert.ok(ics.includes("DESCRIPTION:Linha 1\\nLinha 2"));
assert.ok(ics.includes("UID:e1@intranet-her"));
assert.ok(!/[^\r]\n/.test(ics));
assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
```

- [ ] **Step 2: Ver falhar.** **Step 3: Implementar.** **Step 4: Ver passar.**
- [ ] **Step 5:** `npx tsc --noEmit -p .` limpo. Commit `feat(eventos): adicionar a agenda (.ics)`

### Task 3: Peças visuais compartilhadas + destaque da página inicial

**Files:**
- Create: `components/ui-her/CoverImage.tsx`, `components/ui-her/DateBlock.tsx`
- Modify: `components/home/UpcomingEventsCard.tsx` (usar `DateBlock`), `components/home/HeroNews.tsx` (usar `CoverImage`)

**Interfaces:**
- Produces:
  - `CoverImage({ src, alt, className, zoomable }: { src: string; alt: string; className?: string; zoomable?: boolean })`, client component.
    - Contêiner `relative overflow-hidden bg-slate-900` com altura dada por `className`.
    - Fundo: a mesma imagem `absolute inset-0 h-full w-full object-cover scale-110 blur-2xl brightness-75`, `aria-hidden`.
    - Frente: `relative mx-auto h-full w-full object-contain`.
    - `zoomable` mostra o selo "⤢ Ampliar" (canto inferior direito) e abre o mesmo overlay do `ImageLightbox`. Reaproveitar: extrair o overlay de `ImageLightbox` para um export `LightboxOverlay({ src, alt, onClose })` no mesmo arquivo e usá-lo nos dois.
    - `onError` da imagem → o componente não renderiza nada.
  - `DateBlock({ iso, size }: { iso: string; size?: "sm" | "md" })`: o bloco hoje inline no `UpcomingEventsCard` (dia 2 dígitos + mês curto sem ponto, SP). `md` é maior, para a agenda de eventos.
- `HeroNews` com capa: `CoverImage` ocupando a área (h-56 md:h-72) com o degradê e o texto por cima como hoje. O cartaz aparece inteiro no centro, com o fundo desfocado nas laterais.

- [ ] **Step 1:** Implementar `DateBlock` e trocar no `UpcomingEventsCard`. `npx tsc --noEmit -p .` limpo.
- [ ] **Step 2:** Implementar `CoverImage` + `LightboxOverlay`; `HeroNews` passa a usá-lo.
- [ ] **Step 3: Verificação visual:** `npm run build && npx next start -p 3124`, captura da página inicial com `scratchpad/shots.mjs`. Expected: cartaz "Aniversariantes do Mês" inteiro (topo e base visíveis) no destaque.
- [ ] **Step 4:** `npx next lint` limpo. Commit `feat(ui): imagem de capa sem corte e bloco de data compartilhados`

### Task 4: Lista de Notícias (linha do tempo)

**Files:**
- Modify: `app/intranet/noticias/page.tsx`, `components/news/NewsFeed.tsx`
- Create: `components/news/NewsSidebar.tsx` (server component)

**Interfaces:**
- Consumes: `CoverImage`, `DateBlock` (via `UpcomingEventsCard`), `topRead` (Task 1).
- Produces: `NewsSidebar()`, async server component que renderiza "Mais lidas" e "Próximos eventos". Só a lista usa.

Passos:
- [ ] **Step 1:** `NewsSidebar` com service client:
  - "Mais lidas": notícias `status='published'` com `published_at` ≥ agora − 60 dias (id, title); depois `news_reads` (news_id) `in` esses ids; `topRead(reads, 5, 2)`; lista com título e "N leituras".
  - "Próximos eventos": 3 eventos `active`, `event_date ≥ agora`, renderizados com `UpcomingEventsCard`.
  - Cada bloco num `try/catch` próprio; se der erro ou vier vazio, o bloco não aparece.
- [ ] **Step 2:** `noticias/page.tsx`:
  - layout `lg:grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6`;
  - cabeçalho (título "Notícias", "+ Nova notícia" para quem edita), busca, chips e abas como hoje, com os tokens novos (chip ativo `bg-accent text-primary border-primary/30`);
  - `NewsSidebar` em `hidden lg:block`, envolvido em `<Suspense fallback={null}>`.
- [ ] **Step 3:** `NewsFeed`: mantém props, IntersectionObserver, "Ver mais", NOVO e `NewsInteractions`. Troca só a apresentação do cartão:
  - `rounded-xl border bg-card`;
  - cabeçalho com avatar `bg-primary text-white`, autor, data e chip;
  - capa com `CoverImage` (`h-72 md:h-96`, `zoomable`);
  - título como `Link` para `/intranet/noticias/[id]`;
  - chip de categoria único `bg-accent text-primary` (remove `CATEGORY_COLORS`).
- [ ] **Step 4:** `npx tsc --noEmit -p .`, `npx next lint` limpos; build; captura de `/intranet/noticias` (desktop e mobile) com `shots-e2.mjs`. Expected: cartaz inteiro, coluna lateral no desktop e ausente no mobile, curtir/comentar funcionando.
- [ ] **Step 5:** Commit `feat(noticias): lista em linha do tempo com mais lidas`

### Task 5: Notícia aberta

**Files:**
- Modify: `app/intranet/noticias/[id]/page.tsx`, `components/news/NewsInteractions.tsx`

**Interfaces:**
- Consumes: `CoverImage`, `readingMinutes`.
- Produces: `NewsInteractions` ganha a prop opcional `defaultShowComments?: boolean` (padrão `false`). Quando `true`, começa com os comentários abertos e já carregados.

- [ ] **Step 1:** `NewsInteractions`: inicializar `showComments` com a prop e carregar os comentários no mount quando ela for `true`.
- [ ] **Step 2:** Página:
  - grid `lg:grid-cols-[minmax(0,1fr)_280px]`;
  - topo com "← Notícias" e, à direita, "👁 N leram" (para todos; abre `LeitoresDialog` só para quem já abre hoje; para os demais é texto) + Editar/Excluir com as permissões atuais;
  - cartão com chip, título `text-2xl md:text-3xl font-bold`, avatar + autor + data por extenso + "N min de leitura";
  - `CoverImage` (`h-80 md:h-[28rem]`, `zoomable`) no lugar da faixa cortada;
  - corpo (`dangerouslySetInnerHTML` como hoje);
  - `NewsInteractions defaultShowComments`;
  - lateral "Mais notícias": 4 publicadas mais recentes com id ≠ atual (título + data), em `hidden lg:block`;
  - `MarcarLida` mantido.
- [ ] **Step 3:** tsc/lint limpos; captura da notícia aberta. Expected: cartaz inteiro, comentários visíveis sem clique.
- [ ] **Step 4:** Commit `feat(noticias): nova tela da notícia aberta`

### Task 6: Lista de Eventos (destaque + agenda)

**Files:**
- Modify: `app/intranet/eventos/page.tsx`
- Create: `components/eventos/EventHighlight.tsx`, `components/eventos/EventAgendaRow.tsx`, `components/eventos/SlotsBar.tsx`

**Interfaces:**
- Consumes: `CoverImage`, `DateBlock`, `relativeDaysLabel`, `groupByMonth`. Formato de evento retornado por `GET /api/eventos` (com `is_registered`, `on_waitlist`).
- Produces: `SlotsBar({ used, max }: { used: number; max: number | null })`. Não renderiza se `!max`. Largura = `min(100, used/max*100)%`. Texto "N de M vagas".
- `EventHighlight` e `EventAgendaRow` recebem o evento e um callback `onToggle(ev)`, que é o handler de inscrição já existente na página. Não criar outro.

- [ ] **Step 1:** Rótulos das abas: "Próximos", "Calendário", "Minhas inscrições", "Anteriores". Os valores internos (`upcoming|calendar|mine|past`) não mudam.
- [ ] **Step 2:** Na aba "Próximos" sem filtro de categoria ativo:
  - o primeiro evento vira `EventHighlight`: cartão horizontal (empilha no mobile) com `CoverImage` à esquerda (sem capa: fundo `bg-accent` com ícone `CalendarDays`), "PRÓXIMO EVENTO · {relativeDaysLabel}" (omitir o sufixo se `null`), título, data por extenso + hora + local/"Online", `SlotsBar` e botão;
  - os demais vão para a agenda.
  - Com filtro de categoria ou em outras abas: só a agenda.
- [ ] **Step 3:** Agenda: `groupByMonth` → cabeçalho do mês em caixa alta (`text-xs font-bold tracking-wider text-slate-400`) + `EventAgendaRow`.
  - A linha é `Link` para o evento, com `DateBlock md`, chip de categoria, "hora · local", título e `SlotsBar`.
  - Estado à direita: "Inscrever-se" (botão; `e.preventDefault(); e.stopPropagation()` antes do handler), "✓ Inscrito", "Na fila", "Lotado", "Encerrado" (data passada).
  - Na aba "Anteriores" e em "Minhas inscrições" com eventos passados: "Encerrado" ou "Você participou".
- [ ] **Step 4:** Aba Calendário mantém `EventCalendar`. Estados vazios por aba: "Nenhum evento programado.", "Você ainda não se inscreveu em nenhum evento.", "Nenhum evento anterior."
- [ ] **Step 5:** tsc/lint/build limpos. Captura de `/intranet/eventos`. A tabela `events` está vazia (o banco é o de produção), então a captura mostra o estado vazio. A verificação do destaque e da agenda com dados depende de um evento de teste, que só é criado com autorização do usuário. Sem autorização, registrar no ledger que ficou pendente.
- [ ] **Step 6:** Commit `feat(eventos): lista com destaque do proximo evento e agenda`

### Task 7: Evento aberto

**Files:**
- Modify: `app/intranet/eventos/[id]/page.tsx`, `app/intranet/eventos/[id]/EventoDetailClient.tsx`

**Interfaces:**
- Consumes: `CoverImage`, `SlotsBar`, `relativeDaysLabel`, rota `/api/eventos/[id]/ics` (Task 2).
- `EventoDetailClient` continua com as mesmas props e a mesma lógica de inscrição, fila, participantes e check-in. Muda só onde e como aparece.

- [ ] **Step 1:** `page.tsx`:
  - grid `lg:grid-cols-[minmax(0,1fr)_320px] gap-6`;
  - coluna principal: "← Eventos", `CoverImage` (`h-72 md:h-96`, `zoomable`), chip da categoria + "Obrigatório" se `is_mandatory`, título, "Sobre o evento" (descrição `whitespace-pre-line`);
  - coluna lateral `lg:sticky lg:top-4`, que no mobile fica logo após a capa (ordem via `order-*`), com:
    - "EM N DIAS" (`relativeDaysLabel` em maiúsculas; omitido se `null`);
    - linhas com ícone para data/hora, local ou "Online" + link da reunião (como hoje, para todos), "Inscrições até";
    - "N inscritos" (de `slots_used`);
    - o `EventoDetailClient`;
    - para eventos futuros, o link "Adicionar à minha agenda" (`href="/api/eventos/{id}/ics"`).
  - O botão "Editar" para quem pode continua no topo.
- [ ] **Step 2:** `EventoDetailClient`:
  - botão principal largo `w-full`;
  - `SlotsBar` acima dele;
  - estados: Inscrever-se / Cancelar inscrição / Entrar na fila / Sair da fila / "Inscrições encerradas";
  - quando `is_past`: sem botão, texto "Evento encerrado" e, se `reg`, o selo verde "Você participou";
  - a lista de participantes/fila/Exportar continua só quando `isOrganizer`, num cartão abaixo do quadro.
- [ ] **Step 3:** tsc/lint/build limpos. Conferir com `curl -s -o /dev/null -w "%{http_code}"` que `/api/eventos/<uuid-inexistente>/ics` com cookie devolve 404 e sem cookie não devolve 200.
- [ ] **Step 4:** Commit `feat(eventos): nova tela do evento aberto com agenda e encerrado`

### Task 8: Verificação final

- [ ] **Step 1:** Rodar todos os testes `scripts/tests/*.test.mts`, `npx tsc --noEmit -p .`, `npx next lint`, `npm run build`. Expected: tudo limpo.
- [ ] **Step 2:** Capturas desktop e mobile de: início, notícias, notícia aberta, eventos (vazio), evento aberto (se houver evento). Comparar com os mockups `noticias-lista.html` (A), `eventos-lista.html` (C) e `abertas.html`.
- [ ] **Step 3:** Revisão final do branch por subagente; parar o `next start`.
