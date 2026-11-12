# Redesenho — Etapa 2: Notícias e Eventos

Continuação de `docs/superpowers/specs/2026-11-11-redesign-visual-design.md` (direção A2, etapas 0 e 1 já no ar). Esta etapa redesenha quatro telas: lista de Notícias, notícia aberta, lista de Eventos e evento aberto. Também corrige o corte do cartaz no destaque da página inicial.

## Por quê

O usuário acha a intranet "muito comum, layout muito básico". Além disso, a comunicação publica **cartazes verticais (artes)** e **fotos horizontais**. Hoje as telas cortam o cartaz em faixa (notícia aberta, destaque da página inicial), e a informação dele se perde. Notícias e Eventos são o que o funcionário mais abre, depois da página inicial.

## Objetivos

- As quatro telas seguem o estilo A2 já usado na página inicial: tokens do `:root`, cartões brancos com borda `border`, `rounded-xl`, primária `#1f3b9c`, destaque `bg-accent`.
- **Nenhuma imagem de capa é cortada.** Cartaz vertical aparece inteiro, sobre um fundo desfocado da própria imagem. Foto horizontal preenche a largura. Vale para lista, notícia aberta, evento aberto e o destaque da página inicial (`components/home/HeroNews.tsx`).
- A lista de Notícias vira **linha do tempo** (opção A escolhida):
  - coluna central com os cartões;
  - coluna lateral com "Mais lidas" e "Próximos eventos".
- A lista de Eventos vira **destaque + agenda** (opção C escolhida):
  - o próximo evento grande, com "em N dias";
  - os demais em lista de agenda com bloco de data.
- A notícia aberta e o evento aberto seguem o mockup aprovado (`abertas.html` no visual companion). As decisões estão abaixo.

## Fora do escopo (não-objetivos)

- Trocar a lógica de inscrição, fila de espera, check-in, calendário, comentários, curtidas, leituras ou permissões. Elas continuam como estão; muda só a apresentação.
- Passar a lista de Eventos para Server Component. Foi considerado e descartado, ver "Abordagens".
- Editor de notícia/evento (`EventForm`, telas `nova`/`editar`). Recebe só os tokens globais que já pegou.
- Ponto, Qualidade e as etapas 3 a 7.
- Banco de dados: **nenhuma migração** nesta etapa.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Um funcionário comum conseguir ver **quem** se inscreveu num evento. A lista de nomes é só de quem pode editar eventos.
- Cartaz cortado ou esticado em qualquer tela.
- Inscrição ou fila de espera parando de funcionar, ou mostrando estado errado (inscrito/não inscrito/na fila/lotado).
- A página ficar visivelmente mais lenta. A coluna lateral não pode travar a lista: se a consulta falhar, o bloco some e a página continua.

## Abordagens consideradas

1. **Redesenhar mantendo a lógica atual. ESCOLHIDA pelo usuário.** Troca o visual e a disposição, extrai peças reaproveitáveis (imagem sem corte, bloco de data, quadro lateral do evento) e acrescenta só o que é novo. Menor risco para inscrições e fila.
2. Redesenhar e mover a lista de Eventos para o servidor. A tela abriria um pouco mais rápido e ficaria no mesmo padrão da página inicial. Em troca, mexe na lógica de abas e inscrição, que hoje funciona, e o trabalho cresce bastante.
3. Só trocar cores e espaçamentos. Não entrega o destaque, o quadro lateral nem "Mais lidas" que o usuário escolheu.

## Como funciona hoje (para quem vai construir)

- `app/intranet/noticias/page.tsx` (Server Component, `revalidate = 60`):
  - busca, chips de categoria, paginação de 10 em 10, abas para quem edita;
  - renderiza `components/news/NewsFeed.tsx`.
- `app/intranet/noticias/[id]/page.tsx` (Server Component) usa:
  - `MarcarLida`;
  - `ImageLightbox` (ampliar imagem);
  - `NewsInteractions` (curtir + comentários, que hoje abrem/fecham por botão; estado `showComments`);
  - `LeitoresDialog` (quem leu);
  - `DeleteNewsButton`.
- `app/intranet/eventos/page.tsx` (Client Component):
  - abas `upcoming | calendar | mine | past`, chips de categoria, `EventCalendar`;
  - busca em `GET /api/eventos?view=…&category=…&month=…`;
  - inscreve via `POST/DELETE /api/eventos/:id/inscrever`.
- `app/intranet/eventos/[id]/page.tsx` (servidor) + `EventoDetailClient.tsx` (cliente):
  - inscrição e fila de espera;
  - para quem pode editar (`isOrganizer = canEditMenuItem("eventos", role)`), a lista de participantes vem de `GET /api/eventos/:id/participantes` (com `?format=csv` para exportar).
- Tabela `events`:
  - `id, title, description, location, event_date, registration_deadline, max_slots, slots_used, active, cover_url, category, type (presencial|online|hibrido), meeting_link, is_mandatory, created_by, created_at`;
  - **não há horário de término**.
- Leituras de notícia ficam em `news_reads`.
- Na página inicial já existem `UpcomingEventsCard` (com bloco de data) e `HeroNews`.

## Decisões de comportamento

### Peças compartilhadas
- **Imagem de capa sem corte** (`CoverImage`):
  - a imagem real fica com `object-contain`, centralizada, sobre uma cópia da mesma imagem com `object-cover`, desfoque forte e escurecida;
  - recebe a altura do contêiner; para foto horizontal, o efeito é preencher normalmente;
  - clique opcional abre o `ImageLightbox` existente;
  - sem imagem: não renderiza nada (lista e notícia) ou um fundo neutro com a cor da categoria (destaque de evento).
- **Bloco de data:** o mesmo visual do `UpcomingEventsCard` (dia grande + mês abreviado em `text-primary` sobre `bg-slate-100`). Deve ser extraído e reaproveitado, não copiado.
- **"em N dias":** texto relativo para o próximo evento e o quadro lateral. Regras:
  - "hoje";
  - "amanhã";
  - "em N dias" até 30;
  - acima de 30 dias, só a data.
  - Calculado em America/Sao_Paulo e testado.

### Lista de Notícias (linha do tempo)
- Cabeçalho com título, botão "+ Nova notícia" (só quem edita), busca e chips de categoria. Mantém as abas atuais de quem edita.
- Cartão: **o mesmo conteúdo e comportamento do `NewsFeed` de hoje**, só com visual novo ("como hoje, uma embaixo da outra", foi o que o usuário escolheu). Conteúdo:
  - autor (avatar com inicial em `bg-primary`), data, chip da categoria;
  - capa com `CoverImage`;
  - título e corpo com "Ver mais";
  - rodapé com curtir, comentar (abre os comentários ali mesmo, via `NewsInteractions`) e número de leituras;
  - o título leva à notícia aberta;
  - **a marcação de "lida" ao aparecer na tela (`IntersectionObserver` a 50%) continua**, assim como o selo NOVO e o `NotificacaoDot`.
- **Número de leituras:** visível para todos, como hoje. Os nomes de quem leu (`LeitoresDialog`) continuam só para quem edita. Vale para a lista, "Mais lidas" e a notícia aberta.
- Coluna lateral (some abaixo de `lg`):
  - **Mais lidas:** as 5 notícias publicadas com mais registros em `news_reads` entre as publicadas nos últimos 60 dias. Cada item com título e número de leituras, e link.
  - **Próximos eventos:** os 3 próximos, reaproveitando o visual do `UpcomingEventsCard`.
  - Cada bloco carrega isolado; se falhar, some.
- Paginação atual mantida.

### Notícia aberta
- Topo: "← Notícias" à esquerda. À direita, "👁 N leram" para todos, que abre `LeitoresDialog` só para quem edita. "Editar" e "Excluir" aparecem só para quem já pode hoje.
- Cartão principal:
  - chip da categoria, título grande;
  - linha com avatar + autor + data por extenso + tempo de leitura ("N min de leitura", 200 palavras/min, mínimo 1);
  - `CoverImage` com "Ampliar";
  - corpo da notícia;
  - curtir e **comentários já abertos** (sem precisar clicar). `NewsInteractions` ganha uma prop para começar aberto, que só esta tela usa.
- Lateral (some abaixo de `lg`): "Mais notícias", as 4 publicadas mais recentes excluindo a atual.
- `MarcarLida` continua funcionando como hoje.

### Lista de Eventos (destaque + agenda)
- Cabeçalho com título e "+ Novo evento" (quem pode).
- **Destaque:** só na aba "Próximos" e só se houver evento futuro.
  - O mais próximo, em cartão horizontal: capa à esquerda (`CoverImage`), à direita "PRÓXIMO EVENTO · em N dias", título, data por extenso + hora + local, barra de vagas (se `max_slots`) e o botão de inscrição com o mesmo comportamento atual.
  - No celular, empilha.
- **Abas renomeadas:** Próximos · Calendário · **Minhas inscrições** (era "Meus eventos") · **Anteriores** (era "Histórico"). Chips de categoria mantidos.
- **Agenda:**
  - os demais eventos da aba agrupados por mês ("NOVEMBRO");
  - cada linha com bloco de data, chip da categoria, hora · local (ou "Online"), título, barra de vagas quando houver limite;
  - à direita, o estado: "Inscrever-se" / "✓ Inscrito" / "Na fila" / "Lotado" / "Encerrado";
  - a linha inteira leva ao evento aberto; o botão não navega.
- Aba Calendário: mantém o `EventCalendar`, com tokens novos.
- Vazio: mensagem amigável por aba.

### Evento aberto
- "← Eventos" no topo.
- Coluna principal: `CoverImage` com "Ampliar", chip da categoria (+ "Obrigatório" se `is_mandatory`), título, "Sobre o evento" com a descrição.
- **Quadro lateral** (fixo ao rolar no desktop; no celular vem logo abaixo da capa):
  - "EM N DIAS";
  - 📅 data por extenso e hora;
  - 📍 local ou "Online" (com o link da reunião visível como hoje, para todos);
  - ⏳ inscrições até (se houver prazo);
  - barra "N de M vagas";
  - botão de ação.
- **Estados do botão** (mesma lógica do `EventoDetailClient` atual):
  - Inscrever-se;
  - Cancelar inscrição;
  - Entrar na fila (lotado);
  - Sair da fila;
  - Inscrições encerradas (prazo vencido);
  - **Evento encerrado** (data passou, sem botão) e, se a pessoa estava inscrita, o selo **"Você participou"**.
- **Adicionar à minha agenda:**
  - link discreto abaixo do botão que baixa um arquivo `.ics`;
  - aparece para eventos futuros;
  - conteúdo: título, início, local, link da reunião (se houver), descrição em texto puro, URL do evento na intranet;
  - Outlook e celulares abrem esse formato.
- **Inscritos:**
  - todos veem só a contagem ("32 inscritos");
  - quem pode editar eventos vê, num cartão abaixo do quadro, a lista de nomes, a fila e o botão "Exportar" (o CSV que já existe), reaproveitando `/api/eventos/:id/participantes`, que já bloqueia os demais com 403.

### Página inicial
- `HeroNews` passa a usar `CoverImage`, e o cartaz não é mais cortado.

## Restrições

- Next.js 14 App Router, Tailwind v4 com os tokens de `app/globals.css`, Supabase. Nada de biblioteca nova. O `.ics` é texto montado à mão.
- Permissões continuam vindo de `canEditMenuItem` / `useMenuPermission`; nada novo de RLS.
- Arquivos do repositório usam CRLF; preservar.
- Testes no padrão do projeto: `node --experimental-strip-types --no-warnings scripts/tests/*.test.mts` para regras puras, mais `npx tsc --noEmit -p .`, `npx next lint`, `npm run build`, e conferência visual por captura.
- Datas e horas sempre em America/Sao_Paulo.

## Decisões minhas (o builder pode seguir; o usuário pode revisar)

- "Mais lidas" = top 5 por leituras entre as publicadas nos últimos 60 dias. Se houver menos de 2, o bloco some. Como a leitura é registrada ao rolar a lista, na prática isso mede "mais vistas". É o mesmo dado do "N leram" de hoje.
- Topo da notícia aberta: "👁 N leram" aparece para todos; o clique que abre os nomes continua só para quem edita.
- Evento sem horário de término: o `.ics` usa **duração de 1 hora**.
- Tempo de leitura: 200 palavras/min, mínimo 1 min.
- "em N dias" até 30 dias; depois só a data.
- O `.ics` é gerado por rota de API (`GET /api/eventos/:id/ics`, exige login), que devolve o arquivo pronto para baixar.

## O que fica para o builder

- Nomes exatos de arquivos e componentes, desde que as peças compartilhadas existam uma vez só.
- Como buscar "Mais lidas" (agregação em JS sobre `news_reads` com service client, ou outra forma equivalente). Uma só ida ao banco por bloco.
- Pequenos ajustes de espaçamento para ficar fiel aos mockups `noticias-lista.html` (A), `eventos-lista.html` (C) e `abertas.html`.
