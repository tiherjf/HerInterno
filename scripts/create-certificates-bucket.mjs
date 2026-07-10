/**
 * Cria o bucket privado "certificates" (não existia — a geração de certificado falhava).
 * Uso: node scripts/create-certificates-bucket.mjs
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

const { data: buckets } = await sb.storage.listBuckets();
if (buckets?.some((b) => b.name === "certificates")) {
  console.log("Bucket 'certificates' já existe.");
  process.exit(0);
}

const { error } = await sb.storage.createBucket("certificates", {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf"],
});

if (error) {
  console.error("Erro ao criar bucket:", error.message);
  process.exit(1);
}
console.log("✓ Bucket privado 'certificates' criado.");
