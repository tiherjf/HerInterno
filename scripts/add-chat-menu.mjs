/**
 * Adiciona (upsert) o item "Chat Interno" ao menu_permissions.
 * Uso: node scripts/add-chat-menu.mjs
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

const ALL_ROLES = [
  "admin",
  "ti",
  "marketing",
  "rh",
  "recepcao",
  "enfermagem",
  "administrativo",
  "manutencao",
  "qualidade",
];

const { error } = await sb.from("menu_permissions").upsert(
  {
    key: "chat",
    label: "Chat Interno",
    href: "/intranet/chat",
    icon: "MessageCircle",
    category: "Comunicação",
    order_num: 4,
    can_view: ALL_ROLES,
    can_edit: ["admin", "ti"],
    active: true,
  },
  { onConflict: "key" }
);

if (error) {
  console.error("Erro ao inserir item de menu:", error.message);
  process.exit(1);
}
console.log("✓ chat (Chat Interno) inserido/atualizado em menu_permissions.");
console.log("Concluído.");
