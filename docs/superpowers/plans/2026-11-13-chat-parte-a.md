# Chat Interno — Parte A (tela nova + privacidade do tempo real + atalhos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever do zero a tela do Chat Interno no estilo A2 com abas (Conversas · Pessoas), busca por nome/setor/ramal, urgente em destaque, atalho "Mandar mensagem" em três telas, e parar de enviar conteúdo de mensagem pelo tempo real — sem migração e sem mudar o que o usuário já faz no chat.

**Architecture:** Regras puras (resumo/ordem de conversas, busca, agrupamento por setor, urgente pendente, formatação, aviso sem conteúdo) em `lib/chat-interno/*.ts` com testes node. O broadcast `message` passa a levar só um aviso; o `ChatProvider` busca a mensagem por uma rota nova que confere a permissão e entrega aos assinantes o mesmo `ChatBroadcastMessage` de hoje. A tela vira uma pasta de componentes pequenos em `app/intranet/chat/`, com `page.tsx` servidor lendo `?com=`.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind v4, Supabase (service role nas rotas, Realtime broadcast/presence), lucide-react, `components/ui/*` (dialog, input, button) e `components/ui-her/*` (Cabecalho, CampoBusca, Chip).

**Spec:** `docs/superpowers/specs/2026-11-13-chat-interno-design.md` (itens 1–6 e 6a; Partes B e C ficam para planos próprios)

## Global Constraints

- Nenhuma dependência nova, nenhuma migração, nenhuma escrita no banco de produção durante a execução (testes e capturas só leem; enviar mensagem de verdade só com autorização do usuário).
- Linhas de `chat_messages` e o comportamento da conversa individual não mudam: anexos (PDF/JPG/PNG/WEBP até 10 MB), urgente só para quem está "Ocupado" com motivo de 5–300 caracteres, ✓/✓✓, "digitando…", polling de 30 s com janela focada, aviso LGPD dispensável (`chat-lgpd-aviso-v1`), "Mensagens são retidas por 30 dias.", "Fora do expediente" 07h–19h, contador do menu, notificação do navegador (urgente sempre; demais com aba oculta ou fora de `/intranet/chat`).
- Nenhum broadcast leva `content`, `attachment_*`, `urgent_reason` nem `sender_name`.
- Datas/horas em `America/Sao_Paulo`.
- Busca sem acento e sem caixa via `normalizarTexto` de `components/corpo-clinico/agenda.ts`.
- Estilo A2 das etapas 0–3: `Cabecalho`, `CampoBusca`, `Chip`; abas no estilo dos chips/underline `border-primary text-primary`; avatar `bg-accent text-primary`; sem emojis decorativos.
- Textos exatos: abas "Conversas" e "Pessoas"; selo "URGENTE"; faixa "Chamada urgente de {primeiro nome}: {motivo}"; vazio de Conversas "Nenhuma conversa ainda. Abra a aba Pessoas para começar."; atalho `aria-label` "Mandar mensagem para {nome}".
- Módulos de `lib/` testados não importam `@/…` nem código de servidor; importam módulos puros por caminho relativo sem extensão; tipos só com `import type`.
- Arquivos do repo são CRLF; preservar ao editar.
- Testes: `node --experimental-strip-types --no-warnings --import ./scripts/tests/ts-resolve.mjs scripts/tests/<nome>.test.mts`; checagem geral: `npx tsc --noEmit -p .`, `npx next lint`, `npm run build`.
- Branch `chat-parte-a` a partir de `main`; merge/push só com confirmação do usuário.

## Rulings já tomados neste plano

- A aba **Grupos** só entra na Parte C: publicar a Parte A com uma aba vazia confundiria. Parte A tem duas abas: Conversas · Pessoas.
- Conversa com alguém que não está mais no diretório (inativo) não aparece em Conversas — é o comportamento de hoje (a lista atual só mostra pessoas do diretório).
- Ao receber o aviso, o contador de não lidas sobe na hora (o aviso tem `sender_id`); a busca da mensagem serve só para a página e a notificação. Se a busca falhar, nada quebra e o polling cobre.

## Review Focus

- Aviso chega e `GET /api/chat-interno/mensagens/<id>` falha (rede, 404, migração 040 pendente): contador sobe, nenhuma exceção, a página recebe a mensagem no próximo polling (teste de `avisoDeMensagem`/`podeVerMensagem` na Task 1; verificação manual na Task 6).
- `?com=` com o próprio id, id inexistente/inativo ou valor repetido (`?com=a&com=b`): ignora sem erro e abre em Conversas (teste de `alvoDoLink` na Task 2).
- Busca "recepçao", "RECEPÇÃO", "4821" e "48": casa por setor sem acento/caixa e por parte do ramal (teste de `filtrarPessoas` na Task 2).
- Urgente recebido, depois eu respondo: faixa some; urgente mais antigo que minha última mensagem não gera faixa; dois urgentes seguidos: vale o mais recente (teste de `urgentePendente` na Task 2).
- Migração 040 ausente (sem coluna `urgent`): `GET /api/chat-interno` continua respondendo, sem urgente (teste de `resumirConversas` com linhas sem `urgent` na Task 2).

---

### Task 1: Tempo real sem conteúdo (aviso + rota de leitura + provider)

**Files:**
- Create: `lib/chat-interno/aviso.ts`
- Create: `app/api/chat-interno/mensagens/[id]/route.ts`
- Modify: `app/api/chat-interno/mensagens/route.ts:241-244` (broadcast)
- Modify: `components/chat/ChatProvider.tsx` (handler do evento `message`)
- Test: `scripts/tests/chat-aviso.test.mts`

**Interfaces:**
- Produces:
  - `interface AvisoMensagem { id: string; sender_id: string; recipient_id: string; created_at: string; urgent: boolean }`
  - `avisoDeMensagem(row: Record<string, unknown>): AvisoMensagem` — só essas cinco chaves; `urgent` = `row.urgent === true`.
  - `podeVerMensagem(row: { sender_id: string; recipient_id: string }, userId: string): boolean`
  - `GET /api/chat-interno/mensagens/[id]` → `200 { message: <colunas completas, ou base se 040 pendente> & { sender_name: string } }` quando `podeVerMensagem`; `404 { error }` caso contrário ou id fora de `SAFE_ID`.
  - `ChatBroadcastMessage` (export existente) inalterado; assinantes de `subscribeMessages` continuam recebendo a mensagem completa.

- [ ] **Step 1: Write the failing test** `scripts/tests/chat-aviso.test.mts`

```ts
const row = { id: "m1", sender_id: "a", recipient_id: "b", content: "senha 123", created_at: "2026-11-13T12:00:00Z",
  read_at: null, attachment_path: "x/y.pdf", attachment_name: "y.pdf", attachment_size: 10, urgent: true,
  urgent_reason: "paciente", sender_name: "Ana" };
assert.deepEqual(avisoDeMensagem(row), { id: "m1", sender_id: "a", recipient_id: "b", created_at: "2026-11-13T12:00:00Z", urgent: true });
assert.equal(avisoDeMensagem({ ...row, urgent: undefined }).urgent, false);
assert.equal(JSON.stringify(avisoDeMensagem(row)).includes("senha"), false);
assert.equal(podeVerMensagem(row, "a"), true);
assert.equal(podeVerMensagem(row, "b"), true);
assert.equal(podeVerMensagem(row, "c"), false);
```

- [ ] **Step 2: Run** `node … scripts/tests/chat-aviso.test.mts` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement `lib/chat-interno/aviso.ts`.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Rota `GET /api/chat-interno/mensagens/[id]`**: `requireStaff`, `createServiceClient`, busca por id com `FULL_COLUMNS` e fallback para `BASE_COLUMNS` em `erroColuna040` (mesmo padrão de `mensagens/route.ts`; extrair as constantes/funções compartilhadas para `lib/chat-interno/colunas.ts` se preferir não duplicar), devolve 404 se não achar ou `!podeVerMensagem`. `sender_name` vem de `profiles.full_name` do remetente.
- [ ] **Step 6: POST de mensagens** envia `broadcastToUser(supabase, to, "message", avisoDeMensagem(message))`.
- [ ] **Step 7: Provider**: no evento `message`, valida o payload como aviso; incrementa `unreadFrom[sender_id]` (exceto conversa ativa) na hora; então `fetch(/api/chat-interno/mensagens/<id>, { cache: "no-store" })` e, com 200, entrega a mensagem completa aos assinantes e decide a notificação como hoje (`fireNotification` usa a mensagem completa). Falha no fetch: só não notifica/entrega; nunca lança. Remover a contagem de dentro de `handleIncoming` para não contar duas vezes.
- [ ] **Step 8: Verificar** `npx tsc --noEmit -p .` — Expected: sem erros.
- [ ] **Step 9: Commit** `feat(chat): tempo real leva só aviso, mensagem vem pela API`

### Task 2: Regras puras da tela

**Files:**
- Create: `lib/chat-interno/tipos.ts`, `lib/chat-interno/conversas.ts`, `lib/chat-interno/formato.ts`
- Modify: `app/api/chat-interno/route.ts` (usar `resumirConversas`; ler `urgent` com fallback 040)
- Test: `scripts/tests/chat-conversas.test.mts`, `scripts/tests/chat-formato.test.mts`

**Interfaces:**
- Consumes: `normalizarTexto` (`../../components/corpo-clinico/agenda`).
- Produces (`tipos.ts`): `Pessoa { id; full_name; sector: string | null; role; phone_ext?: string | null }`, `Mensagem` (= campos de `ChatMessage` da página atual), `Conversa { with: string; last_message: Mensagem; unread: number; urgente: boolean }`, `Status = "disponivel" | "ausente" | "ocupado"`.
- Produces (`conversas.ts`):
  - `resumirConversas(rows: Mensagem[], meuId: string): Conversa[]` — rows em ordem decrescente; uma por interlocutor; `unread` = recebidas sem `read_at`; `urgente` = alguma recebida sem `read_at` com `urgent === true`.
  - `ordenarConversas(lista: Conversa[]): Conversa[]` — `urgente` primeiro, depois `last_message.created_at` desc.
  - `filtrarConversas(lista: Conversa[], pessoas: Map<string, Pessoa>, termo: string): Conversa[]` — descarta interlocutor fora do diretório; termo casa nome.
  - `filtrarPessoas(dir: Pessoa[], termo: string, meuId: string | undefined): Pessoa[]` — sem o próprio; casa nome, setor ou parte do ramal.
  - `agruparPorSetor(pessoas: Pessoa[], online: (id: string) => boolean): { setor: string; membros: Pessoa[]; online: number }[]` — setor vazio → "Sem setor"; setores em ordem pt-BR; online primeiro, depois nome.
  - `urgentePendente(msgs: Mensagem[], meuId: string): Mensagem | null` — último urgente recebido sem nenhuma mensagem minha depois dele.
  - `alvoDoLink(com: string | string[] | undefined, dir: Pessoa[], meuId: string | undefined): Pessoa | null`.
- Produces (`formato.ts`): `formatarHora(iso)`, `chaveDia(iso)`, `formatarDia(iso, agora: Date)` ("Hoje"/"Ontem"/dd/mm/aaaa), `formatarBytes(n)`, `ehImagem(nome)`, `foraDoExpediente(agora: Date)` (hora SP `< 7 || >= 19`), `juntarMensagens(a, b)`, `iniciais(nome)` — todas em fuso `America/Sao_Paulo`.

- [ ] **Step 1: Write the failing tests** — em `chat-conversas.test.mts`, no mínimo:

```ts
// resumirConversas: 3 linhas (desc) de/para "x" e 1 de "y"; não lidas contam só recebidas
// urgente: recebida urgent:true sem read_at → true; já lida → false; linha sem campo urgent (040) → false
// ordenarConversas: [b(13:00), a(12:00, urgente), c(14:00)] → [a, c, b]
// filtrarConversas: interlocutor "z" fora do Map some
// filtrarPessoas: setor "Recepção" casa "recepçao" e "RECEPÇÃO"; ramal "4821" casa "48"; o próprio nunca aparece
// agruparPorSetor: sector null e "  " → "Sem setor"; online antes de offline
// urgentePendente: [urg de x 10:00, minha 10:05] → null; [minha 09:00, urg x 10:00, urg x 10:10] → o de 10:10
// alvoDoLink: meu id → null; id desconhecido → null; ["a","b"] → pessoa "a"; undefined → null
```

  e em `chat-formato.test.mts`: `foraDoExpediente(new Date("2026-11-13T09:59:00Z"))` → `true` (06:59 SP); `…T10:00:00Z` → `false`; `…T22:00:00Z` → `true` (19:00 SP); `formatarDia` de hoje/ontem/antes; `formatarBytes(1536)` → `"2 KB"`; `iniciais("Ana Maria Souza")` → `"AS"`.

- [ ] **Step 2: Run** ambos — Expected: FAIL (módulos não existem).
- [ ] **Step 3: Implement** `tipos.ts`, `conversas.ts`, `formato.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: `GET /api/chat-interno`** passa a selecionar também `urgent` (fallback sem ela em `erroColuna040`) e devolver `conversations: resumirConversas(...)`. Resposta mantém `me`, `directory`, `pending_migration`.
- [ ] **Step 6: Verificar** `npx tsc --noEmit -p .` — Expected: sem erros.
- [ ] **Step 7: Commit** `feat(chat): regras puras de conversas, busca e formato`

### Task 3: Painel da conversa

**Files (todos em `app/intranet/chat/`):**
- Create: `ListaMensagens.tsx` (memo; balões, separador de dia, anexo imagem/arquivo, selo URGENTE + "Motivo:", ✓/✓✓)
- Create: `CampoMensagem.tsx` (rascunho **local** ao componente, anexo pendente com validação de tipo/tamanho, Enter envia e Shift+Enter quebra, bloqueio "Ocupado" + botão "Chamar mesmo assim (urgente)", aviso fora do expediente, erro de envio, "Mensagens são retidas por 30 dias.")
- Create: `DialogoUrgente.tsx` (usa `components/ui/dialog`; motivo 5–300)
- Create: `CabecalhoConversa.tsx` (voltar no celular, avatar com bolinha, nome, setor · status ou "digitando…", ramal grande `text-primary` com ligar `tel:` e copiar)
- Create: `FaixaUrgente.tsx` (texto exato da faixa, botão fechar)
- Create: `PainelConversa.tsx` (carrega/pagina mensagens 50 a 50, "Carregar mensagens anteriores", marca lida, assina mensagens/leituras do provider, canal de digitação, polling 30 s, auto-rolagem, faixa via `urgentePendente` + ids fechados na sessão)

**Interfaces:**
- Consumes: Task 2 (`Pessoa`, `Mensagem`, `urgentePendente`, `formato.ts`), `useChatContext`.
- Produces: `PainelConversa({ pessoa: Pessoa; me: Pessoa; status: Status | null; foraExpediente: boolean; pending040: boolean; onVoltar: () => void; onEnviada: (m: Mensagem) => void; onMigracao: (p: { pending_migration?: boolean; pending_migration_040?: boolean }) => void })`. Chamadas de API idênticas às de hoje (`/api/chat-interno/mensagens`, `/anexos`, `/lidas`).

- [ ] **Step 1: Write** os componentes, levando a lógica da página atual sem mudar regras (o rascunho sai do topo para dentro de `CampoMensagem`, o que dispensa memo nas listas para digitação).
- [ ] **Step 2: Verificar** `npx tsc --noEmit -p .` e `npx next lint --file` nos arquivos novos — Expected: sem erros.
- [ ] **Step 3: Commit** `feat(chat): painel da conversa reescrito`

### Task 4: Coluna esquerda, página e remoção da tela antiga

**Files (em `app/intranet/chat/`):**
- Create: `SeletorStatus.tsx` (botão compacto com bolinha + rótulo, menu com os três status)
- Create: `ColunaEsquerda.tsx` (abas Conversas/Pessoas com contador de não lidas na aba Conversas; `CampoBusca` "Buscar pessoa, setor ou ramal..." em Pessoas e "Buscar conversa..." em Conversas; aba lembrada em `chat-aba-v1`)
- Create: `ListaConversas.tsx` (itens de `ordenarConversas(filtrarConversas(...))`; urgente com `bg-red-50` e selo "URGENTE"; prévia "Você: " / "📎 nome" como hoje; hora curta; contador vermelho)
- Create: `ListaPessoas.tsx` (setores recolhíveis lembrados em `chat-setores-recolhidos-v1`, "x/y online", "Fora do expediente" sob o nome quando offline fora do horário)
- Create: `ChatTela.tsx` (carga `/api/chat-interno`, sincroniza contadores com o provider, avisos de migração 039/040, aviso LGPD, layout de duas colunas no `md+`, tela cheia no celular, abre `alvoDoLink(initialCom, …)` uma vez quando o diretório chega)
- Modify: `page.tsx` → componente servidor: `export default function Page({ searchParams }: { searchParams: { com?: string | string[] } })` renderiza `<ChatTela initialCom={searchParams.com} />`
- Test: `scripts/tests/chat-conversas.test.mts` já cobre as regras; nada novo aqui.

**Interfaces:**
- Consumes: Tasks 2 e 3.
- Produces: rota `/intranet/chat?com=<profileId>` abre a conversa da pessoa.

- [ ] **Step 1: Write** os componentes e o novo `page.tsx`; apagar o conteúdo antigo (nenhum outro arquivo importa de `app/intranet/chat/page.tsx` — confirmar com grep).
- [ ] **Step 2: Verificar** `npx tsc --noEmit -p .`, `npx next lint` — Expected: sem erros novos.
- [ ] **Step 3: Verificar no navegador** (`npm run build` + `npx next start -p 3124`, login admin, Chrome headless pelos scripts do scratchpad): desktop e celular (390 px) nas duas abas, busca "recep", conversa aberta, `?com=<id de um colaborador>`; nenhum erro no console. Sem enviar mensagem.
- [ ] **Step 4: Commit** `feat(chat): abas Conversas e Pessoas, busca e status compacto`

### Task 5: Atalho "Mandar mensagem"

**Files:**
- Create: `lib/chat-interno/link.ts`, `components/chat/BotaoMensagem.tsx`
- Modify: `components/home/BirthdaysCard.tsx` (+ prop `meuId: string`), `app/intranet/page.tsx` (passa `profile.id`)
- Modify: `app/intranet/noticias/[id]/page.tsx` (botão ao lado do nome do autor quando `news.author_id !== profile.id`)
- Modify: `app/intranet/eventos/[id]/EventoDetailClient.tsx` (botão na linha do participante e da lista de espera, exceto `userId`)
- Test: `scripts/tests/chat-link.test.mts`

**Interfaces:**
- Produces: `linkConversa(profileId: string): string` → `/intranet/chat?com=<encodeURIComponent(id)>`; `BotaoMensagem({ profileId, nome, meuId }: …)` renderiza `null` quando `profileId === meuId`; ícone `MessageCircle` 14 px, `aria-label`/`title` "Mandar mensagem para {nome}", `no-print`.

- [ ] **Step 1: Write the failing test**: `linkConversa("abc")` → `"/intranet/chat?com=abc"`; `linkConversa("a b")` → `"/intranet/chat?com=a%20b"`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `link.ts`, `BotaoMensagem.tsx` e os três pontos de uso.
- [ ] **Step 4: Run** — Expected: PASS; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 5: Commit** `feat(chat): atalho Mandar mensagem no Início, notícia e evento`

### Task 6: Verificação final

- [ ] **Step 1:** todos os testes de `scripts/tests/` — Expected: todos PASS.
- [ ] **Step 2:** `npx tsc --noEmit -p .`, `npx next lint`, `npm run build` — Expected: limpos (avisos só em arquivos antigos).
- [ ] **Step 3:** capturas desktop/celular do chat e dos três atalhos (clicar abre a conversa certa); console sem erros.
- [ ] **Step 4:** checar no código que nenhum `broadcastToUser`/`send` leva `content`, `attachment_*`, `urgent_reason` ou `sender_name` (`grep`).
- [ ] **Step 5:** o envio real (ponta a ponta com dois usuários) grava no banco de produção: **pedir autorização ao usuário** ou deixar para ele testar após o deploy; registrar qual foi.
