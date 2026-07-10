/**
 * Adiciona o role "qualidade" ao can_view de todos os itens de menu
 * e ao can_edit do módulo Qualidade.
 * Uso: node scripts/add-role-qualidade-menu.mjs
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

const { data: items, error } = await sb.from("menu_permissions").select("key, can_view, can_edit");
if (error) {
  console.error("Erro ao listar menu:", error.message);
  process.exit(1);
}

for (const item of items) {
  const can_view = Array.from(new Set([...(item.can_view || []), "qualidade"]));
  const can_edit = item.key === "qualidade"
    ? Array.from(new Set([...(item.can_edit || []), "qualidade"]))
    : item.can_edit;
  const { error: upError } = await sb
    .from("menu_permissions")
    .update({ can_view, can_edit })
    .eq("key", item.key);
  if (upError) {
    console.error(`Erro em ${item.key}:`, upError.message);
  } else {
    console.log(`✓ ${item.key}${item.key === "qualidade" ? " (view + edit)" : ""}`);
  }
}
console.log("Concluído.");
