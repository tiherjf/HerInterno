# Intranet HER — Hospital Evandro Ribeiro

Sistema de intranet hospitalar completo com dois portais independentes, chatbot IA e gestão de exames em vídeo.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (PostgreSQL, Auth, Storage)
- **Tailwind CSS** + componentes shadcn/ui
- **pdf-lib** (certificados PDF)
- **jose** (JWT para pacientes)
- **bcryptjs** (hash de senhas dos pacientes)

---

## Configuração inicial

### 1. Instalar dependências

```bash
cd her-intranet
npm install
```

### 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (nunca no frontend) |
| `JWT_PATIENT_SECRET` | Secret para tokens de pacientes |
| `GLPI_API_TOKEN` | Token da API do GLPI |
| `GLPI_URL` | URL base do GLPI |
| `OPENCLAW_URL` | URL do OpenClaw local |
| `VIDEO_STORAGE_PATH` | Path local dos vídeos de exames |
| `RESEND_API_KEY` | API key Resend (opcional) |

### 3. Banco de dados

Execute no SQL Editor do Supabase:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
```

### 4. Buckets Supabase Storage

Crie os buckets públicos:
- `media` — imagens das notícias
- `certificates` — certificados PDF
- `documents` — base de documentos

### 5. Criar admin inicial

No Supabase Authentication, crie o usuário. Depois:

```sql
INSERT INTO public.profiles (id, full_name, role, sector, unit, active)
VALUES ('<UUID>', 'Nome Admin', 'admin', 'TI', 'Matriz', true);
```

### 6. Iniciar

```bash
npm run dev
```

| Portal | URL |
|---|---|
| Colaboradores | http://localhost:3000/login |
| Pacientes | http://localhost:3000/pacientes/login |
| Admin | http://localhost:3000/admin |

---

## Módulos

| Módulo | Status |
|---|---|
| Notícias e Comunicados | ✅ Completo |
| Eventos com inscrições | ✅ Completo |
| Lista de Ramais | ✅ Completo |
| Treinamentos + Avaliação | ✅ Completo |
| Certificado PDF automático | ✅ Completo |
| Base de Documentos | ✅ Completo |
| Chatbot IA (OpenClaw) | ✅ Completo |
| Integração GLPI | ✅ Completo |
| Portal do Paciente | ✅ Completo |
| Streaming de Vídeo | ✅ Completo (Range headers) |
| Painel Admin | ✅ Completo |
| Logs de Atividade | ✅ Completo |
| Mural Digital | 🔄 Estrutura no banco |
| Pesquisa NPS | 🔄 Estrutura no banco |

---

## Perfis e permissões

| Perfil | Descrição |
|---|---|
| `admin` | Acesso total |
| `ti` | Acesso total + configurações técnicas |
| `marketing` | Cria/edita notícias e eventos |
| `rh` | Treinamentos e relatórios |
| `recepcao` | Leitura + inscrições + cadastro pacientes |
| `enfermagem` | Leitura + inscrições |
| `administrativo` | Leitura + inscrições |

---

## Deploy

```bash
npm run build
```

1. Conectar ao GitHub na Vercel
2. Adicionar variáveis de ambiente
3. Deploy automático via push

**Nota:** O streaming de vídeo lê arquivos locais via `fs`. Em ambiente serverless (Vercel), use um servidor próprio ou VPS para esta rota.

---

## Segurança

- Senhas de pacientes: bcrypt (10 rounds)
- Vídeos: sempre validados por JWT antes do streaming
- Service role key: apenas em API routes server-side
- RLS habilitado em todas as tabelas
- `patients` e `exams`: zero policies para usuários comuns — acesso somente por service role
- System prompt do chatbot: nunca exposto ao cliente
