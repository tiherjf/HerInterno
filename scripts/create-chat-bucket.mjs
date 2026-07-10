/**
 * Cria o bucket privado "chat" para anexos do Chat Interno.
 * Limite de 10MB por arquivo; apenas PDF e imagens (jpeg/png/webp).
 * Uso: node scripts/create-chat-bucket.mjs
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
if (buckets?.some((b) => b.name === "chat")) {
  console.log("Bucket 'chat' já existe.");
  process.exit(0);
}

const { error } = await sb.storage.createBucket("chat", {
  public: false,
  fileSizeLimit: 10 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
});

if (error) {
  console.error("Erro ao criar bucket:", error.message);
  process.exit(1);
}
console.log("✓ Bucket privado 'chat' criado (10MB, pdf/jpeg/png/webp).");
