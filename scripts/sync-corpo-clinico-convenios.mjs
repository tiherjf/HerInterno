/**
 * Unifica o corpo clínico com as duas planilhas do ambulatório:
 *
 *   1. "AMBULATORIO ATUALIZADO DIA 03.07.2026.xlsx" — corrige valores, idade
 *      mínima, dias e local dos profissionais já cadastrados (lista CORRECOES).
 *   2. "medico convenio.XLSX" (aba "Resumo por Médico") — preenche a coluna
 *      `convenios` de quem já existe e cadastra os profissionais que faltam.
 *
 * Regra dos otorrinos: todos seguem o valor da "Equipe Otorrinos"
 * (390 / 140 / 330); só o Dr Evandro Ribeiro tem valor próprio (500/375/425).
 *
 * Idempotente: só altera o que está diferente e só insere nome que ainda não
 * existe na tabela (comparação por nome normalizado, sem acento).
 *
 * Uso:
 *   node scripts/sync-corpo-clinico-convenios.mjs --dry-run
 *   node scripts/sync-corpo-clinico-convenios.mjs
 *   node scripts/sync-corpo-clinico-convenios.mjs --planilha "C:/caminho/medico convenio.XLSX"
 */

import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { lerXlsx } from "./lib/xlsx.mjs";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Arquivo .env.local não encontrado. Rode a partir da raiz do projeto.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const caminhoPlanilha =
  argv[argv.indexOf("--planilha") + 1] && argv.includes("--planilha")
    ? argv[argv.indexOf("--planilha") + 1]
    : "C:/Users/mateus.oliveira/Downloads/medico convenio.XLSX";

// ---------------------------------------------------------------- constantes

const UNIDADE = "Hospital";
const LOCAL_OTORRINO = "Ambulatório · Ramal 4953";
const VALOR_EQUIPE_OTORRINO = { valor_particular: 390, valor_convenio: 140, valor_desconto: 330 };
const VALOR_DR_EVANDRO = { valor_particular: 500, valor_convenio: 375, valor_desconto: 425 };
const DR_EVANDRO = "Evandro Ribeiro de Oliveira";

/** Otorrinolaringologistas do hospital (lista fornecida pelo ambulatório). */
const OTORRINOS = [
  "Afonso Celso Rotondo",
  "Agenor Alves de Souza",
  "Alice Werneck Silva",
  "Andre Costa Pinto Ribeiro",
  "Aparecida Regina Brum",
  "Audryo Oliveira Nogueira",
  "Bruno Oliveira David",
  "Carlos Alexandre de Oliveira Lopes",
  "Cintia Cristina Esteves Stigert Jenegn",
  "Daniel Ferreira Lana e Silva",
  "Diego Costa de Souza Ferreira",
  "Evandro Ramos Ribeiro de Oliveira",
  "Evandro Ribeiro de Oliveira",
  "Fabricio Pessoa Frazao Costa",
  "Gilberto Francisco Ferreira Filho",
  "Hercílio Raimundo dos Anjos Lima",
  "Jader Costa dos Reis",
  "Joziene Aparecida de Carvalho",
  "Juliana Carolina Cunha Paula",
  "Kamilla Freitas Passos",
  "Kenia Assis Chaves",
  "Laura Rodrigues Sefair",
  "Leonardo Ramos Ribeiro de Oliveira",
  "Lindomar Pereira de Paiva",
  "Livia Machado Rigolon",
  "Maria Clara Souza Schettini",
  "Mariana Azevedo Silva Franklin",
  "Mariana Salzer Reis Zimmermmann",
  "Marianna Novaes da Costa Avila",
  "Mateus Oliveira de Paula",
  "Miguel E. G. Macedo",
  "Monik Assis Espindula Mota",
  "Natalia Mello do Vale",
  "Pedro Berg de Mendonça",
  "Pedro Henrique Almeida Nascimento",
  "Raquel Godinho de Sá",
  "Rhodrigo Goldner Cesca",
  "Tarssíus Capelo Candido",
  "Valdete Melo",
  "Vitor Ramos Ribeiro de Oliveira",
];

/** Linhas da planilha que são pessoa jurídica / rótulo de faturamento, não profissional. */
const NAO_PROFISSIONAIS = [
  "HOSPITAL EVANDRO RIBEIRO LTDA",
  "REGINA BRUM SERVIÇOS MEDICOS LTDA",
  "MEDICO EXTERNO",
  "BAUGRATZ CODE",
];

/**
 * Correções vindas da planilha do ambulatório de 03/07/2026.
 * Chave = nome exato como está hoje na tabela (unidade Hospital).
 */
const CORRECOES = {
  "Alexandre de Tarso": { valor_convenio: 250 },
  "Alice Musse": { valor_convenio: 250 },
  "Matheus Mousinho": { valor_convenio: 250 },
  "Rodrigo Toledo": { valor_convenio: 230 },
  "Guilherme Moreira": { valor_desconto: 330 },
  "Camila Brandão": { idade_minima: 11, dias: "Sexta" },
  "Thalis Marcello": { dias: "Segunda" },
  "Mauro Willian": { dias: "Seg/Ter/Sex" },
  "Christiane Valente": { local: "3º Andar · Ramal 4990" },
  "Simone Miranda": { local: "3º Andar · Ramal 4990" },
};

/**
 * Nomes abreviados na tabela que o casamento automático erra ou não acha.
 * Chave = nome na tabela, valor = nome na planilha de convênios (null = sem correspondência).
 */
const APELIDOS = {
  "Dra Alice": "Alice Mussi",
  "Sergio Neto": "Sergio Ricardo Neto",
  "Dr Evandro Ribeiro": DR_EVANDRO,
  "Rafael Netto": "Rafael Neto Pereira",
  "Equipe Otorrinos": null,
  "Remoção de Cerume": null,
};

// ------------------------------------------------------- normalização / match

const norm = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const PALAVRAS_IGNORADAS = new Set(["de", "da", "do", "dos", "das", "e", "dr", "dra", "junior", "filho", "neto", "jr"]);
const tokens = (s) => norm(s).split(" ").filter((t) => t.length > 1 && !PALAVRAS_IGNORADAS.has(t));

/** Igual, prefixo de 4+ letras, ou 1 caractere de diferença (Barleta/Barletta). */
function parecido(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return true;
}

/** Todos os tokens do nome curto precisam aparecer no nome longo. */
function casa(curto, longo) {
  const A = tokens(curto), B = tokens(longo);
  return A.length > 0 && A.every((a) => B.some((b) => parecido(a, b)));
}

// ------------------------------------------------------------------- planilha

const abas = lerXlsx(caminhoPlanilha);
const aba = abas["Resumo por Médico"];
if (!aba) {
  console.error(`Aba "Resumo por Médico" não encontrada em ${caminhoPlanilha}. Abas: ${Object.keys(abas).join(", ")}`);
  process.exit(1);
}
const PLANILHA = aba.slice(1)
  .filter((l) => l[0]?.trim() && l[2]?.trim())
  .map((l) => ({
    nome: l[0].trim(),
    convenios: l[2].split(",").map((s) => s.trim()).filter(Boolean).sort(),
  }));

const ehNaoProfissional = (nome) => NAO_PROFISSIONAIS.some((n) => norm(n) === norm(nome));
const ehOtorrino = (nome) => OTORRINOS.some((o) => norm(o) === norm(nome) || casa(o, nome) || casa(nome, o));

// ----------------------------------------------------------------------- banco

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: banco, error } = await sb
  .from("corpo_clinico")
  .select("id,nome,especialidade,grupo,unidade,dias,convenios,valor_particular,valor_convenio,valor_desconto,idade_minima,local,order_num")
  .order("unidade")
  .order("order_num");
if (error) { console.error("Erro ao ler corpo_clinico:", error.message); process.exit(1); }

// ------------------------------------------------------ 1. correções de valor

const atualizacoes = new Map(); // id -> { campos }
const anota = (id, campos) => atualizacoes.set(id, { ...(atualizacoes.get(id) ?? {}), ...campos });

const numero = (v) => (v == null ? null : Number(v));
const relatorioCorrecoes = [];

for (const linha of banco.filter((r) => r.unidade === UNIDADE)) {
  const corr = CORRECOES[linha.nome];
  if (!corr) continue;
  const mudou = {};
  for (const [campo, valor] of Object.entries(corr)) {
    const atual = campo.startsWith("valor_") ? numero(linha[campo]) : linha[campo] ?? null;
    if (atual !== valor) mudou[campo] = valor;
  }
  if (Object.keys(mudou).length) {
    anota(linha.id, mudou);
    relatorioCorrecoes.push(
      `  ${linha.nome}: ` +
      Object.entries(mudou).map(([c, v]) => `${c} ${linha[c] ?? "—"} → ${v}`).join(", ")
    );
  }
}

// ------------------------------------------------- 2. convênios de quem existe

const usados = new Set();
const resolvidos = new Set(); // ids de linhas do banco já associadas (ou marcadas como serviço)
const relatorioConvenios = [];
const semCorrespondencia = [];
const ambiguos = [];

for (const linha of banco) {
  let alvo = null;
  if (linha.nome in APELIDOS) {
    const apelido = APELIDOS[linha.nome];
    resolvidos.add(linha.id);
    if (apelido === null) continue;
    alvo = PLANILHA.find((p) => norm(p.nome) === norm(apelido));
    if (!alvo) { console.error(`Apelido "${apelido}" não existe na planilha.`); process.exit(1); }
  } else {
    const cands = PLANILHA.filter((p) => casa(linha.nome, p.nome));
    if (cands.length > 1) { ambiguos.push(`  ${linha.nome} → ${cands.map((c) => c.nome).join(" | ")}`); continue; }
    alvo = cands[0];
  }
  if (!alvo) { semCorrespondencia.push(`  [${linha.unidade}] ${linha.nome} — ${linha.especialidade}`); continue; }

  resolvidos.add(linha.id);
  usados.add(alvo.nome);
  // União com o que já estava na coluna (preserva as anotações da planilha do ambulatório)
  const atual = linha.convenios ?? [];
  const uniao = [...new Set([...alvo.convenios, ...atual])].sort();
  if (uniao.length !== atual.length || uniao.some((c, i) => c !== [...atual].sort()[i])) {
    anota(linha.id, { convenios: uniao });
    relatorioConvenios.push(`  [${linha.unidade}] ${linha.nome} → ${alvo.nome}: ${atual.length} → ${uniao.length} convênios`);
  }
}

// ------------------------------------------------------ 3. novos profissionais

// Um nome da planilha só é "já cadastrado" se bater com uma linha do banco que
// AINDA não foi associada a outro nome — senão apelidos curtos como "Dra Alice"
// engoliriam homônimos legítimos (Alice Werneck Silva).
const naoResolvidas = banco.filter((r) => !resolvidos.has(r.id));
const jaExiste = (nome) =>
  banco.some((r) => norm(r.nome) === norm(nome)) || naoResolvidas.some((r) => casa(r.nome, nome));

/** "MONIK ASSIS ESPINDULA MOTA" → "Monik Assis Espindula Mota" (só se veio tudo em caixa alta). */
function ajustarCaixa(nome) {
  if (nome !== nome.toUpperCase()) return nome;
  return nome.toLowerCase().replace(/\b[a-zà-ú]/g, (c) => c.toUpperCase())
    .replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (p) => p.toLowerCase());
}

const novos = [];
const ignorados = [];

for (const p of PLANILHA) {
  if (usados.has(p.nome)) continue;
  if (ehNaoProfissional(p.nome)) { ignorados.push(`  ${p.nome} (pessoa jurídica / rótulo de faturamento)`); continue; }
  if (jaExiste(p.nome)) { ignorados.push(`  ${p.nome} (já cadastrado com outro nome)`); continue; }
  novos.push({ nome: ajustarCaixa(p.nome), convenios: p.convenios });
}

// Otorrinos da lista que não aparecem na planilha de convênios entram sem convênios
for (const o of OTORRINOS) {
  if (ehNaoProfissional(o)) continue;
  if (PLANILHA.some((p) => norm(p.nome) === norm(o) || casa(o, p.nome))) continue;
  if (jaExiste(o) || novos.some((n) => casa(o, n.nome))) continue;
  novos.push({ nome: o, convenios: [] });
}

const proximoOrder = {};
for (const r of banco) {
  if (r.unidade !== UNIDADE) continue;
  proximoOrder[r.grupo] = Math.max(proximoOrder[r.grupo] ?? 0, r.order_num ?? 0);
}

const registrosNovos = novos.map((n) => {
  const otorrino = ehOtorrino(n.nome);
  const evandro = norm(n.nome) === norm(DR_EVANDRO);
  const grupo = otorrino ? "Otorrinos" : "A classificar";
  proximoOrder[grupo] = (proximoOrder[grupo] ?? 0) + 1;
  return {
    nome: n.nome,
    especialidade: otorrino ? "Otorrinolaringologista" : "A classificar",
    grupo,
    unidade: UNIDADE,
    dias: "—",
    horarios: "—",
    observacoes: otorrino ? null : "Especialidade e valores a confirmar com o ambulatório",
    sem_agenda: true,
    ativo: true,
    order_num: proximoOrder[grupo],
    convenios: n.convenios,
    local: otorrino ? LOCAL_OTORRINO : null,
    ...(otorrino ? (evandro ? VALOR_DR_EVANDRO : VALOR_EQUIPE_OTORRINO) : {}),
  };
});

// ---------------------------------------------------------------- relatório

const brl = (v) => (v == null ? "—" : `R$ ${v}`);
console.log("=== SINCRONIZAÇÃO DO CORPO CLÍNICO ===");
console.log(dryRun ? "MODO: dry-run (nada será gravado)\n" : "MODO: gravando no banco\n");

console.log(`▸ Correções da planilha do ambulatório (${relatorioCorrecoes.length})`);
console.log(relatorioCorrecoes.join("\n") || "  nenhuma — já está tudo em dia");

console.log(`\n▸ Convênios atualizados (${relatorioConvenios.length})`);
console.log(relatorioConvenios.join("\n") || "  nenhum");

if (ambiguos.length) {
  console.log(`\n▸ ⚠ Nomes ambíguos — resolva em APELIDOS antes de gravar (${ambiguos.length})`);
  console.log(ambiguos.join("\n"));
}

console.log(`\n▸ Sem correspondência na planilha de convênios (${semCorrespondencia.length})`);
console.log(semCorrespondencia.join("\n") || "  nenhum");

if (ignorados.length) {
  console.log(`\n▸ Linhas da planilha ignoradas (${ignorados.length})`);
  console.log(ignorados.join("\n"));
}

const otorrinosNovos = registrosNovos.filter((r) => r.grupo === "Otorrinos");
const classificarNovos = registrosNovos.filter((r) => r.grupo === "A classificar");

console.log(`\n▸ Novos otorrinos (${otorrinosNovos.length})`);
for (const r of otorrinosNovos) {
  console.log(`  ${r.nome} — ${brl(r.valor_particular)}/${brl(r.valor_convenio)}/${brl(r.valor_desconto)} · ${r.convenios.length} convênios`);
}

console.log(`\n▸ Novos profissionais a classificar (${classificarNovos.length})`);
for (const r of classificarNovos) console.log(`  ${r.nome} · ${r.convenios.length} convênios`);

console.log(`\nResumo: ${atualizacoes.size} atualização(ões), ${registrosNovos.length} inserção(ões).`);

if (dryRun) {
  console.log("\nNada foi gravado (--dry-run).");
  process.exit(0);
}

// ------------------------------------------------------------------- gravação

let ok = 0;
for (const [id, campos] of atualizacoes) {
  const { error: e } = await sb.from("corpo_clinico").update(campos).eq("id", id);
  if (e) { console.error(`Erro ao atualizar ${id}:`, e.message); process.exit(1); }
  ok++;
}
console.log(`\n✓ ${ok} registro(s) atualizado(s).`);

if (registrosNovos.length) {
  const { data: inseridos, error: e } = await sb.from("corpo_clinico").insert(registrosNovos).select("id,nome");
  if (e) { console.error("Erro ao inserir novos profissionais:", e.message); process.exit(1); }
  console.log(`✓ ${inseridos?.length ?? registrosNovos.length} profissional(is) inserido(s).`);

  // Registro para desfazer, se preciso: delete from corpo_clinico where id in (...)
  const arquivo = `scripts/tmp/inseridos-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(arquivo, JSON.stringify(inseridos, null, 2));
  console.log(`  IDs gravados em ${arquivo} (para desfazer, se necessário).`);
}
