/**
 * Popula o setor "Telefones Úteis" em `ramal_setores` e seus `ramais`.
 *
 * Garante o setor (upsert por nome): name="Telefones Úteis", icon="Phone",
 * color="blue", order_index=99, active=true. Depois insere os ramais abaixo,
 * com order_index sequencial preservando a ordem da lista.
 *
 * Idempotente: se o setor já possuir ramais, avisa e não insere.
 * Use `--force` para inserir mesmo assim.
 *
 * `--dry-run` imprime o que seria criado/inserido SEM gravar.
 *
 * Uso: node scripts/seed-ramais-telefones-uteis.mjs [--dry-run] [--force]
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

const dryRun = process.argv.includes("--dry-run");
const forcar = process.argv.includes("--force");

const SETOR = { name: "Telefones Úteis", icon: "Phone", color: "blue", order_index: 99, active: true };

// [label, numero (principal), extra (números/notas adicionais ou null)]
const ITENS = [
  ["HER", "3216-2226", "3026-9969 · WhatsApp 3299992-9392"],
  ["Saúde Auditiva", "Ramal 4958", "até 13h; após 4856/4857 · 2104-4926 · WhatsApp 3299813-6038"],
  ["Audiometria", "Ramal 4902", "4967 · WhatsApp 3299826-2778"],
  ["Oftalmologia", "Ramal 4983", "WhatsApp 3299824-4537"],
  ["SAC (Andressa)", "Ramal 9975", "3026-9975"],
  ["Fran", "Ramal 9976", "3026-9976"],
  ["Instituto", "Ramal 9978", "4940 / 4861"],
  ["Internação Cirúrgica", "3026-9978", "WhatsApp (32) 99806-6765"],
  ["Guias de Internação", "Ramal 4975", "WhatsApp (32) 99928-1923"],
  ["Rozane (CC)", "Ramal 4975", "WhatsApp 99987-0331"],
  ["Dra Marcia Alvim", "Ramal 4964", "3216-3448"],
  ["Unidade Levy", "(24) 3512-7306", "WhatsApp (24) 99819-3396"],
  ["Clínica Exame (Central)", "Ramal 4898", "3257-6464 · ligação e WhatsApp"],
  ["Clínica da Criança", "4009-4800", "WhatsApp (32) 99912-1623"],
  ["Vacinas (Imunorolis)", "3299813-3783", null],
  ["Dra. Elaine Cirurgia (Marcela)", "WhatsApp (32) 99863-5235", null],
  ["Dermatologia", "Ramal 4997", "WhatsApp (32) 99831-7674"],
  ["Orçamento Cirúrgico (Rayane)", "Ramal 4914", "WhatsApp 3299914-9281"],
  ["Instituto — Plantão Oftalmologia", "3299993-1530", "3299953-0476 · 2104-4921"],
];

const buildDescricao = (label, extra) => (extra ? `${label} — ${extra}` : label);

if (dryRun) {
  console.log("=== DRY RUN — ramais (setor: Telefones Úteis) ===");
  console.log(
    `Setor (upsert por nome): name="${SETOR.name}", icon="${SETOR.icon}", ` +
      `color="${SETOR.color}", order_index=${SETOR.order_index}, active=${SETOR.active}\n`
  );
  console.log(`Total de ramais que seriam inseridos: ${ITENS.length}\n`);
  ITENS.forEach(([label, numero, extra], i) => {
    console.log(`  #${i + 1} numero="${numero}" | descricao="${buildDescricao(label, extra)}"`);
  });
  console.log("\nNenhum dado foi gravado (--dry-run).");
  process.exit(0);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Upsert do setor por nome: busca primeiro; insere se ausente; captura o id.
let setorId;
{
  const { data: existente, error: buscaErr } = await sb
    .from("ramal_setores")
    .select("id")
    .eq("name", SETOR.name)
    .maybeSingle();

  if (buscaErr) {
    console.error("Erro ao buscar setor:", buscaErr.message);
    process.exit(1);
  }

  if (existente) {
    setorId = existente.id;
    console.log(`• Setor "${SETOR.name}" já existe (id=${setorId}).`);
  } else {
    const { data: novo, error: insSetorErr } = await sb
      .from("ramal_setores")
      .insert(SETOR)
      .select("id")
      .single();

    if (insSetorErr) {
      console.error("Erro ao inserir setor:", insSetorErr.message);
      process.exit(1);
    }
    setorId = novo.id;
    console.log(`✓ Setor "${SETOR.name}" criado (id=${setorId}).`);
  }
}

// Idempotência: pula se o setor já possui ramais
const { count, error: countErr } = await sb
  .from("ramais")
  .select("id", { count: "exact", head: true })
  .eq("setor_id", setorId);

if (countErr) {
  console.error("Erro ao verificar ramais existentes:", countErr.message);
  process.exit(1);
}

if ((count ?? 0) > 0 && !forcar) {
  console.warn(
    `⚠ O setor "${SETOR.name}" já possui ${count} ramal(is). ` +
      "Nada foi inserido (idempotente). Use --force para inserir mesmo assim."
  );
  process.exit(0);
}

const ramais = ITENS.map(([label, numero, extra], i) => ({
  setor_id: setorId,
  numero,
  descricao: buildDescricao(label, extra),
  order_index: i + 1,
  active: true,
}));

const { data, error } = await sb.from("ramais").insert(ramais).select("id");

if (error) {
  console.error("Erro ao inserir ramais:", error.message);
  process.exit(1);
}

console.log(`✓ ${data?.length ?? ramais.length} ramal(is) de "${SETOR.name}" inserido(s).`);
