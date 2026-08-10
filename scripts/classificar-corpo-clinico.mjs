/**
 * Preenche a especialidade dos profissionais que entraram no grupo
 * "A classificar", cruzando com a planilha de especialidades (`medicosespec`,
 * tabela dinâmica: uma coluna por especialidade, médicos listados abaixo).
 *
 * Só mexe em quem está no grupo "A classificar" — quem já veio da planilha do
 * ambulatório mantém a especialidade detalhada de lá (ex.: "Ortopedista" com
 * subespecialidade "Joelho").
 *
 * A planilha original é .xls (OLE2). Converta antes para .xlsx:
 *   $x = New-Object -ComObject Excel.Application; $x.Visible = $false
 *   $wb = $x.Workbooks.Open("C:\...\medicosespec.xls")
 *   $wb.SaveAs("C:\...\medicosespec.xlsx", 51); $wb.Close($false); $x.Quit()
 *
 * Uso:
 *   node scripts/classificar-corpo-clinico.mjs --planilha "C:/.../medicosespec.xlsx" --dry-run
 *   node scripts/classificar-corpo-clinico.mjs --planilha "C:/.../medicosespec.xlsx"
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { lerXlsx } from "./lib/xlsx.mjs";

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

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const iCaminho = argv.indexOf("--planilha");
if (iCaminho < 0 || !argv[iCaminho + 1]) {
  console.error("Informe a planilha: --planilha \"C:/caminho/medicosespec.xlsx\"");
  process.exit(1);
}
const caminho = argv[iCaminho + 1];

/** Colunas da planilha que não são especialidade clínica. */
const IGNORAR = new Set(["RN", "Total Geral", "TODAS AS ESPECIALIDADES", "CONSULTAS", ""]);

/**
 * Especialidade da planilha → nome usado no corpo clínico.
 * Reaproveita os grupos que já existem na página sempre que possível; os
 * marcados como (novo) criam uma seção nova.
 */
const MAPA = {
  "ALERGOLOGIA": "Alergologista e Imunologista",
  "ANESTESIOLOGIA": "Anestesiologista",                                        // novo
  "ANGIOLOGIA - CIRURGIA VASCULAR E LINFÁTICA": "Angiologista / Cirurgião Vascular",
  "ASSISTÊNCIA SOCIAL": "Assistência Social",                                  // novo
  "CARDIOLOGIA": "Cardiologista + ECG",
  "CIRURGIA APARELHO DIGESTIVO,ÓRGÃOS ANEXOS E PAREDE ABDOMINAL": "Cirurgia Geral e Aparelho Digestivo",
  "CIRURGIA BUCOMAXILOFACIAL": "Buco Maxilo",
  "CIRURGIA DE CABEÇA E PESCOÇO": "Cirurgia Cabeça e Pescoço",
  "CIRURGIA GERAL": "Cirurgia Geral",
  "CIRURGIA PEDIÁTRICA": "Cirurgia Pediátrica",                                // novo
  "CIRURGIA PLÁSTICA": "Cirurgião Plástico",
  "CLÍNICA MÉDICA": "Clínica Médica",                                          // novo
  "COLOPROCTOLOGIA": "Proctologista",
  "DERMATOLOGIA CLÍNICA E CIRÚRGICA": "Dermatologista",
  "ENDOCRINOLOGIA": "Endocrinologista",                                        // novo
  "FARMACÊUTICA": "Farmácia",                                                  // novo
  "FONOAUDIOLOGIA": "Fonoaudiologia",                                          // novo
  "GASTROENTEROLOGIA": "Gastroenterologista",
  "GINECOLOGIA E OBSTETRÍCIA": "Ginecologia",
  "GINECOLOGIA E OBSTETRÍCIA.": "Ginecologia",
  "MASTOLOGIA": "Mastologia",                                                  // novo
  "NEUROCIRURGIA": "Neurocirurgia",                                            // novo
  "NEUROLOGIA": "Neurologista",
  "ODONTOLOGIA": "Odontologia",                                                // novo
  "OFTALMOLOGIA": "Oftalmologista",
  "ORTOPEDIA E TRAUMATOLOGIA": "Ortopedista",
  "OTORRINOLARINGOLOGIA": "Otorrinos",
  "PNEUMOLOGIA": "Pneumologista",                                              // novo
  "PROCTOLOGIA": "Proctologista",
  "RADIODIAGNÓSTICO": "Radiodiagnóstico",                                      // novo
  "UROLOGIA": "Urologista",
};

// ------------------------------------------------------------------ planilha

const limpa = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const norm = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const linhas = Object.values(lerXlsx(caminho))[0];
if (!linhas?.length) { console.error("Planilha vazia ou ilegível."); process.exit(1); }
const cabecalho = linhas[0].map(limpa);

const desconhecidas = cabecalho.filter((c) => !IGNORAR.has(c) && !(c in MAPA));
if (desconhecidas.length) {
  console.error(`Especialidades sem mapeamento (adicione em MAPA): ${desconhecidas.join(", ")}`);
  process.exit(1);
}

const porMedico = new Map(); // nome normalizado -> Set(especialidade no app)
for (let c = 0; c < cabecalho.length; c++) {
  const esp = cabecalho[c];
  if (IGNORAR.has(esp)) continue;
  for (let r = 1; r < linhas.length; r++) {
    const nome = limpa(linhas[r][c]);
    if (!nome) continue;
    const chave = norm(nome);
    if (!porMedico.has(chave)) porMedico.set(chave, new Set());
    porMedico.get(chave).add(MAPA[esp]);
  }
}

// --------------------------------------------------------------------- banco

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: banco, error } = await sb
  .from("corpo_clinico")
  .select("id,nome,grupo,especialidade,observacoes,order_num,unidade")
  .eq("ativo", true);
if (error) { console.error("Erro ao ler corpo_clinico:", error.message); process.exit(1); }

const proximoOrder = {};
for (const r of banco) {
  if (r.unidade !== "Hospital") continue;
  proximoOrder[r.grupo] = Math.max(proximoOrder[r.grupo] ?? 0, r.order_num ?? 0);
}

const aClassificar = banco.filter((r) => r.grupo === "A classificar");
const atualizacoes = [];
const ambiguos = [];
const semEspecialidade = [];

for (const r of aClassificar) {
  const esps = porMedico.get(norm(r.nome));
  if (!esps) { semEspecialidade.push(r); continue; }
  if (esps.size > 1) { ambiguos.push({ r, esps: [...esps] }); continue; }
  const grupo = [...esps][0];
  proximoOrder[grupo] = (proximoOrder[grupo] ?? 0) + 1;
  atualizacoes.push({
    id: r.id,
    nome: r.nome,
    grupo,
    campos: {
      especialidade: grupo,
      grupo,
      order_num: proximoOrder[grupo],
      observacoes: "Valores e agenda a confirmar com o ambulatório",
    },
  });
}

// ------------------------------------------------------------------ relatório

const gruposExistentes = new Set(banco.map((r) => r.grupo));
const porGrupo = new Map();
for (const a of atualizacoes) {
  if (!porGrupo.has(a.grupo)) porGrupo.set(a.grupo, []);
  porGrupo.get(a.grupo).push(a.nome);
}

console.log("=== CLASSIFICAÇÃO DO CORPO CLÍNICO ===");
console.log(dryRun ? "MODO: dry-run (nada será gravado)\n" : "MODO: gravando no banco\n");
console.log(`No grupo "A classificar": ${aClassificar.length}\n`);

for (const [grupo, nomes] of [...porGrupo].sort((a, b) => b[1].length - a[1].length)) {
  const marca = gruposExistentes.has(grupo) ? "" : "  ← seção nova";
  console.log(`▸ ${grupo} (${nomes.length})${marca}`);
  for (const n of nomes) console.log(`    ${n}`);
}

if (ambiguos.length) {
  console.log(`\n▸ ⚠ Mais de uma especialidade na planilha (${ambiguos.length}) — não alterados`);
  for (const a of ambiguos) console.log(`    ${a.r.nome} → ${a.esps.join(" | ")}`);
}

console.log(`\n▸ Continuam em "A classificar" (${semEspecialidade.length}) — não constam na planilha`);
for (const r of semEspecialidade) console.log(`    ${r.nome}`);

console.log(`\nResumo: ${atualizacoes.length} de ${aClassificar.length} classificados.`);

if (dryRun) {
  console.log("\nNada foi gravado (--dry-run).");
} else {
  let ok = 0;
  for (const a of atualizacoes) {
    const { error: e } = await sb.from("corpo_clinico").update(a.campos).eq("id", a.id);
    if (e) { console.error(`Erro ao atualizar ${a.nome}:`, e.message); process.exit(1); }
    ok++;
  }
  console.log(`\n✓ ${ok} profissional(is) classificado(s).`);
}
