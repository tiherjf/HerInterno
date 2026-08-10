/**
 * Junta os três grupos de otorrino num só, "Otorrinolaringologia":
 *
 *   Otorrinos (35)  +  Otorrinolaringologia (6)  +  Otorrino (Dr Leonardo Ramos) (1)
 *
 * São a mesma especialidade — a divisão veio de o Hospital e a Clínica da
 * Criança terem sido cadastrados por planilhas diferentes.
 *
 * A `especialidade` de cada linha só é normalizada quando era uma variação sem
 * informação extra ("Otorrinolaringologista", "Otorrinos"). As que distinguem
 * público ("Otorrino – Adulto e Infantil", "Otorrino Pediatra") são mantidas e
 * aparecem como subtítulo sob o nome.
 *
 * Reordena `order_num` de 1..N porque juntar os grupos criaria colisões: os
 * itens com valor de consulta vêm primeiro (é o que o balcão procura), o resto
 * em ordem alfabética.
 *
 * Idempotente: rodar de novo não muda nada.
 *
 * Uso:
 *   node scripts/unificar-grupo-otorrinos.mjs --dry-run
 *   node scripts/unificar-grupo-otorrinos.mjs
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const l of env.split("\n")) {
    const m = l.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Arquivo .env.local não encontrado. Rode a partir da raiz do projeto.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const DESTINO = "Otorrinolaringologia";
const ORIGENS = ["Otorrinos", "Otorrinolaringologia", "Otorrino (Dr Leonardo Ramos)"];

/** Especialidades que só repetem o nome do grupo — viram o nome do destino. */
const REDUNDANTES = new Set([
  "Otorrinolaringologista",
  "Otorrinos",
  "Otorrino (Dr Leonardo Ramos)",
  "Otorrinolaringologia",
]);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await sb
  .from("corpo_clinico")
  .select("id,nome,grupo,especialidade,unidade,order_num,valor_particular")
  .in("grupo", ORIGENS)
  .eq("ativo", true);
if (error) { console.error("Erro ao ler corpo_clinico:", error.message); process.exit(1); }

if (data.length === 0) {
  console.log("Nenhuma linha nos grupos de otorrino. Nada a fazer.");
  process.exit(0);
}

// As linhas de referência do ambulatório ficam no topo, na ordem em que o
// balcão consulta: o valor padrão da equipe, as exceções e o procedimento.
// Ordenar por valor não serviria — 32 otorrinos compartilham os mesmos R$ 390.
const PRIORIDADE = ["Equipe Otorrinos", "Dr Evandro Ribeiro", "Dr Leonardo Ramos", "Remoção de Cerume"];
const posicao = (nome) => {
  const i = PRIORIDADE.indexOf(nome);
  return i === -1 ? PRIORIDADE.length : i;
};

const ordenado = [...data].sort((a, b) => {
  const pa = posicao(a.nome), pb = posicao(b.nome);
  if (pa !== pb) return pa - pb;
  return a.nome.localeCompare(b.nome, "pt-BR");
});

const mudancas = [];
ordenado.forEach((r, i) => {
  const especialidade = REDUNDANTES.has(r.especialidade) ? DESTINO : r.especialidade;
  const order_num = i + 1;
  const campos = {};
  if (r.grupo !== DESTINO) campos.grupo = DESTINO;
  if (r.especialidade !== especialidade) campos.especialidade = especialidade;
  if (r.order_num !== order_num) campos.order_num = order_num;
  if (Object.keys(campos).length) mudancas.push({ r, campos, especialidade, order_num });
});

console.log(`=== UNIFICAR GRUPOS DE OTORRINO → "${DESTINO}" ===`);
console.log(dryRun ? "MODO: dry-run (nada será gravado)\n" : "MODO: gravando no banco\n");

const porOrigem = {};
for (const r of data) porOrigem[r.grupo] = (porOrigem[r.grupo] ?? 0) + 1;
console.log("Grupos de origem:");
for (const [g, n] of Object.entries(porOrigem)) console.log(`  ${g} (${n})`);

console.log(`\nOrdem final (${ordenado.length} linhas):`);
for (const [i, r] of ordenado.entries()) {
  const esp = REDUNDANTES.has(r.especialidade) ? "" : `  ← mantém "${r.especialidade}"`;
  const valor = r.valor_particular != null ? `R$ ${r.valor_particular}` : "—";
  console.log(`  ${String(i + 1).padStart(2)}. [${r.unidade}] ${r.nome} · ${valor}${esp}`);
}

console.log(`\n${mudancas.length} linha(s) a alterar.`);

if (dryRun) {
  console.log("\nNada foi gravado (--dry-run).");
} else {
  let ok = 0;
  for (const m of mudancas) {
    const { error: e } = await sb.from("corpo_clinico").update(m.campos).eq("id", m.r.id);
    if (e) { console.error(`Erro ao atualizar ${m.r.nome}:`, e.message); process.exit(1); }
    ok++;
  }
  console.log(`\n✓ ${ok} linha(s) atualizada(s).`);
}
