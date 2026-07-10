/**
 * Remove a entrada duplicada "chamados" do menu (a atual é "chamados-ti").
 * Uso: node scripts/remover-menu-chamados-duplicado.mjs
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

const { data: rows, error } = await sb
  .from("menu_permissions")
  .select("key, label, href, icon, active")
  .like("key", "chamados%");

if (error) {
  console.error("Erro:", error.message);
  process.exit(1);
}

console.log("Entradas de chamados no menu:");
for (const r of rows) {
  console.log(`  ${r.active ? "ativo  " : "inativo"}  ${r.key.padEnd(20)} "${r.label}" → ${r.href} (${r.icon})`);
}

const dup = rows.find((r) => r.key === "chamados");
if (!dup) {
  console.log("\nNenhuma entrada 'chamados' (duplicada) encontrada. Nada a fazer.");
  process.exit(0);
}

const { error: delError } = await sb
  .from("menu_permissions")
  .delete()
  .eq("key", "chamados");

if (delError) {
  console.error("Erro ao remover:", delError.message);
  process.exit(1);
}
console.log(`\n✓ Entrada duplicada "chamados" ("${dup.label}" → ${dup.href}) removida do menu.`);
