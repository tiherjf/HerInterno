# Redesenho Etapa 3 — Ramais, Corpo Clínico e Procedimentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever do zero as telas de Ramais, Corpo Clínico e Procedimentos (consulta + janelas de cadastro) no estilo A2, com lista + ficha, filtro de convênio e `?q=` funcionando, sem mudar API nem banco.

**Architecture:** Regras puras (filtros, agrupamentos, valores, payloads de formulário) em `lib/<tela>/` com testes node. Peças compartilhadas (`ListaFicha`, `TagInput`) em `components/ui-her/`. Cada tela vira uma pasta de arquivos pequenos em `app/intranet/<tela>/`; os `page.tsx` continuam carregando os dados no servidor e passam `initialQ` vindo de `searchParams.q`. As views antigas são apagadas ao final de cada tela.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind v4 (tokens em `app/globals.css`), Supabase, lucide-react, componentes de `components/ui/` (dialog, sheet, select, checkbox, input, button…).

**Spec:** `docs/superpowers/specs/2026-11-12-redesign-etapa-3-ramais-corpo-clinico-procedimentos-design.md`

## Global Constraints

- Nenhuma dependência nova, nenhuma migração, nenhuma mudança em `app/api/**` nem em `lib/*/server.ts`.
- Payloads enviados às APIs idênticos aos de hoje (mesmas chaves, mesmos valores para o mesmo formulário).
- Permissões só via `useMenuPermission("ramais" | "corpo-clinico" | "procedimentos").canEdit`.
- Busca sem acento e sem caixa via `normalizarTexto` de `components/corpo-clinico/agenda.ts`.
- Estilo A2: cabeçalho como Notícias (`h1` + contagem cinza + botão primário), chips no estilo de `app/intranet/noticias/page.tsx` (`border-primary/30 bg-accent text-primary font-semibold` quando ativo), sem banners coloridos, sem emojis de unidade/setor, sem cor por unidade.
- Textos exatos: "Convênio não informado — confirmar", "convênio a confirmar", "Atende hoje", "Ainda não liberou horário", "Valores não cadastrados", "Nenhum convênio cadastrado", "Somente particular", "Sem preparo especial", "Sem jejum", "Inativo", "Geral", "Meu ramal", "Favoritos", "N profissionais · M a confirmar".
- Unidades e ordem: Corpo Clínico `Todas, Hospital, Clínica da Criança, Instituto Levy (key "Levy"), Barão, Instituto`; Procedimentos `Todas, Hospital, Clínica da Criança, Instituto Levy, Instituto, Barão`, padrão `Hospital`, com `?q=` abre em `Todas`.
- Arquivos do repo são CRLF; preservar ao editar (Edit, ou script que normaliza `\r\n`); arquivos novos o git converte.
- Testes: `node --experimental-strip-types --no-warnings --import ./scripts/tests/ts-resolve.mjs scripts/tests/<nome>.test.mts`; checagem geral: `npx tsc --noEmit -p .`, `npx next lint`, `npm run build`.
- Módulos de `lib/` testados não importam `@/…` nem nada de servidor; importam outros módulos puros por caminho relativo sem extensão (o hook `ts-resolve.mjs` resolve no teste, o bundler no app); tipos de `server.ts` só com `import type`.
- Branch `redesign-etapa-3` a partir de `main`; nada gravado no banco de produção nos testes; merge/push só com confirmação do usuário.

## Review Focus

- Profissional com `convenios` nulo, `[]` ou `[""]` sob filtro de convênio: vai para "não informado", nunca some nem quebra (teste na Task 2).
- Busca/convênio com acento ou caixa diferente ("UNIMED INTERCÂMBIO" × "intercambio"): casa (testes nas Tasks 1, 2, 4).
- Editar um profissional antigo sem agenda estruturada e salvar sem mexer na agenda: payload mantém `dias`/`horarios` e não envia `agenda: null` (teste na Task 3).
- Lista filtrada em que o item selecionado some: a ficha passa para o primeiro item, ou para o painel vazio — nunca mostra item que não está na lista (teste na Task 5, regra pura `selecaoValida`).
- Ramal "N/A", procedimento sem preço, pacote sem preço unitário: nada de "R$ NaN", nada de copiar "N/A" (testes nas Tasks 1 e 4).

---

### Task 1: Base de testes + regras de Ramais

**Files:**
- Create: `scripts/tests/ts-resolve.mjs`, `lib/ramais/filtro.ts`
- Test: `scripts/tests/ramais-filtro.test.mts`

**Interfaces:**
- Produces:
  - `scripts/tests/ts-resolve.mjs`: usa `module.registerHooks` (Node ≥ 23; local é 26) com um `resolve` que, para especificador relativo sem extensão que falhe, tenta de novo com `.ts`.
  - `filtrarRamais(setores: RamalSetor[], f: { busca: string; setorId: string | null; apenasFavoritos: boolean }): RamalSetor[]` — mantém só setores com ramais restantes; um ramal passa se `numero`, `descricao` **ou o nome do setor** contém a busca normalizada; `setorId` restringe ao setor; `apenasFavoritos` só `favorito`.
  - `temNumero(numero: string): boolean` — `false` para `"N/A"`, vazio ou só espaços.
  - Tipos `RamalSetor`/`RamalItem` via `import type` de `lib/ramais/server`.

- [ ] **Step 1: Criar branch e escrever o teste**

`git checkout -b redesign-etapa-3`. Teste com 2 setores (`"Térreo"` com `4912 Recepção Térreo` favorito e `N/A Portaria`; `"1º Andar"` com `4936 TI (Alexandre)`):

```ts
assert.deepEqual(ids(filtrarRamais(s, { busca: "terreo", setorId: null, apenasFavoritos: false })), ["4912", "N/A"]); // pelo nome do setor, sem acento
assert.deepEqual(ids(filtrarRamais(s, { busca: "RECEPÇÃO", setorId: null, apenasFavoritos: false })), ["4912"]);
assert.deepEqual(ids(filtrarRamais(s, { busca: "49", setorId: null, apenasFavoritos: true })), ["4912"]);
assert.deepEqual(filtrarRamais(s, { busca: "", setorId: s[1].id, apenasFavoritos: false }).map(x => x.name), ["1º Andar"]);
assert.deepEqual(filtrarRamais(s, { busca: "zzz", setorId: null, apenasFavoritos: false }), []);
assert.equal(temNumero("N/A"), false); assert.equal(temNumero(" "), false); assert.equal(temNumero("4912"), true);
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: erro de módulo não encontrado `lib/ramais/filtro`.
- [ ] **Step 3: Implementar `ts-resolve.mjs` e `lib/ramais/filtro.ts`**
- [ ] **Step 4: Rodar e ver passar** — Expected: `ramais-filtro ok`. Rodar também os 9 testes antigos com o `--import` para confirmar que o hook não quebra nada.
- [ ] **Step 5: Commit** — `feat(ramais): regras de filtro com busca pelo setor`

---

### Task 2: Regras de filtro do Corpo Clínico

**Files:**
- Create: `lib/corpo-clinico/types.ts`, `lib/corpo-clinico/filtro.ts`
- Test: `scripts/tests/corpo-clinico-filtro.test.mts`

**Interfaces:**
- Consumes: `normalizarTexto`, `atendeNoDia`, `turnosDe`, `type AgendaEntry`, `type Turno` de `components/corpo-clinico/agenda` (relativo).
- Produces:
  - `lib/corpo-clinico/types.ts`: `export interface Profissional` com exatamente os campos da interface atual em `CorpoClinicoView.tsx:103-122`.
  - `export interface FiltrosCC { busca: string; convenio: string; unidade: string | null; grupo: string | null; hoje: boolean; turnos: Turno[] }`
  - `filtrarProfissionais(lista: Profissional[], f: FiltrosCC, diaSemana: number): { principais: Profissional[]; naoInformado: Profissional[] }` — mantém a ordem de entrada. Busca: os mesmos campos de hoje (nome, especialidade, grupo, dias, horarios, unidade, subespecialidade, local, observacoes, convenios). Convênio vazio → `naoInformado = []`. Convênio preenchido → quem tem algum convênio que contém o termo vai para `principais`; quem tem `convenios` nulo/vazio/só strings vazias vai para `naoInformado`; os demais saem. Unidade, grupo, hoje e turnos (OR entre turnos, como hoje) se aplicam às duas partes.
  - `conveniosQueCasam(p: Profissional, termo: string): string[]` — os convênios do profissional que casam, na ordem original; `[]` com termo vazio.
  - `agruparPorGrupo(lista: Profissional[]): { grupo: string; itens: Profissional[] }[]` — ordem da primeira aparição.
  - `iniciais(nome: string): string` — até 2 letras maiúsculas, ignorando "Dr.", "Dra.", "de", "da", "do", "dos", "das".

- [ ] **Step 1: Escrever o teste**

Fixture: A `{nome:"Dra. Thais Moreira", grupo:"Dermatologia", unidade:"Hospital", convenios:["UNIMED JF","PMMG"], dias:"Seg/Qua", horarios:"08:00 às 12:00"}`, B `{nome:"Dr. Ricardo Campos", grupo:"Dermatologia", unidade:"Hospital", convenios:null, dias:"Seg", horarios:"14:00 às 18:00"}`, C `{nome:"Dra. Ana Lima", grupo:"Pediatria", unidade:"Clínica da Criança", convenios:["UNIMED INTERCÂMBIO"], dias:"Ter", horarios:"08:00 às 11:00"}`, D `{nome:"Dr. Paulo Reis", grupo:"Cardiologia", unidade:"Hospital", convenios:["AMIL"], dias:"Sex", horarios:"08:00 às 12:00"}`, E `{… convenios:[""] …}`. Com `base = {busca:"", convenio:"", unidade:null, grupo:null, hoje:false, turnos:[]}` e `SEG = 1`:

```ts
let r = filtrarProfissionais(L, { ...base, convenio: "unimed" }, SEG);
assert.deepEqual(r.principais.map(p => p.nome), ["Dra. Thais Moreira", "Dra. Ana Lima"]);
assert.deepEqual(r.naoInformado.map(p => p.nome), ["Dr. Ricardo Campos", E.nome]);
r = filtrarProfissionais(L, { ...base, convenio: "intercambio" }, SEG);           // sem acento
assert.deepEqual(r.principais.map(p => p.nome), ["Dra. Ana Lima"]);
r = filtrarProfissionais(L, { ...base, busca: "unimed" }, SEG);                    // busca continua olhando convênios
assert.deepEqual(r.principais.map(p => p.nome), ["Dra. Thais Moreira", "Dra. Ana Lima"]);
assert.deepEqual(r.naoInformado, []);
r = filtrarProfissionais(L, { ...base, convenio: "unimed", unidade: "Hospital", turnos: ["manha"] }, SEG);
assert.deepEqual([r.principais.map(p => p.nome), r.naoInformado.map(p => p.nome)], [["Dra. Thais Moreira"], []]); // B é tarde
r = filtrarProfissionais(L, { ...base, hoje: true }, SEG);
assert.deepEqual(r.principais.map(p => p.nome), ["Dra. Thais Moreira", "Dr. Ricardo Campos"]);
assert.deepEqual(conveniosQueCasam(A, "unimed"), ["UNIMED JF"]);
assert.deepEqual(agruparPorGrupo([A, C, B]).map(g => [g.grupo, g.itens.length]), [["Dermatologia", 2], ["Pediatria", 1]]);
assert.equal(iniciais("Dra. Thais Moreira"), "TM"); assert.equal(iniciais("Dr. Pedro"), "P"); assert.equal(iniciais("João da Silva"), "JS");
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: módulo não encontrado.
- [ ] **Step 3: Implementar `types.ts` e `filtro.ts`**
- [ ] **Step 4: Rodar e ver passar** — Expected: `corpo-clinico-filtro ok`.
- [ ] **Step 5: Commit** — `feat(corpo-clinico): filtro com convenio e nao informado`

---

### Task 3: Formulário do Corpo Clínico (regras)

**Files:**
- Create: `lib/corpo-clinico/form.ts`
- Test: `scripts/tests/corpo-clinico-form.test.mts`

**Interfaces:**
- Consumes: `Profissional` (Task 2), `AgendaEntry`.
- Produces:
  - `export interface FormCC` — os campos de `FormState` atual (`CorpoClinicoView.tsx:217-235`).
  - `FORM_CC_VAZIO: FormCC` — igual a `EMPTY_FORM` atual (unidade `"Clínica da Criança"`).
  - `formDeProfissional(p: Profissional): FormCC` — mesmas regras de `openEdit` atual (uma faixa por dia, primeira; `"—"` vira `""`).
  - `validarFormCC(f: FormCC): string | null` — mensagens atuais: `"Nome, especialidade e grupo são obrigatórios."` e `"Agenda: o horário de início deve ser antes do fim em todos os dias."`.
  - `payloadProfissional(f: FormCC, original: Profissional | undefined): Record<string, unknown>` — exatamente o `body` montado hoje em `save` (`CorpoClinicoView.tsx:395-430`), incluindo `grupo_novo` quando `grupo === "__novo__"`.

- [ ] **Step 1: Escrever o teste**

```ts
const antigo = { ...P, agenda: null, dias: "Seg/Qua", horarios: "08:00 às 12:00", sem_agenda: false };
let body = payloadProfissional(formDeProfissional(antigo), antigo);
assert.equal(body.dias, "Seg/Qua"); assert.equal(body.horarios, "08:00 às 12:00"); assert.ok(!("agenda" in body));
const comAgenda = { ...P, agenda: [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "14:00", fim: "18:00" }] };
const f = formDeProfissional(comAgenda); assert.equal(f.agenda.length, 1);
body = payloadProfissional({ ...f, agenda: [] }, comAgenda); assert.equal(body.agenda, null); assert.equal(body.dias, "—");
body = payloadProfissional({ ...FORM_CC_VAZIO, nome: " X ", especialidade: "Y", grupo: "__novo__", grupo_novo: " Novo ", sem_agenda: true, convenios: [" A ", ""] }, undefined);
assert.deepEqual([body.nome, body.grupo, body.dias, body.horarios, body.convenios, body.unidade], ["X", "Novo", "—", "—", ["A"], "Clínica da Criança"]);
assert.equal(validarFormCC({ ...FORM_CC_VAZIO, nome: "X" }), "Nome, especialidade e grupo são obrigatórios.");
assert.equal(validarFormCC({ ...FORM_CC_VAZIO, nome: "X", especialidade: "Y", grupo: "G", agenda: [{ dia: 1, inicio: "12:00", fim: "08:00" }] }), "Agenda: o horário de início deve ser antes do fim em todos os dias.");
```

- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar `lib/corpo-clinico/form.ts`** (copiar as regras de `openEdit`/`save` atuais para funções puras; não mudar comportamento).
- [ ] **Step 4: Rodar e ver passar** — Expected: `corpo-clinico-form ok`.
- [ ] **Step 5: Commit** — `feat(corpo-clinico): regras puras do formulario`

---

### Task 4: Regras de Procedimentos (filtro, valores, formulário)

**Files:**
- Create: `lib/procedimentos/types.ts`, `lib/procedimentos/filtro.ts`, `lib/procedimentos/valores.ts`, `lib/procedimentos/form.ts`
- Test: `scripts/tests/procedimentos-filtro.test.mts`, `scripts/tests/procedimentos-form.test.mts`

**Interfaces:**
- Produces:
  - `types.ts`: `Procedimento` (campos de `ProcedimentosView.tsx:62-90`), `TipoKey = "exame" | "procedimento"`.
  - `filtro.ts`: `medicosDe(p): string[]` (regra atual); `filtrarProcedimentos(lista, { busca, unidade: string | null, tipo: TipoKey | null, medico: string | null })` (unidade `null` = Todas; busca sem acento em nome, descricao, preparacao, categoria, profissional, médicos); `agruparPorCategoria(lista): { categoria: string | null; itens: Procedimento[] }[]` (regra atual: menor `order_num`, sem categoria por último como `null`); `medicosDaUnidade(lista, unidade: string | null): string[]` (ordenado pt-BR).
  - `valores.ts`: `parcela(p): number | null` (`preco / parcelas_max` só com os dois); `economiaPacote(p): number` (`preco * sessões − pacote_preco`, 0 sem preço ou sem pacote, nunca negativo); `itensPreparo(p): string[]` na ordem "Sem jejum"/"Jejum Nh", "Suspender medicação: …", "Documentos: …", "Requer agendamento", `preparacao`; `textoConvenios(p): string[]` (convênios + "Particular" se `atende_particular`; `["Somente particular"]` quando sem convênios e particular; `[]` se nenhum).
  - `form.ts`: `FormProc`, `FORM_PROC_VAZIO`, `formDeProcedimento(p)`, `payloadProcedimento(f)` idênticos a `EMPTY_FORM`/`openEdit`/`body` atuais (`convenios` e `medicos` como texto separado por vírgula), `validarFormProc(f)` com `"Nome e unidade são obrigatórios."`.

- [ ] **Step 1: Escrever os testes**

```ts
// procedimentos-filtro
assert.deepEqual(medicosDe({ ...P, medicos: null, profissional: "Dra. Thais e Dra. Jessica" }), ["Dra. Thais", "Dra. Jessica"]);
assert.deepEqual(filtrarProcedimentos(L, { busca: "PEELING", unidade: null, tipo: null, medico: null }).map(p => p.nome), ["Peeling facial", "Peeling corporal"]);
assert.deepEqual(filtrarProcedimentos(L, { busca: "", unidade: "Hospital", tipo: "exame", medico: null }), []);
assert.deepEqual(agruparPorCategoria(L).map(g => g.categoria), ["Peeling", "Toxina", null]);
assert.equal(parcela({ ...P, preco: 450, parcelas_max: 3 }), 150); assert.equal(parcela({ ...P, preco: null, parcelas_max: 3 }), null);
assert.equal(economiaPacote({ ...P, preco: 450, pacote_sessoes: 3, pacote_preco: 1200 }), 150);
assert.equal(economiaPacote({ ...P, preco: null, pacote_sessoes: 3, pacote_preco: 1200 }), 0);
assert.deepEqual(itensPreparo({ ...P, jejum_horas: 0, requer_agendamento: true }), ["Sem jejum", "Requer agendamento"]);
assert.deepEqual(itensPreparo(P), []);
assert.deepEqual(textoConvenios({ ...P, convenios: null, atende_particular: true }), ["Somente particular"]);
assert.deepEqual(textoConvenios({ ...P, convenios: ["AMIL"], atende_particular: true }), ["AMIL", "Particular"]);
// procedimentos-form
const b = payloadProcedimento(formDeProcedimento({ ...P, convenios: ["A", "B"], medicos: ["X"], descricao: null }));
assert.deepEqual([b.convenios, b.medicos, b.descricao], ["A, B", "X", null]);
assert.equal(validarFormProc({ ...FORM_PROC_VAZIO, nome: " " }), "Nome e unidade são obrigatórios.");
```

- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar os quatro módulos**
- [ ] **Step 4: Rodar e ver passar** — Expected: `procedimentos-filtro ok`, `procedimentos-form ok`.
- [ ] **Step 5: Commit** — `feat(procedimentos): regras puras de filtro, valores e formulario`

---

### Task 5: Componentes compartilhados `ListaFicha` e `TagInput`

**Files:**
- Create: `lib/ui/selecao.ts`, `lib/ui/tags.ts`, `components/ui-her/ListaFicha.tsx`, `components/ui-her/TagInput.tsx`
- Test: `scripts/tests/ui-selecao-tags.test.mts`

**Interfaces:**
- Produces:
  - `selecaoValida(idsVisiveis: string[], atual: string | null): string | null` — `atual` se está na lista; senão o primeiro; `null` se vazia.
  - `adicionarTags(atuais: string[], texto: string): string[]` — divide `texto` por vírgula, `trim`, ignora vazios e repetidos (comparação sem acento/caixa), mantém ordem.
  - `ListaFicha<T>({ itens: T[]; idDe(t): string; lista: (sel: string | null, selecionar: (id: string) => void) => ReactNode; ficha: (item: T) => ReactNode; vazio: ReactNode })` (client): em `lg+` duas colunas (`lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`), lista com rolagem própria (`lg:max-h-[calc(100vh-14rem)] overflow-y-auto`), ficha `lg:sticky lg:top-4`; seleção mantida com `selecaoValida` a cada mudança de `itens`. Abaixo de `lg`, nada pré-selecionado na tela; tocar abre `Sheet` (lado direito, largura total no celular) com a ficha. Detectar `lg` com `matchMedia("(min-width: 1024px)")`.
  - `TagInput({ value: string[]; onChange(v: string[]): void; sugestoes: string[]; placeholder?: string; id?: string })` (client): chips com ×; Enter ou vírgula adiciona via `adicionarTags`; colar "A, B" adiciona as duas; Backspace com campo vazio remove a última; `datalist` com `sugestoes`.

- [ ] **Step 1: Escrever o teste**

```ts
assert.equal(selecaoValida(["a", "b"], "b"), "b"); assert.equal(selecaoValida(["a", "b"], "z"), "a");
assert.equal(selecaoValida([], "a"), null); assert.equal(selecaoValida(["a"], null), "a");
assert.deepEqual(adicionarTags(["UNIMED JF"], " Amil, unimed jf ,, PMMG"), ["UNIMED JF", "Amil", "PMMG"]);
assert.deepEqual(adicionarTags([], "Saúde Caixa, SAUDE CAIXA"), ["Saúde Caixa"]);
```

- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar `lib/ui/selecao.ts`, `lib/ui/tags.ts` e os dois componentes**
- [ ] **Step 4: Rodar e ver passar; `npx tsc --noEmit -p .` limpo**
- [ ] **Step 5: Commit** — `feat(ui-her): ListaFicha e TagInput`

---

### Task 6: Tela de Ramais reescrita

**Files:**
- Create: `app/intranet/ramais/RamaisTela.tsx` (client, estado e ações), `app/intranet/ramais/SetorCaixa.tsx`, `app/intranet/ramais/RamalLinha.tsx`, `app/intranet/ramais/SetorDialog.tsx`, `app/intranet/ramais/RamalDialog.tsx`
- Modify: `app/intranet/ramais/page.tsx` (recebe `searchParams: { q?: string }`, passa `initialQ`)
- Delete: `app/intranet/ramais/RamaisView.tsx`

**Interfaces:**
- Consumes: `filtrarRamais`, `temNumero` (Task 1); APIs atuais: `GET /api/ramais`, `POST/PATCH/DELETE /api/ramais/setores[/id]`, `/api/ramais/itens[/id]`, `POST/DELETE /api/ramais/favoritos/:id`.
- Produces: `RamaisTela({ initialSetores, initialMeuRamal, initialQ })`.

- [ ] **Step 1: Implementar conforme a seção "Ramais" do spec**
  - Cabeçalho "Ramais", "N setores · M ramais", Imprimir (`window.print()`), "+ Novo setor" (admin).
  - Busca (preenchida com `initialQ`), botão Favoritos, faixa "Meu ramal" com copiar.
  - Caixa "Favoritos" quando há algum; chips de setor sem emoji com contagem.
  - Caixas de setor em `columns-1 lg:columns-2 gap-4`, cada caixa `break-inside-avoid`.
  - Linha: número grande `tabular-nums` (ou "—" sem copiar quando `!temNumero`), descrição inteira, estrela, copiar ("Copiado" por 1,5 s), editar/remover admin (`lg:opacity-0 lg:group-hover:opacity-100`, sempre visível abaixo de `lg`).
  - `SetorDialog`: só nome* e ordem; PATCH/POST enviam `{ name, order_index }`.
  - `RamalDialog`: setor*, número*, descrição*, ordem — payload atual.
  - Remoções com `confirm` e textos atuais.
  - `no-print` em todos os controles.
- [ ] **Step 2: `npx tsc --noEmit -p .`, `npx next lint` limpos; todos os testes passam**
- [ ] **Step 3: Conferência visual** — `npm run build && npx next start -p 3124`; capturas desktop 1440 e celular 390 de `/intranet/ramais` e `/intranet/ramais?q=terreo` (script de capturas do scratchpad, sessão admin). Expected: sem faixas coloridas, nomes em ≤ 2 linhas, `?q=` já filtrado, console sem erros.
- [ ] **Step 4: Commit** — `feat(ramais): tela reescrita no estilo A2`

---

### Task 7: Corpo Clínico — consulta (filtros, lista, ficha)

**Files:**
- Create: `app/intranet/corpo-clinico/CorpoClinicoTela.tsx`, `app/intranet/corpo-clinico/FiltrosCC.tsx`, `app/intranet/corpo-clinico/ListaCC.tsx`, `app/intranet/corpo-clinico/FichaProfissional.tsx`
- Modify: `app/intranet/corpo-clinico/page.tsx` (`searchParams.q` → `initialQ`; tipo de `lib/corpo-clinico/types`)

**Interfaces:**
- Consumes: Task 2 (`filtrarProfissionais`, `conveniosQueCasam`, `agruparPorGrupo`, `iniciais`), Task 5 (`ListaFicha`), `agendaDoDia`, `atendeNoDia`.
- Produces: `CorpoClinicoTela({ initialProfissionais, initialQ })`; `FichaProfissional({ prof, termoConvenio, hoje, podeEditar, onEditar, onRemover })`; o estado do formulário entra na Task 8 por `onEditar`/`onNovo`.

- [ ] **Step 1: Implementar conforme a seção "Corpo Clínico" do spec**
  - Cabeçalho "Corpo Clínico", "N profissionais · M especialidades" sem filtro; com filtro de convênio, "N profissionais · M a confirmar".
  - Linha 1: Busca + Convênio (`datalist` com convênios existentes).
  - Linha 2: chips de unidade, chips Hoje/Manhã/Tarde/Noite, `Select` de especialidade, "Limpar".
  - Lista: seções por grupo + seção final "Convênio não informado — confirmar".
  - Linha: avatar com `iniciais`, nome, especialidade/grupo, etiqueta "hoje", etiqueta "sem agenda" ou "convênio a confirmar".
  - Ficha: os blocos da tabela do spec; convênios que casam primeiro e em destaque.
  - Vazio só quando as duas partes estão vazias.
  - Alerta `aviso` dispensável.
- [ ] **Step 2: tsc, lint e testes limpos**
- [ ] **Step 3: Commit** — `feat(corpo-clinico): consulta em lista e ficha com filtro de convenio`

---

### Task 8: Corpo Clínico — janela de cadastro/edição e remoção

**Files:**
- Create: `app/intranet/corpo-clinico/ProfissionalDialog.tsx`
- Modify: `components/corpo-clinico/AgendaEditor.tsx` (só visual; mesma interface `value/onChange`), `app/intranet/corpo-clinico/CorpoClinicoTela.tsx`
- Delete: `app/intranet/corpo-clinico/CorpoClinicoView.tsx`

**Interfaces:**
- Consumes: Task 3 (`FormCC`, `FORM_CC_VAZIO`, `formDeProfissional`, `validarFormCC`, `payloadProfissional`), Task 5 (`TagInput`); APIs `POST /api/corpo-clinico`, `PATCH/DELETE /api/corpo-clinico/:id`.
- Produces: `ProfissionalDialog({ aberto, original?: Profissional, grupoInicial?: string, grupos: string[], convenios: string[], onFechar, onSalvo(aviso: string) })`.

- [ ] **Step 1: Implementar a janela (`sm:max-w-2xl`)**
  - Seções Identificação / Agenda / Valores / Convênios (`TagInput`) / Atendimento / Observações.
  - Quadro "Cadastro antigo (texto livre)" na regra atual.
  - Validação por `validarFormCC`; envio de `payloadProfissional`; erro da API exibido; "Falha de conexão ao salvar. Tente novamente." no catch.
  - Após salvar: recarrega `GET /api/corpo-clinico` e mostra `aviso`.
  - "+ Novo profissional" pré-preenche o grupo com a especialidade filtrada.
  - Remover: `confirm("Remover \"<nome>\" do corpo clínico?")`, DELETE, mensagens de erro atuais.
- [ ] **Step 2: tsc, lint e testes limpos; `rg "CorpoClinicoView"` sem resultados**
- [ ] **Step 3: Conferência visual** — capturas de `/intranet/corpo-clinico`, filtro convênio "unimed" + Manhã, ficha aberta, `?q=derma`, janela de edição aberta (sem salvar), celular com a ficha no `Sheet`. Expected: seção "não informado" no fim, valores e convênios visíveis, sem erros no console.
- [ ] **Step 4: Commit** — `feat(corpo-clinico): janela de cadastro reescrita`

---

### Task 9: Procedimentos — consulta (filtros, lista, ficha)

**Files:**
- Create: `app/intranet/procedimentos/ProcedimentosTela.tsx`, `app/intranet/procedimentos/FiltrosProc.tsx`, `app/intranet/procedimentos/ListaProc.tsx`, `app/intranet/procedimentos/FichaProcedimento.tsx`
- Modify: `app/intranet/procedimentos/page.tsx` (`searchParams.q` → `initialQ`; tipo de `lib/procedimentos/types`)

**Interfaces:**
- Consumes: Task 4, Task 5; `PATCH /api/procedimentos/:id { ativo }`.
- Produces: `ProcedimentosTela({ initialItems, initialQ })`; `FichaProcedimento({ item, podeEditar, onEditar, onAlternarAtivo })`.

- [ ] **Step 1: Implementar conforme a seção "Procedimentos" do spec**
  - Cabeçalho "Procedimentos e Exames", contagem, "+ Novo item".
  - Chips de unidade com "Todas" (padrão Hospital; `initialQ` → Todas).
  - Chips de tipo; seletor de médico de `medicosDaUnidade`, que volta a "Todos" ao trocar de unidade.
  - Lista por categoria ("Geral" para `null`), linha com nome, preço (`Intl` BRL), "Exame/Procedimento · médicos"; inativos esmaecidos com "Inativo".
  - Ficha com os blocos da tabela do spec usando `valores.ts`.
  - Nenhuma seção vazia por tipo.
  - "Novo item" usa a unidade escolhida, ou Hospital quando "Todas".
- [ ] **Step 2: tsc, lint e testes limpos**
- [ ] **Step 3: Commit** — `feat(procedimentos): consulta em lista e ficha`

---

### Task 10: Procedimentos — janela de cadastro/edição

**Files:**
- Create: `app/intranet/procedimentos/ProcedimentoDialog.tsx`
- Modify: `app/intranet/procedimentos/ProcedimentosTela.tsx`
- Delete: `app/intranet/procedimentos/ProcedimentosView.tsx`

**Interfaces:**
- Consumes: Task 4 (`FormProc`, `FORM_PROC_VAZIO`, `formDeProcedimento`, `payloadProcedimento`, `validarFormProc`), Task 5 (`TagInput` para convênios e médicos — o form guarda texto; converter com `split(",")`/`join(", ")` na borda); APIs `POST /api/procedimentos`, `PATCH /api/procedimentos/:id`.
- Produces: `ProcedimentoDialog({ aberto, original?: Procedimento, unidadeInicial: string, categorias: string[], convenios: string[], medicos: string[], onFechar, onSalvo(aviso: string) })`.

- [ ] **Step 1: Implementar a janela**
  - Seções Identificação / Valores & pagamento / Dias & horários / Preparo / Convênios & médicos / Descrição.
  - Mesmos campos e placeholders de hoje; erro da API exibido.
  - Após salvar: recarrega `GET /api/procedimentos` e mostra `aviso`.
- [ ] **Step 2: tsc, lint e testes limpos; `rg "ProcedimentosView|RamaisView|CorpoClinicoView"` sem resultados**
- [ ] **Step 3: Conferência visual** — capturas de `/intranet/procedimentos`, ficha de "Peeling facial", `?q=peeling` (abre em Todas), janela de edição aberta (sem salvar), celular com `Sheet`.
- [ ] **Step 4: Commit** — `feat(procedimentos): janela de cadastro reescrita`

---

### Task 11: Verificação final

**Files:** nenhum novo (só correções que surgirem).

- [ ] **Step 1:** Rodar todos os testes (`for f in scripts/tests/*.test.mts; do node --experimental-strip-types --no-warnings --import ./scripts/tests/ts-resolve.mjs $f || exit 1; done`). Expected: todos `ok`.
- [ ] **Step 2:** `npx tsc --noEmit -p .`, `npx next lint`, `npm run build`. Expected: limpos.
- [ ] **Step 3:** Capturas finais das três telas (desktop e celular) e da busca global levando a cada tela com `?q=`. Conferir impressão de Ramais via `Page.printToPDF` (controles ocultos, caixas inteiras).
- [ ] **Step 4:** Commit de eventuais correções — `fix(etapa3): ajustes da verificacao final`.
