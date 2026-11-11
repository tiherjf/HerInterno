# Redesenho visual da Intranet HER — Etapas 0 (Base) e 1 (Início)

## Intenção

O responsável de TI acha a intranet "muito comum, layout muito básico". Hoje ela usa o tema
padrão do shadcn (preto/cinza zinc), igual a milhares de sistemas, sem logo nem cor do hospital.
Objetivo: a intranet passar a ter a cara do Hospital Evandro Ribeiro e ser acolhedora —
abrir a página inicial deve parecer "a casa" do colaborador.

## Decisões tomadas com o usuário

- **Direção visual:** A · "Acolhedor institucional", variação **A2 · Azul discreto**
  (mockup em `.superpowers/brainstorm/.../visual-a-her.html`): fundo claro, menu lateral branco com
  o logo, azul do HER só em detalhes (texto, borda, números, item ativo em azul-claro com barra à
  esquerda), cor vindo das fotos das notícias.
- **Identidade:** logos oficiais fornecidos (horizontal e quadrado). Azul royal do logo como cor
  principal, cinza do símbolo como apoio.
- **Abordagem:** opção 2 — redesenho tela a tela, em etapas, cada uma com proposta visual e
  aprovação. Ordem aprovada:
  0. Base · 1. Início · 2. Notícias/Eventos · 3. Ramais/Corpo Clínico/Procedimentos ·
  4. Chamados · 5. Chat/Treinamentos/Documentos/Assistente/Perfil · 6. Admin · 7. Portal do Paciente.
  Ponto e Qualidade ficam fora (ocultos do menu).
- Este documento cobre **Etapas 0 e 1**, que a escolha da A2 já define. As etapas 2–7 terão cada
  uma seu próprio documento curto.

### Abordagens consideradas

1. Trocar a identidade nos tokens + redesenhar só estrutura e Início — rápido, telas internas mantêm o arranjo.
2. **Redesenho tela a tela (escolhida)** — mais caprichado, maior; feito em etapas.
3. Template pronto de dashboard — rejeitado: briga com os componentes atuais e daria cara de template.

Mesmo na opção 2, a Etapa 0 troca os tokens do tema: assim as telas ainda não redesenhadas já
ficam coerentes (azul em vez de preto) enquanto esperam sua vez.

## Metas / não-metas / anti-metas

- **Metas:** identidade HER em todas as telas via tokens; menu, cabeçalho, login e Início
  redesenhados conforme A2; estado de carregamento nas áreas /intranet e /admin; busca geral no
  cabeçalho; card de aniversariantes.
- **Não-metas (agora):** redesenhar telas internas (etapas 2+); modo escuro; login via AD.
- **Anti-metas:** parecer template genérico; azul "berrante" (o usuário escolheu o discreto);
  quebrar fluxos existentes (badges de não lidas, status do chat, menu recolhível, menu mobile,
  permissões de menu por papel).

## Etapa 0 — Base

### Tokens (app/globals.css)
- `--primary`: azul HER `#1f3b9c` (≈ `226 67% 37%`), `--primary-foreground` branco.
- `--ring`: mesmo azul. `--accent`: azul bem claro `#eaf0fd`, `--accent-foreground`: azul HER.
- `--background`: `#f8fafc` (slate-50). `--foreground`: slate-900. `--muted-foreground`: slate-500.
- `--border`/`--input`: slate-200. `--radius`: `0.75rem`.
- `.brand-gradient` passa a ser o azul HER (continua usado em avatares/selos).
- `themeColor` do viewport: `#1f3b9c`.

### Logo
- Arquivos em `public/brand/logo-horizontal.png` e `public/brand/logo-quadrado.png`
  (os PNGs fornecidos; fundo branco, por isso o menu é branco).

### Menu lateral (components/layout/Sidebar.tsx)
- Fundo branco, borda direita slate-200.
- Expandido: logo horizontal no topo. Recolhido: selo "HER" azul compacto (o logo quadrado
  fica ilegível a 40px).
- Item normal: texto slate-600, ícone slate-400, hover slate-100.
- Item ativo: fundo `accent`, texto e ícone azul HER, barra de 3px azul à esquerda, peso 600.
- Títulos de categoria: 10–11px, maiúsculas, slate-400.
- Mantém: recolher/expandir, overlay mobile, badges (notícias não lidas, chat), grupos admin por papel.

### Cabeçalho (components/layout/Header.tsx)
- Branco, sem o quadrado "HER" no desktop (o logo está no menu); no mobile mostra o logo pequeno
  ao lado do botão de menu.
- Campo de **busca geral** à esquerda/centro (ver abaixo).
- Direita: status do chat, sino, avatar + nome + papel, sair (mantidos).

### Busca geral
- `GET /api/busca?q=` (staff autenticado, mínimo 2 caracteres, `ilike` em paralelo, até 5 por grupo):
  - Ramais: `ramais.numero`/`descricao` + nome do setor → link `/intranet/ramais?q=`.
  - Notícias publicadas: `news.title`/`summary` → `/intranet/noticias/[id]`.
  - Corpo clínico ativo: `corpo_clinico.nome`/`especialidade` → `/intranet/corpo-clinico?q=`.
  - Procedimentos ativos: `procedimentos.nome` → `/intranet/procedimentos?q=`.
  - Documentos: `documents.title` → `/intranet/documentos?q=`.
  - Itens que dependem de menu respeitam o menu do papel (se o módulo não está no menu do
    usuário, o grupo não aparece).
- UI: dropdown abaixo do campo, agrupado por tipo, debounce ~250ms, teclado (↑ ↓ Enter Esc),
  atalho Ctrl+K foca o campo.
- As telas de destino que ainda não leem `?q=` simplesmente abrem normalmente — ler o `q` em cada
  uma entra na etapa da respectiva tela.

### Login (app/(auth)/login, esqueci-senha, nova-senha)
- Fundo claro (slate-50 com um leve gradiente azul-claro), cartão branco centralizado, logo
  horizontal acima do formulário, botão azul HER. Mesmo tratamento em esqueci/nova senha.

### Carregamento
- `app/intranet/loading.tsx` e `app/admin/loading.tsx`: esqueleto (blocos cinza pulsando) no
  espaço do conteúdo, mantendo menu e cabeçalho — some a sensação de "travado" ao navegar.

### Layouts
- `app/intranet/layout.tsx` e `app/admin/layout.tsx`: fundo `bg-background` em vez de
  `bg-gray-50`; padding do conteúdo `p-4 md:p-8`, largura máxima confortável (`max-w-7xl mx-auto`).

## Etapa 1 — Início (app/intranet/page.tsx)

Layout de cima para baixo:
1. **Saudação:** "Bom dia/Boa tarde/Boa noite, {primeiro nome}" (fuso America/Sao_Paulo) + data por extenso.
2. **Notícia em destaque:** a mais recente publicada **com capa**; foto de fundo com degradê
   escuro embaixo, selo branco da categoria, título, resumo; clica → notícia. Sem notícia com
   capa: cartão azul-claro com a mais recente sem foto. Sem notícia nenhuma: some.
3. **Três cartões:** Próximos eventos (até 3, com bloco de data em azul-claro) · Aniversariantes
   do mês (avatares/iniciais, "hoje" destacado) · Meus chamados (quantos em aberto do usuário,
   link para /intranet/chamados).
4. **Últimas notícias** (NewsFeed, sem repetir a do destaque) à esquerda, coluna à direita com
   **treinamentos pendentes**.
- Atalhos coloridos antigos (4 cartões) e banner preto saem.

### Aniversariantes
- Migração `048_profiles_birth_date.sql`: `alter table profiles add column if not exists birth_date date;`
  (usuário roda no SQL Editor).
- Campo "Data de nascimento" em Meu Perfil (`/api/perfil` PATCH aceita `birth_date`) e na edição
  de usuário do admin.
- Home mostra só **dia/mês** (nunca ano/idade). Quem não preencheu não aparece. Card mostra
  "Nenhum aniversariante este mês" quando vazio. Antes da migração rodar, o card não quebra
  (consulta falha → lista vazia).

## Restrições

- Next 14 App Router, Tailwind v4 com tokens shadcn em `globals.css`, componentes em `components/ui`.
- Arquivos com CRLF. Sem testes automatizados no projeto: verificação por `tsc`, `next lint`,
  `next build` e captura de tela headless (Chrome via CDP) das telas alteradas.
- Não regredir desempenho: Início continua com consultas em paralelo; busca com `limit`.

## Fica a critério de quem implementa

- Tons exatos de sombra/espaçamento dentro da linguagem A2.
- Ícones (lucide) de cada item.
- Texto dos estados vazios.
