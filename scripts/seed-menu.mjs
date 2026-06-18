/**
 * Cria a tabela menu_permissions e insere os dados iniciais.
 * Uso: node scripts/seed-menu.mjs
 *
 * Requer que a tabela já exista (execute o SQL abaixo no Supabase Dashboard primeiro):
 *
 * CREATE TABLE IF NOT EXISTS public.menu_permissions (
 *   key TEXT PRIMARY KEY, label TEXT NOT NULL, href TEXT NOT NULL,
 *   icon TEXT NOT NULL, category TEXT NOT NULL, order_num INTEGER DEFAULT 0,
 *   can_view TEXT[] NOT NULL DEFAULT ARRAY['admin','ti','marketing','rh','recepcao','enfermagem','administrativo'],
 *   can_edit TEXT[] NOT NULL DEFAULT ARRAY['admin','ti'],
 *   active BOOLEAN DEFAULT TRUE, updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
 * );
 * ALTER TABLE public.menu_permissions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "leitura" ON public.menu_permissions FOR SELECT TO authenticated USING (active = TRUE);
 * CREATE POLICY "gestao" ON public.menu_permissions FOR ALL TO authenticated
 *   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','ti','marketing') AND active = TRUE));
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Arquivo .env.local não encontrado.");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ITEMS = [
  { key: "noticias",         label: "Notícias",         href: "/intranet/noticias",          icon: "Newspaper",    category: "Comunicação", order_num: 1,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti","marketing"] },
  { key: "eventos",          label: "Eventos",           href: "/intranet/eventos",           icon: "Calendar",     category: "Comunicação", order_num: 2,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti","marketing"] },
  { key: "corpo-clinico",    label: "Corpo Clínico",     href: "/intranet/corpo-clinico",     icon: "Stethoscope",  category: "Clínica",     order_num: 3,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti"] },
  { key: "ramais",           label: "Ramais",            href: "/intranet/ramais",            icon: "Phone",        category: "Clínica",     order_num: 4,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti"] },
  { key: "treinamentos",     label: "Treinamentos",      href: "/intranet/treinamentos",      icon: "GraduationCap",category: "Capacitação", order_num: 5,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti","rh"] },
  { key: "documentos",       label: "Documentos",        href: "/intranet/documentos",        icon: "FileText",     category: "Capacitação", order_num: 6,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti","rh"] },
  { key: "assistente",       label: "Assistente IA",     href: "/intranet/assistente",        icon: "Brain",        category: "Suporte",     order_num: 7,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti"] },
  { key: "chamados",         label: "Chamados TI",       href: "/intranet/chamados",          icon: "Ticket",       category: "Suporte",     order_num: 8,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti"] },
  { key: "ponto",            label: "Meu Ponto",         href: "/intranet/ponto",             icon: "Clock",        category: "Ponto",       order_num: 9,  can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti","rh"] },
  { key: "ponto-calendario", label: "Calendário Ponto",  href: "/intranet/ponto/calendario",  icon: "CalendarDays", category: "Ponto",       order_num: 10, can_view: ["admin","ti","marketing","rh","recepcao","enfermagem","administrativo"], can_edit: ["admin","ti","rh"] },
];

const { error } = await sb
  .from("menu_permissions")
  .upsert(ITEMS, { onConflict: "key" });

if (error) {
  console.error("Erro ao inserir:", error.message);
  console.log("\n==> Execute o SQL do cabeçalho deste arquivo no Supabase Dashboard primeiro.");
} else {
  console.log(`✓ ${ITEMS.length} itens de menu inseridos/atualizados.`);
}
