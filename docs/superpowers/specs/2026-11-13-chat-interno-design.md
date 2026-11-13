# Chat Interno — redesenho, recados, mensagens prontas, busca e grupos

Data: 2026-11-13 · Antecipado da etapa 5 do redesenho (vem antes da etapa 4, Chamados).

## Intenção

O chat interno é o canal rápido entre setores do hospital (recepção, enfermagem,
faturamento…). Hoje ele funciona, mas a tela esconde o que importa: não existe
lista de conversas — para achar quem escreveu é preciso abrir o setor da pessoa.
O usuário pediu sugestões e aprovou **todas** as dez. O objetivo é que a pessoa
que volta do almoço veja na hora quem falou com ela (urgente primeiro), consiga
avisar várias pessoas de uma vez (grupos) e repita menos digitação (recado de
status, mensagens prontas).

## Situação atual (o que existe e continua valendo)

- Tela única `app/intranet/chat/page.tsx` (~1.070 linhas, client component).
- `components/chat/ChatProvider.tsx` (no layout da intranet e do admin): presença
  pelo canal Realtime `presence:intranet` (status Disponível/Ausente/Ocupado,
  ausente automático por inatividade, status salvo em localStorage), canal
  pessoal `chat:user:<id>` com eventos `message`, `typing`, `read`, contador de
  não lidas por remetente (`unreadFrom`), notificação do navegador, `useChatUnread`
  para o contador do menu.
- Tabela `chat_messages` (migr. 039/040): 1:1, `read_at` na própria linha, anexos
  (bucket privado `chat`, PDF/JPG/PNG/WEBP até 10 MB), chamada urgente
  (`urgent`, `urgent_reason`; única forma de escrever para quem está "Ocupado").
- Rotas `app/api/chat-interno/*`: lista+diretório (`route.ts`), `mensagens`
  (GET paginado 50 / POST), `lidas`, `anexos`, `expurgo` (cron Vercel, apaga
  mensagens e anexos com mais de 30 dias — LGPD). Todo acesso pelo service role;
  RLS sem policies para clientes.
- Aviso LGPD dispensável; "Fora do expediente" fora das 07h–19h; ligar/copiar
  ramal no cabeçalho da conversa.

Tudo isso **continua funcionando igual**; a reescrita troca a tela e acrescenta.

## Objetivos

### Parte A — tela nova (sem banco)
1. **Abas Conversas · Grupos · Pessoas** na coluna da esquerda (mockup "B",
   escolhido pelo usuário).
   - *Conversas* (aba padrão): conversas individuais e grupos misturados, ordem
     pela última mensagem; conversa com urgente não lido sempre no topo com fundo
     vermelho claro e selo "URGENTE"; contador de não lidas no item e na aba.
   - *Grupos*: só os grupos de que participo (inclusive sem mensagem ainda) e,
     para gestores/admin, botão "+ Grupo".
   - *Pessoas*: diretório por setor como hoje (recolher setor, "x/y online",
     online primeiro), para iniciar conversa.
2. **Busca** no topo da coluna: em *Pessoas* casa nome, setor e ramal (sem
   acento, por parte do texto); em *Conversas*/*Grupos* filtra os itens por nome.
   A busca **nas mensagens** é a Parte B.
3. **Visual A2**: mesmos tokens e peças das etapas 0–3 (`Cabecalho`, `CampoBusca`,
   `Chip`, cores `primary`/`accent`). "Meu status" vira um seletor compacto no
   cabeçalho da página. Cabeçalho da conversa mostra setor e ramal em destaque
   (número grande como em Ramais) com ligar/copiar.
4. **Urgente recebido mais visível**: ao abrir uma conversa com urgente não lido,
   faixa vermelha fixa no topo da conversa com o motivo, até a pessoa responder
   ou fechar a faixa.
5. **"Mandar mensagem" a partir de outras telas**: atalho (ícone de balão) nos
   **aniversariantes do Início**, no **autor da notícia** e na **lista de
   inscritos de evento** (as três telas têm o id do perfil). Mecanismo:
   `/intranet/chat?com=<profileId>` abre o chat já na pessoa (e `?grupo=<id>` no
   grupo). Não aparece para o próprio usuário. (Ramais não entra: os ramais não
   são ligados a pessoas.)
6a. **Privacidade do tempo real (correção de falha existente)**: hoje o servidor
   envia a mensagem **completa** (texto, anexo, motivo de urgente, nome) por
   broadcast no canal `chat:user:<id>`, que é público — qualquer usuário logado
   pode assinar o canal de outro e ler o que chega para ele; a página inclusive
   assina o canal do interlocutor para enviar "digitando". Correção, já na
   Parte A: o broadcast passa a levar **só um aviso sem conteúdo** (tipo, id da
   mensagem, id do remetente/grupo, se é urgente) e o cliente busca a mensagem
   pela API, que confere a permissão; a notificação do navegador usa o que a API
   devolver. Vale para individuais e, depois, grupos. O "digitando" continua por
   broadcast (só leva quem digita). Comportamento visível ao usuário não muda.
6. **Código dividido em peças** (como Ramais/Corpo Clínico): regras puras em
   `lib/chat-interno/*.ts` com testes, componentes em `app/intranet/chat/`.

### Parte B — recado, mensagens prontas, busca (banco: tabelas/colunas pequenas)
7. **Recado de status**: texto livre até 60 caracteres, opcional, junto do seletor
   de status. Aparece em itálico sob o nome (listas e cabeçalho da conversa),
   para todos, mesmo que a pessoa esteja offline. **Expira no fim do dia**
   (23:59 horário de Brasília do dia em que foi escrito); a pessoa pode apagar
   antes. Gravado no banco (não só na presença), para aparecer também offline.
8. **Mensagens prontas pessoais**: cada pessoa cria, edita, apaga e ordena as
   suas; ninguém vê as dos outros. Botão "⚡ Prontas" ao lado do campo de
   digitação abre a lista; escolher **coloca o texto no campo, sem enviar**.
   Gerenciar (criar/editar/apagar) dali mesmo. Limites: 2.000 caracteres por
   frase (mesmo limite da mensagem), até 50 frases por pessoa.
9. **Busca nas mensagens**: uma busca em todas as minhas conversas (individuais
   e grupos de que participo, respeitando a data de entrada no grupo), dentro do
   que está guardado (30 dias). Resultado: com quem/qual grupo, quando, trecho
   com o termo destacado; clicar abre a conversa já na mensagem (carrega o
   histórico até ela e rola com destaque breve). Mínimo de 3 caracteres.

### Parte C — conversas em grupo (banco: tabelas novas)
10. **Grupos criados por pessoas**:
    - **Quem cria**: gestores (`profiles.is_manager = true`) e administradores
      (`role = 'admin'`). Nome até 60 caracteres, escolhe participantes da lista
      de colaboradores ativos.
    - **Quem administra**: quem criou (dentro do próprio grupo) e qualquer
      administrador. Para o administrador há uma lista **"Todos os grupos" na
      área de administração** (`/admin`): renomear, ver e mexer em participantes,
      encerrar — **sem ler as mensagens**. Para ler, o admin precisa se adicionar
      ao grupo, o que aparece para todos ("Admin entrou no grupo").
    - **Participantes**: podem sair quando quiserem; não adicionam ninguém.
    - **Quem entra depois** só vê mensagens a partir da sua entrada.
    - **Quem sai ou é removido** perde acesso a todo o histórico do grupo
      (lista, mensagens, anexos, busca). Se for adicionado de novo, a entrada
      recomeça: vê só a partir da nova data.
    - **Mensagens**: texto e anexos (mesmas regras de hoje). **Sem chamada
      urgente em grupo.** "Ocupado" não bloqueia mensagem de grupo.
    - **Leitura**: "lida por X de Y" na minha mensagem; tocar mostra quem leu.
    - **Notificação** e contador do menu valem para grupos como para conversas.
    - **"digitando…"** no grupo mostra o nome de quem digita.
    - **Encerrar grupo**: some para todos; as mensagens seguem a limpeza de 30
      dias. Mensagens de sistema leves ("Marta adicionou Bia", "Carla saiu")
      aparecem no histórico.
    - Mesma **limpeza de 30 dias** e mesmo aviso LGPD.

## Não objetivos

- Grupos automáticos por setor (o usuário escolheu grupos criados por pessoas).
- Mensagens prontas compartilhadas por setor (o usuário escolheu só pessoais).
- Chamada urgente em grupo.
- Editar ou apagar mensagem enviada, reações, responder citando, chamadas de voz.
- Mudar a retenção de 30 dias ou o expediente 07h–19h.
- Alterar Chamados, Ponto, Qualidade.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Quebrar ou mudar o comportamento da conversa individual de hoje (mensagens,
  anexos, urgente, leitura, notificações) — ela está em uso.
- Qualquer mudança nas linhas existentes de `chat_messages`.
- Mensagem de grupo chegar a quem não participa (ou a quem saiu/foi removido),
  ou alguém ver mensagens de antes de entrar — **inclusive pelo tempo real**:
  nenhum broadcast leva conteúdo de mensagem.
- Tela travando ao digitar (hoje as listas são `memo` por isso — manter o cuidado).

## Restrições

- Next.js 14 App Router, React 18, Tailwind v4, Supabase; mesmo padrão das
  etapas anteriores (regras puras testadas com `node --experimental-strip-types`
  + `scripts/tests/ts-resolve.mjs`; `npx tsc --noEmit`, `npx next lint`, build).
- Migrações SQL numeradas a partir de **050**, aplicadas **manualmente pelo
  usuário** no SQL Editor do Supabase (produção). Nenhuma escrita no banco de
  produção sem autorização. O código **degrada sem a migração** (como 039/040
  fazem hoje): sem 050 a parte B some sem erro; sem a de grupos, a aba Grupos
  mostra aviso de migração pendente e o resto funciona.
- Acesso a dados só pelas rotas de API com service role (padrão atual); RLS
  habilitado sem policies para clientes nas tabelas novas.
- Realtime por broadcast no canal pessoal de cada participante (padrão de
  `lib/chat-interno/realtime.ts`), melhor esforço, **só com avisos sem conteúdo**
  (ver 6a); polling da página cobre falhas.
- Responder sempre em português na interface; datas/horas em horário de Brasília.
- Push/deploy só com confirmação do usuário.

## Abordagens consideradas

**Tela**: reescrever do zero em peças (escolhida, mesmo caminho das etapas 2–3)
vs. retocar a tela atual (descartada: arquivo de 1.070 linhas, abas mudam a
estrutura inteira).

**Grupos no banco** (usuário escolheu a 1):
1. **Tabelas novas só para grupos** — `chat_groups`, `chat_group_members`
   (com `joined_at` e `last_read_at`), `chat_group_messages`. "Lida por X de Y" =
   participantes com `last_read_at >= created_at`. A conversa individual não é
   tocada. Custo: dois caminhos parecidos no código (individual e grupo).
2. Modelo único de "conversa" (individual vira grupo de 2): mais limpo a longo
   prazo, mas exige migrar todas as mensagens e reescrever todas as rotas —
   risco de derrubar o chat em uso.
3. Grupo na mesma `chat_messages`: menos tabelas, mas `read_at` por linha não
   serve para grupo e as consultas atuais ganham exceções.

## Decidido com o usuário

- Todas as 10 sugestões entram, em três partes publicadas separadamente, na
  ordem **A → B → C**.
- Layout de abas (mockup B).
- Grupos criados por pessoas; podem criar os gestores (marcação já existente
  "Este usuário é gestor") e administradores.
- Regras de administração/participação/entrada tardia/limpeza dos grupos como
  descritas acima; sem urgente em grupo.
- Mensagens prontas só pessoais.
- Recado expira no fim do dia; prontas inserem sem enviar; busca única em
  todas as conversas.
- Grupos com tabelas próprias (abordagem 1).

## Decisões do redator (podem ser revistas)

- Recado gravado em colunas novas de `profiles` (`chat_recado`,
  `chat_recado_expira_em`) — é um dado por pessoa, lido junto com o diretório.
- Mensagens prontas em tabela própria (`chat_respostas_prontas`: dono, texto,
  ordem), não em localStorage — a recepção troca de computador.
- Limites: recado 60, nome de grupo 60, frase pronta 2.000, 50 frases por pessoa,
  até 100 participantes por grupo.
- Anexos de grupo no mesmo bucket `chat`, prefixo `grupos/<groupId>/`; acesso
  só para participantes atuais.
- Aba aberta e setores recolhidos lembrados por navegador (localStorage).
- Celular: coluna da esquerda ocupa a tela; abrir conversa vira tela cheia com
  "voltar" (como hoje).

## Respondido após a revisão do construtor

- Corrigir já na Parte A a exposição do conteúdo pelo tempo real (item 6a): sim.
- Admin gerencia todos os grupos pela área de administração sem ler mensagens;
  para ler, entra no grupo de forma visível: sim.
- Atalho "Mandar mensagem" nos três lugares (aniversariantes, autor da notícia,
  inscritos de evento): sim.
- Saída/remoção tira acesso a todo o histórico; readição recomeça a data de
  entrada (decisão do redator, aceita).

## O que fica para quem constrói

- Divisão exata em componentes e arquivos, nomes de rotas novas.
- Como guardar a participação (apagar a linha ao sair vs. manter com data de
  saída), desde que a regra de acesso acima valha.
- "digitando…" em grupo: como enviar sem um broadcast por participante a cada
  tecla (ex.: um aviso por participante com o mesmo limite de 2 s de hoje).
- Como o `ChatProvider` passa a contar não lidas de grupos (chave por grupo) e
  como o contador do menu soma tudo.
- Índices das tabelas novas; formato do evento de broadcast de grupo.
- Paginação da busca e do histórico de grupo (seguir os 50 por página atuais).
- Mensagens de sistema do grupo: como guardar (ex.: coluna `kind` na mensagem).
