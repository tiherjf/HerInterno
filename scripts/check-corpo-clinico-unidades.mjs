/**
 * Lista quantos registros de corpo_clinico existem por unidade (dry-run, não altera nada).
 * Uso: node scripts/check-corpo-clinico-unidades.mjs
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

const { data, error } = await sb
  .from("corpo_clinico")
  .select("unidade, ativo, nome");

if (error) {
  console.error("Erro ao consultar:", error.message);
  process.exit(1);
}

const counts = {};
for (const row of data) {
  const key = `${JSON.stringify(row.unidade)} | ativo=${row.ativo}`;
  counts[key] = (counts[key] || 0) + 1;
}

console.log(`Total de registros: ${data.length}\n`);
console.log("Contagem por unidade:");
for (const [key, count] of Object.entries(counts)) {
  console.log(`  ${key}: ${count}`);
}
