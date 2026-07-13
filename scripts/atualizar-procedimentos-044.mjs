/**
 * Backfill das colunas da migração 044 (medicos, parcelas_max, pacote_sessoes,
 * pacote_preco) a partir dos dados já existentes em `procedimentos`.
 *
 * Regras (idempotente — só preenche quando a coluna-alvo está NULL):
 *  - medicos:        divide `profissional` em " e " / "," / ";".
 *  - parcelas_max:   extrai o número antes de "x" em `protocolo`
 *                    (ex.: "Parcelado em até 6x" → 6).
 *  - pacote_sessoes
 *    + pacote_preco: interpreta `protocolo` do tipo
 *                    "Protocolo {N} sessões: R$ {valor}" /
 *                    "... {N} ampolas: R$ {valor}" /
 *                    "Protocolo 3 sessões: 6x R$ 1.100,00 ou R$ 6.600,00"
 *                    → sessoes = N, preco = o ÚLTIMO "R$ X" da string (o total).
 *  - atende_particular: NÃO é tocado (mantém o default TRUE do banco).
 *
 * Requer a migração 044 aplicada. Lê .env.local como os demais scripts.
 *
 * Uso: node scripts/atualizar-procedimentos-044.mjs [--dry-run]
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
const BATCH = 20;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Divide "Dra. Thais e Dra. Jessica" → ["Dra. Thais", "Dra. Jessica"]. */
function parseMedicos(profissional) {
  if (!profissional) return null;
  const out = profissional
    .split(/\s+e\s+|[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
  return out.length ? out : null;
}

/** Número de parcelas antes de "x": "em até 6x" → 6. */
function parseParcelas(protocolo) {
  if (!protocolo) return null;
  const m = protocolo.match(/(\d+)\s*x/i);
  return m ? Number(m[1]) : null;
}

/** Converte número em formato BR: "6.600,00" → 6600.00 ; "1.200,00" → 1200.00. */
function parseBR(s) {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Interpreta pacote a partir do protocolo. Retorna { sessoes, preco } ou null.
 * preco = o ÚLTIMO valor "R$ X" da string (o total, não a parcela).
 */
function parsePacote(protocolo) {
  if (!protocolo) return null;
  const mSess = protocolo.match(/(\d+)\s*(?:sess|ampola)/i);
  if (!mSess) return null;
  const sessoes = Number(mSess[1]);

  const valores = [...protocolo.matchAll(/R\$\s*([\d.,]+)/gi)]
    .map(m => parseBR(m[1]))
    .filter(v => v != null);
  if (!valores.length) return null;

  const preco = valores[valores.length - 1];
  return { sessoes, preco };
}

// ---------------------------------------------------------------------------

const { data: rows, error } = await sb
  .from("procedimentos")
  .select("id, nome, profissional, protocolo, medicos, parcelas_max, pacote_sessoes, pacote_preco");

if (error) {
  console.error("Erro ao ler procedimentos:", error.message);
  process.exit(1);
}

const planos = [];
for (const row of rows ?? []) {
  const upd = {};

  if (row.medicos == null) {
    const m = parseMedicos(row.profissional);
    if (m) upd.medicos = m;
  }

  if (row.parcelas_max == null) {
    const pc = parseParcelas(row.protocolo);
    if (pc != null) upd.parcelas_max = pc;
  }

  const pac = parsePacote(row.protocolo);
  if (pac) {
    if (row.pacote_sessoes == null) upd.pacote_sessoes = pac.sessoes;
    if (row.pacote_preco == null) upd.pacote_preco = pac.preco;
  }

  if (Object.keys(upd).length) planos.push({ id: row.id, nome: row.nome, upd });
}

const stats = { medicos: 0, parcelas: 0, pacote: 0 };
for (const { upd } of planos) {
  if ("medicos" in upd) stats.medicos++;
  if ("parcelas_max" in upd) stats.parcelas++;
  if ("pacote_sessoes" in upd || "pacote_preco" in upd) stats.pacote++;
}

console.log(`${rows?.length ?? 0} procedimento(s) lido(s). ${planos.length} com alterações a aplicar.`);
console.log(`  medicos:  ${stats.medicos}`);
console.log(`  parcelas: ${stats.parcelas}`);
console.log(`  pacote:   ${stats.pacote}`);

if (dryRun) {
  console.log("\n--dry-run: nenhuma alteração gravada. Prévia:");
  for (const { nome, upd } of planos) {
    console.log(`  • ${nome}: ${JSON.stringify(upd)}`);
  }
  process.exit(0);
}

if (!planos.length) {
  console.log("Nada a atualizar (idempotente).");
  process.exit(0);
}

let ok = 0;
for (let i = 0; i < planos.length; i += BATCH) {
  const lote = planos.slice(i, i + BATCH);
  const results = await Promise.all(
    lote.map(({ id, upd }) => sb.from("procedimentos").update(upd).eq("id", id))
  );
  results.forEach((r, j) => {
    if (r.error) console.error(`  ✗ ${lote[j].nome}: ${r.error.message}`);
    else ok++;
  });
}

console.log(`\n✓ ${ok}/${planos.length} procedimento(s) atualizado(s).`);
