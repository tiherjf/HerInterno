/**
 * Lista buckets de storage e se são públicos. Não altera nada.
 * Uso: node scripts/check-buckets.mjs
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

const { data, error } = await sb.storage.listBuckets();
if (error) {
  console.error("Erro:", error.message);
  process.exit(1);
}

for (const b of data) {
  console.log(`${b.public ? "PÚBLICO " : "privado "} ${b.name}`);
  const { data: files } = await sb.storage.from(b.name).list("", { limit: 5 });
  if (files?.length) {
    for (const f of files) console.log(`    - ${f.name}`);
  }
}
