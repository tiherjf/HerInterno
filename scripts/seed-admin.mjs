// Script para criar o primeiro usuário administrador no Supabase
// Uso: node scripts/seed-admin.mjs
//
// Lê as variáveis de ambiente do .env.local automaticamente

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Carregar .env.local manualmente
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
} catch {
  console.error("Arquivo .env.local não encontrado.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USERS = [
  {
    email: "mateus@hospitalevandroribeiro.com",
    password: "Mr14mr14*",
    full_name: "Mateus Oliveira",
    role: "ti",
    sector: "TI",
    unit: "Matriz",
    phone_ext: "1000",
  },
];

async function seed() {
  for (const u of USERS) {
    console.log(`\nCriando usuário: ${u.email}`);

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        console.log("  → Usuário já existe no Auth. Pulando criação Auth.");
        // Tenta buscar o ID existente
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((x) => x.email === u.email);
        if (existing) {
          await upsertProfile(existing.id, u);
        }
        continue;
      }
      console.error("  ✗ Erro ao criar Auth:", error.message);
      continue;
    }

    console.log("  ✓ Auth criado:", data.user.id);
    await upsertProfile(data.user.id, u);
  }

  console.log("\nPronto.");
}

async function upsertProfile(id, u) {
  const { error } = await supabase.from("profiles").upsert({
    id,
    full_name: u.full_name,
    role: u.role,
    sector: u.sector,
    unit: u.unit,
    phone_ext: u.phone_ext,
    active: true,
  });

  if (error) {
    console.error("  ✗ Erro ao criar perfil:", error.message);
  } else {
    console.log(`  ✓ Perfil criado: ${u.full_name} (${u.role})`);
  }
}

seed();
