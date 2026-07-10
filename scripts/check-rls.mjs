/**
 * Testa se tabelas sensíveis estão expostas via anon key (RLS desligada ou policy permissiva).
 * Não altera nada. Uso: node scripts/check-rls.mjs
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

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES = [
  "patients", "profiles", "exams", "activity_logs",
  "justifications", "justification_types", "justification_history",
  "hour_bank", "ponto_fechamentos", "menu_permissions", "asset_inventory",
  "corpo_clinico", "procedimentos", "news", "news_reads", "news_comments",
  "events", "event_registrations", "trainings", "training_progress",
  "documents", "extensions", "extension_sectors",
  "tickets", "ticket_comments", "ticket_attachments",
  "quality_ncs", "quality_indicators", "quality_documents", "quality_sectors",
  "chatbot_knowledge",
];

let exposed = 0;
for (const table of TABLES) {
  const { data, error, count } = await anon
    .from(table)
    .select("*", { count: "exact", head: false })
    .limit(1);
  if (error) {
    console.log(`  PROTEGIDA/erro  ${table}: ${error.code || ""} ${error.message}`);
  } else if ((count ?? 0) > 0 && data && data.length > 0) {
    exposed++;
    const cols = Object.keys(data[0]).join(", ");
    console.log(`  !! EXPOSTA      ${table}: ${count} linhas legíveis via anon. Colunas: ${cols}`);
  } else {
    console.log(`  vazia/0 linhas  ${table} (RLS pode estar ativa retornando vazio, ou tabela vazia)`);
  }
}

console.log(`\n${exposed} tabelas com dados legíveis pela anon key.`);
