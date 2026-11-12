# Redesenho — Etapa 3: Ramais, Corpo Clínico e Procedimentos

Data: 2026-11-12 · Etapa 3 de 7 do redesenho da intranet (estilo A2: azul discreto, sem faixas coloridas, logos oficiais). Etapas 0–2 já no ar.

## Intenção

Quem mais usa estas três telas é a **recepção atendendo um paciente ao telefone**. A pessoa está com o paciente na linha e precisa da resposta em segundos:

- **Corpo Clínico** — "tenho Unimed, quero dermatologista de manhã; quanto é a consulta?"
- **Procedimentos** — "quanto custa o peeling? precisa de jejum? parcela?"
- **Ramais** — achar o número para transferir a ligação.

O paciente quase sempre diz o convênio logo de cara, então o Corpo Clínico ganha um filtro de convênio.

Hoje as telas são "básicas" e pesadas para esse uso:
- faixas de cor forte por setor/unidade, emojis;
- especialidades em caixas fechadas que precisam ser abertas uma a uma;
- tabela larga de procedimentos com colunas quase sempre vazias;
- nomes de ramal quebrando em 4 linhas.

## Objetivos

1. As três telas no estilo A2, iguais em linguagem visual a Notícias/Eventos.
2. Corpo Clínico e Procedimentos no formato **lista + ficha ao lado**:
   - lista curta à esquerda;
   - clicar abre a ficha completa à direita;
   - no celular a ficha abre por cima.
3. Filtro de **convênio** no Corpo Clínico, digitando parte do nome.
4. Ramais em lista limpa por setor, número grande, nome inteiro, copiar com um clique.
5. Janelas de cadastro/edição (médico, procedimento, setor, ramal) também reescritas no visual novo.
6. O link da busca global (`?q=`) passa a preencher a busca da tela. Hoje é ignorado — defeito encontrado na análise.

## Fora do escopo

- **Rotas de API e banco:** nenhuma mudança, nenhuma migração.
- **Nomes de convênio:** não serão arrumados no banco (110 nomes distintos com variações: "UNIMED JF"/"UNIMED INTERCÂMBIO"/"UNIMED", "Caixa"/"SAÚDE CAIXA", "DRA MARCIA - …"). Seria tarefa separada e só com autorização do usuário, porque mexe em dados reais.
- **Filtro de convênio em Procedimentos:** nenhum dos 36 itens tem convênio cadastrado hoje.
- **Busca no servidor:** os volumes são pequenos (150 profissionais ativos, 36 procedimentos, 108 ramais).
- **Outras etapas:** Ponto & RH e Qualidade.

## Anti-objetivos (seria fracasso mesmo "funcionando")

- Ficar mais lento para a recepção achar a resposta do que hoje.
- Perder qualquer informação que a tela atual mostra (nenhum campo pode sumir).
- Quebrar qualquer função existente:
  - cadastro e edição;
  - agenda estruturada;
  - aviso de migração pendente (`aviso`);
  - favoritos;
  - "meu ramal";
  - impressão de ramais;
  - permissões (`useMenuPermission`);
  - itens inativos visíveis só para editores em Procedimentos.

## Abordagens consideradas

| | Abordagem | Troca |
|---|---|---|
| 1 | Redesenhar mantendo a lógica dos arquivos atuais | Menor risco; arquivos continuam grandes (600–1.100 linhas) |
| **2** | **Reescrever as telas do zero** em arquivos novos e pequenos | **Escolhida pelo usuário.** Código mais limpo e testável; mais risco de regressão, mitigado por testes das regras puras e conferência visual |
| 3 | Só trocar cores e cabeçalhos | Rápido, mas não entrega lista + ficha nem filtro de convênio |

**Decisões minhas (o usuário pode mudar):**
- **APIs e banco intactos.** Os três `page.tsx` continuam carregando os dados no servidor (`getRamaisData`, `getProfissionais`, `getProcedimentos`) e passando para a tela.
- **Filtro no navegador.** É instantâneo a cada tecla; no servidor cada letra esperaria uma ida e volta.

## O que o usuário decidiu

- Corpo Clínico: formato **B — lista + ficha ao lado** (rejeitou a lista de fichas abertas).
- Procedimentos: mesmo formato lista + ficha, "para a recepção aprender um jeito só" — aprovado.
- Ramais: lista por setor em caixas brancas, sem faixas coloridas nem emojis — aprovado.
- Com filtro de convênio ativo, médicos **sem convênio cadastrado aparecem no fim**, numa seção "Convênio não informado — confirmar" (não são escondidos).
- Reescrever do zero, incluindo as janelas de cadastro/edição.

Os modelos aprovados estão em `.superpowers/brainstorm/7600-1794506327/content/` (`corpo-clinico.html`, opção B; `procedimentos-ramais.html`).

## Dados reais (consulta somente leitura, 2026-11-12)

**Corpo Clínico** — 150 profissionais ativos.

| Recorte | Quantidade |
|---|---|
| Hospital | 111 |
| Clínica da Criança | 31 |
| Barão | 8 |
| Sem convênio | 30 |
| Com agenda estruturada | 4 (o resto usa texto livre `dias`/`horarios`) |
| `sem_agenda` | 32 |
| Com valor particular | 76 |

**Procedimentos** — 36 itens, todos Hospital/procedimento/ativos.
- Nenhum tem preparo, dias ou convênio.
- A tela tem de ficar boa assim e também quando esses campos forem preenchidos.

**Ramais** — 10 setores, 108 ramais. Há ramais com número "N/A".

## Desenho

### Base comum (estilo A2)

**Cabeçalho**
- Igual a Notícias: título `h1`, linha de contagem em cinza e botão primário à direita (só para quem edita).
- Sem banner colorido.

**Filtros**
- Chips no estilo accent já usado em Notícias.
- Unidades sem emoji e sem cor por unidade.

**Componente compartilhado `components/ui-her/ListaFicha.tsx`**
- **Desktop (lg+):**
  - lista à esquerda (~40%) com rolagem própria;
  - ficha à direita, sticky;
  - item selecionado destacado (contorno/fundo primary claro).
- **Seleção:**
  - ao carregar ou ao mudar os filtros, se o item selecionado não estiver mais na lista, seleciona o primeiro;
  - lista vazia → painel com mensagem.
- **Abaixo de lg:**
  - só a lista;
  - tocar no item abre a ficha num `Sheet` (`components/ui/sheet.tsx`), com fechar/voltar;
  - não abre nada sozinho.
- Teclado: setas ↑/↓ movem a seleção quando o foco está na lista; Enter abre a ficha no celular. Desejável, não obrigatório.

**Busca**
- Sem acento e sem diferenciar maiúsculas, com `normalizarTexto` de `components/corpo-clinico/agenda.ts`.
- `?q=` na URL preenche a busca ao abrir.

**Contadores**
- "N profissionais", "N itens", "N ramais", refletindo o filtro.
- Botão "Limpar" quando há filtro.

**Permissões**
- `useMenuPermission(<chave>).canEdit` controla todos os botões de criar, editar, remover e ativar.
- Mesmas chaves de hoje: `ramais`, `corpo-clinico`, `procedimentos`.

**Mensagens**
- `aviso` devolvido pela API após salvar continua aparecendo num alerta dispensável.

### Corpo Clínico

**Barra de filtros**
- Linha 1: campo **Busca** e campo **Convênio**.
  - Busca: nome, especialidade, grupo, subespecialidade, local, observações, dias, horários, unidade **e convênios** (como hoje; quem já digita "unimed" na busca continua achando). *(minha decisão)*
  - Convênio: tem sugestões (`datalist`) com os convênios existentes.
  - No celular, os dois ficam empilhados.
- Linha 2:
  - chips de unidade: Todas + Hospital, Clínica da Criança, Instituto Levy, Barão, Instituto;
  - chips de disponibilidade, em multisseleção: Hoje / Manhã / Tarde / Noite, com a mesma regra de hoje via `atendeNoDia` e `turnosDe`;
  - seletor de **Especialidade** (lista suspensa com os grupos), que substitui o painel de chips de 33 grupos.

**Regra do convênio**
- Termo de convênio vazio → sem efeito.
- Com termo:
  - profissionais com algum convênio cujo nome normalizado contém o termo normalizado vão para a lista principal;
  - profissionais com `convenios` nulo/vazio vão para a seção final **"Convênio não informado — confirmar"**;
  - os demais somem.
- "unimed" casa com "UNIMED JF", "UNIMED INTERCÂMBIO", "UNIMED EMERGÊNCIA JF" etc.

**Lista**
- Agrupada por `grupo` (especialidade), com título de seção, na ordem em que os dados chegam (grupo, `order_num`, nome).
- Cada linha mostra:
  - avatar com iniciais;
  - nome;
  - especialidade (se diferente do grupo) ou grupo;
  - etiqueta verde "hoje" quando atende hoje;
  - etiqueta âmbar "sem agenda" quando `sem_agenda`.
- Seção "Convênio não informado" por último, com etiqueta âmbar "convênio a confirmar".
- Contagem com filtro de convênio: as duas partes separadas, "5 profissionais · 2 a confirmar". A mensagem de lista vazia só aparece quando as duas partes estão vazias. *(minha decisão)*

**Ficha**

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | Nome; especialidade · subespecialidade · unidade |
| Selo | "Atende hoje · 08:00–12:00" (faixas de hoje quando há agenda estruturada; senão só "Atende hoje") |
| Atendimento | Dias e horários (texto como hoje); "Ainda não liberou horário" se `sem_agenda` |
| Local, idade | Local; "a partir de N anos" |
| Valores | Consulta particular, Pequenos convênios, Particular com desconto (só os preenchidos; "Valores não cadastrados" se nenhum) |
| Convênios (N) | Todos, em chips; os que casam com o filtro em destaque e primeiro; "Nenhum convênio cadastrado" se vazio |
| Observações | Observações |

- Para quem edita: botões **Editar** e **Remover**.

**Janela de cadastro/edição** (largura maior, `sm:max-w-2xl`), em seções:

1. **Identificação:**
   - nome* e especialidade*;
   - grupo*: seleção dos existentes + "Criar novo grupo";
   - unidade;
   - subespecialidade.
2. **Agenda:**
   - "Ainda não liberou horário" (`sem_agenda`);
   - quadro do cadastro antigo (texto livre) quando o registro não tem agenda estruturada mas tem `dias`/`horarios`;
   - `AgendaEditor` (pode ser reescrito no visual novo, mesma interface `value/onChange`, uma faixa por dia).
3. **Valores:** os três valores em R$.
4. **Convênios:**
   - campo de etiquetas: digitar e Enter ou vírgula adiciona; × remove;
   - sugestões dos existentes;
   - colar "A, B, C" adiciona os três.
5. **Atendimento:** idade mínima, local.
6. **Observações.**

- **Regras de envio idênticas às de hoje:**
  - validações: obrigatórios; início < fim em cada dia;
  - `body.agenda` quando há agenda;
  - senão `dias`/`horarios` com "—";
  - `agenda: null` só se o registro tinha agenda estruturada;
  - `unidade` padrão "Clínica da Criança".
- **Novo profissional:** se há especialidade filtrada, o grupo já vem preenchido com ela.
- **Remover:** pede confirmação e usa `DELETE /api/corpo-clinico/:id`, mostrando o erro da API.

### Procedimentos

**Barra de filtros**
- Busca: nome, descrição, preparo, categoria, médicos.
- Chips de unidade:
  - Hospital, Clínica da Criança, Instituto Levy, Instituto, Barão;
  - padrão Hospital;
  - o chip "Todas" fica sempre visível; com `?q=`, a tela abre em "Todas";
  - com "Todas", o seletor de médico lista os médicos de todas as unidades, e o "Novo item" usa Hospital;
  - limpar a busca não troca a unidade escolhida. *(minha decisão)*
- Chips de tipo: Todos / Exames / Procedimentos.
- Seletor de médico (só quando a unidade tem médicos; volta para "Todos" ao trocar de unidade).

**Lista**
- Agrupada por categoria, com a mesma ordenação de hoje:
  - categoria pelo menor `order_num`;
  - itens sem categoria por último, rotulados "Geral".
- Cada linha mostra: nome, preço à direita, "Exame/Procedimento · médicos".
- Itens inativos (só editores veem) ficam esmaecidos, com etiqueta "Inativo".
- Tipos sem itens não aparecem como seção vazia. Some o "Exames 0".

**Ficha**

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | Etiqueta tipo · categoria; nome; unidade · duração |
| Valor | Preço `/unidade_medida`; "em até Nx de R$ …"; pacote "N sessões: R$ … (economiza R$ …)"; protocolo |
| Convênios | Convênios + "Particular" quando `atende_particular`; "Somente particular" se não há convênios e atende particular |
| Preparo | Quadro âmbar: jejum ("Sem jejum" quando 0), suspender medicação, documentos, requer agendamento, observações de preparo; "Sem preparo especial" se nada |
| Médicos | Médicos (`medicos[]`, ou o legado `profissional` dividido), dias e horários |
| Descrição | Descrição |

- Para quem edita: **Editar** e **Ativar/Desativar**.

**Janela de cadastro/edição** — mesmos ~25 campos de hoje, em seções:
1. Identificação.
2. Valores & pagamento.
3. Dias & horários.
4. Preparo.
5. Convênios & médicos.
6. Descrição.

- Convênios e médicos viram campos de etiquetas, mas o envio continua igual: texto separado por vírgula, que a API divide.

### Ramais

**Cabeçalho**
- "Ramais", com a contagem "10 setores · 108 ramais".
- Botões Imprimir e "+ Novo setor" (admin).

**Topo da tela**
- Busca: número, descrição e **nome do setor** (novo), sem acento.
- Botão "Favoritos" (só gravados).
- Faixa "Meu ramal" com copiar, quando existe.

**Favoritos**
- Caixa "Favoritos" no topo quando há algum.

**Setores**
- Chips de setor sem emoji, com contagem.
- Setores em caixas brancas:
  - cabeçalho: nome + contagem + ações admin (+ ramal, editar, remover);
  - um ramal por linha.
- Cada linha de ramal:
  - número grande à esquerda, tabular;
  - descrição inteira (pode quebrar em 2 linhas, nunca em 4);
  - estrela de favorito;
  - copiar;
  - editar e remover (admin), visíveis no hover no desktop e sempre visíveis no toque.
- Número "N/A": mostra "—" e não oferece copiar.
- Disposição: duas colunas no desktop (CSS `columns`, sem buracos), uma no celular.

**Impressão**
- Esconde controles, imprime as caixas sem quebrar no meio (`break-inside-avoid`).

**Janelas**
- Setor: nome* e ordem. Ícone e cor saem do formulário porque não aparecem mais; o PATCH só envia os campos do formulário, preservando os valores gravados.
- Ramal: setor*, número*, descrição*, ordem.

**Remoções**
- Pedem confirmação, como hoje.

### Organização do código (sugestão para o plano)

Arquivos pequenos por responsabilidade:

**Regras puras, testáveis**
- `lib/corpo-clinico/filtro.ts`: filtro e divisão convênio/não informado, convênios que casam.
- `lib/corpo-clinico/form.ts`: montar payload, validar.
- `lib/procedimentos/filtro.ts`: filtro, agrupamento por categoria, `medicosDe`.
- `lib/procedimentos/valores.ts`: parcela, economia do pacote, lista de preparo.
- `lib/procedimentos/form.ts`: montar payload.
- `lib/ramais/filtro.ts`: filtro com nome do setor e favoritos.

**Telas**
- `app/intranet/<tela>/` com a view principal, filtros, linha da lista, ficha e formulário em arquivos próprios.

**Compartilhado**
- `components/ui-her/ListaFicha.tsx`.
- `components/ui-her/TagInput.tsx` (campo de etiquetas para convênios e médicos).

Os arquivos antigos `RamaisView.tsx`, `CorpoClinicoView.tsx` e `ProcedimentosView.tsx` são removidos ao final. Os tipos `Profissional` e `Procedimento` passam para `lib/` e são importados por `page.tsx`.

## Verificação esperada

**Testes das regras puras** em `scripts/tests/*.test.mts`, no padrão das etapas anteriores:
- convênio casa por parte do nome, sem acento;
- "não informado" vai para o fim;
- filtros combinados;
- busca de ramal pelo setor;
- agrupamento por categoria;
- economia do pacote;
- payloads idênticos aos de hoje.

**Comandos:** `npx tsc --noEmit -p .`, `npx next lint` e `npm run build` limpos.

**Capturas** (Chrome headless, sessão admin, desktop 1440 e celular 390) das três telas:
- com filtro de convênio "unimed";
- ficha aberta;
- janela de edição aberta, sem salvar;
- `?q=` funcionando.

**Gravação de dados:** nada é gravado no banco de produção nos testes sem autorização.

## Deixado para quem construir

- Espaçamentos, ícones e microtextos dentro do estilo A2 já existente.
- Como reescrever o `AgendaEditor` internamente, mantendo a interface.
- Animações.
