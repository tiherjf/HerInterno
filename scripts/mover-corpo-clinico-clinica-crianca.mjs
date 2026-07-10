/**
 * Move todos os registros do corpo_clinico com unidade "Hospital" para "Clínica da Criança".
 * Uso: node scripts/mover-corpo-clinico-clinica-crianca.mjs
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
  .update({ unidade: "Clínica da Criança", updated_at: new Date().toISOString() })
  .eq("unidade", "Hospital")
  .select("id, nome");

if (error) {
  console.error("Erro ao atualizar:", error.message);
  process.exit(1);
} else {
  console.log(`✓ ${data.length} registros movidos para "Clínica da Criança":`);
  for (const row of data) {
    console.log(`  - ${row.nome}`);
  }
}
