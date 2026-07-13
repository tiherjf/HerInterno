/**
 * Popula a tabela `corpo_clinico` com o corpo clínico da unidade Hospital.
 *
 * Para TODAS as linhas: unidade="Hospital", ativo=true, sem_agenda=false,
 * grupo = especialidade (a página agrupa por especialidade), horarios="",
 * order_num sequencial preservando a ordem da lista.
 *
 * Requer a migração 045 aplicada (colunas valor_particular, valor_convenio,
 * valor_desconto, convenios, idade_minima, local, subespecialidade).
 *
 * Idempotente: se já houver alguma linha em corpo_clinico com unidade='Hospital'
 * E local não nulo (ou seja, já populada), avisa e não insere.
 * Use `--force` para inserir mesmo assim.
 *
 * `--dry-run` imprime o que seria inserido (agrupado, legível) SEM gravar.
 *
 * Uso: node scripts/seed-corpo-clinico-hospital.mjs [--dry-run] [--force]
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

// [nome, especialidade, subespecialidade, valor_particular, valor_convenio,
//  valor_desconto, convenios[], idade_minima, dias, local, observacoes]
const MEDICOS = [
  ["Christiane Valente", "Alergologista e Imunologista", null, 330, 225, 310, [], null, "Seg/Ter/Qui", null, null],
  ["Simone Miranda", "Alergologista e Imunologista", null, 330, 225, 310, ["UNIMED"], 2, "Quarta", null, null],
  ["Alexandre de Tarso", "Angiologista / Cirurgião Vascular", null, 500, 225, 250, [], null, "Terça", "2º Andar · Ramal 4983", "Atende na Dermatoplástica"],
  ["Daniel Barleta", "Angiologista / Cirurgião Vascular", null, 290, 225, 240, ["PLASC"], null, "Segunda", "2º Andar · Ramal 4983", null],
  ["Fabiellen Berzoni", "Angiologista / Cirurgião Vascular", null, 250, 225, 240, [], null, "Quarta", "2º Andar · Ramal 4983", null],
  ["Thalis Marcello", "Angiologista / Cirurgião Vascular", null, 290, 225, 240, ["PLASC", "UNIMED"], null, "Quarta", "2º Andar · Ramal 4983", null],
  ["Sergio Janotti", "Buco Maxilo", null, 120, null, null, [], null, "Quarta/Quinta", "Ambulatório · Ramal 4953", null],
  ["Abdo Márcio Hallack", "Cardiologista + ECG", null, 400, 220, 300, [], 10, "Seg/Qua/Qui/Sex", "2º Andar · Ramal 4983", null],
  ["Romulo Teixeira Vidal", "Cardiologista + ECG", null, 400, 220, 300, [], 13, "Terça", "2º Andar · Ramal 4983", null],
  ["Alice Musse", "Cardiologista + ECG", null, 400, 220, 250, [], 18, "Terça", "2º Andar · Ramal 4983", null],
  ["Dra Alice", "Ecocardiograma", null, 250, 220, 200, [], null, null, "3º Andar", "Ecocardiograma"],
  ["Rafael Rena", "Cirurgia Cabeça e Pescoço", null, 400, 150, 350, ["Abertta", "Cemig", "Caixa", "PLASC", "UNIMED"], null, "Sexta", "Ambulatório · Ramal 4953", null],
  ["Matheus Mousinho", "Cirurgia Cabeça e Pescoço", null, 400, 350, 350, [], 3, "Quinta", "Ambulatório · Ramal 4953", "Não atende UNIMED"],
  ["Yuri Miranda", "Cirurgia Geral", null, 400, 330, 330, [], 10, null, null, null],
  ["Felipe Couto", "Cirurgia Geral e Aparelho Digestivo", null, 400, 150, 330, [], null, "Quarta", "Dermatoplástica · Ramal 4997", null],
  ["Renato Gomes", "Cirurgia Geral e Aparelho Digestivo", "Bariátrica", 550, 520, 520, [], null, "Sábado", "Dermatoplástica · Ramal 4997", null],
  ["Carlos Augusto", "Cirurgia Geral e Aparelho Digestivo", "Hérnia, vesícula, lesões de pele, oncológica", 400, 150, 330, [], null, "Terça", "Dermatoplástica · Ramal 4997", null],
  ["Elaine Cugola", "Cirurgião Plástico", null, 400, null, null, [], null, "Terça/Quinta", "Dermatoplástica · Ramal 4997", null],
  ["Rafael Netto", "Cirurgião Plástico", null, 400, null, null, [], null, "Sexta", "Dermatoplástica · Ramal 4997", null],
  ["Rodrigo Toledo", "Cirurgião Plástico", null, 440, 330, 290, [], null, "Segunda", "Dermatoplástica · Ramal 4997", null],
  ["Jade Borborema", "Cirurgião Plástico", null, 400, 330, 330, [], null, "Quinta", "Dermatoplástica · Ramal 4997", null],
  ["Joao Filipe Neto", "Cirurgião Plástico", null, 400, null, null, [], null, "Quarta", "Dermatoplástica · Ramal 4997", null],
  ["Jessica Bissoli", "Dermatologista", null, 400, 330, 330, [], null, "Seg a Sex", "Dermatoplástica · Ramal 4997", null],
  ["Thais Cristina", "Dermatologista", null, 400, 330, 330, [], null, "Seg a Sex", "Dermatoplástica · Ramal 4997", null],
  ["Leticia Cruz", "Dermatologista", null, 400, 330, 330, [], null, "Sábado", "Dermatoplástica · Ramal 4997", null],
  ["Dr Leonardo Ramos", "Otorrino (Dr Leonardo Ramos)", "Otoplastia, septoplastia, rinoplastia funcional e estética", 460, null, null, [], null, null, "Dermatoplástica · Ramal 4997", "Online: R$ 460,00"],
  ["Camila Brandão", "Ginecologia", "Mastologista", 305, 255, null, [], null, null, "2º Andar · Ramal 4983", "Não atende particular com desconto"],
  ["Lorena Furtado", "Ginecologia", null, 305, 250, 255, [], 11, "Terça/Quarta", "2º Andar · Ramal 4983", null],
  ["Lucas Alvim", "Ginecologia", null, 450, 250, 255, ["PLASC"], 13, "Quinta", "2º Andar · Ramal 4983", null],
  ["Daniela Soares", "Ginecologia", null, 360, 250, 255, ["PLASC"], 12, "Sábado", "2º Andar · Ramal 4983", null],
  ["Bruna Matioli", "Ginecologia", null, 350, 250, 255, [], 16, "Quinta", "2º Andar · Ramal 4983", null],
  ["Renan Alexandre", "Gastroenterologista", null, 250, 200, 240, [], 16, "Segunda", "3º Andar · Ramal 4990", "Não atende UNIMED"],
  ["Fabio Condé", "Neurologista", null, 250, 140, 180, [], 16, "Qui/Sex", "Ambulatório · Ramal 4953", "Não atende UNIMED · Atende TDAH"],
  ["Eveline", "Fonoterapia", null, 130, null, null, [], null, null, null, "Valor por sessão"],
  ["Ornella", "Tratamento Labiríntico", null, 195, 160, null, [], null, null, null, "Valor por sessão"],
  ["Leonardo Vilela", "Oftalmologista", null, 470, 370, 390, [], 10, "Seg/Qua/Sex", "3º Andar · Ramal 4990", "Mapeamento e tonometria"],
  ["Leticia Furtado", "Oftalmologista", null, 470, 370, 390, [], 6, "Qui/Sex", "3º Andar · Ramal 4990", "Mapeamento e tonometria"],
  ["Flavio Penna", "Oftalmologista", null, 470, 370, 390, ["PLASC"], 18, "Ter/Qui", "3º Andar · Ramal 4990", "Mapeamento e tonometria"],
  ["Mauro Willian", "Oftalmologista", null, 470, 370, 390, [], 10, "Ter/Qui/Sex", "3º Andar · Ramal 4990", "Mapeamento e tonometria"],
  ["Marcia Alvim", "Oftalmologista", null, 470, 370, 390, ["PLASC"], null, "Ter a Sex", "3º Andar · Ramal 4990", "Todas as idades · Mapeamento e tonometria"],
  ["Igor Reis", "Ortopedista", "Joelho", 450, 305, 305, ["PLASC"], null, "Segunda/Sexta", "3º Andar · Ramal 4990", null],
  ["Rodrigo Loque", "Ortopedista", "Coluna", 360, 305, 305, [], null, "Segunda", "3º Andar · Ramal 4990", null],
  ["Sergio Neto", "Ortopedista", "Bacia / Quadril", 360, 305, 305, [], 16, "Quarta", "3º Andar · Ramal 4990", null],
  ["Gabriel Meirelles", "Ortopedista", "Mão", 360, 305, 305, ["PLASC"], null, "Quarta", "3º Andar · Ramal 4990", null],
  ["Igor Dorze", "Ortopedista", "Ombro", 360, 305, 305, [], 12, "Quinta", "3º Andar · Ramal 4990", null],
  ["Igor Bonato", "Ortopedista", "Pé", 360, 305, 305, [], null, "Sexta", "3º Andar · Ramal 4990", null],
  ["Lucas Favero", "Ortopedista", "Ombro / Cotovelo", 360, 305, 305, [], null, "Sexta", "3º Andar · Ramal 4990", null],
  ["Dr Evandro Ribeiro", "Otorrinos", null, 500, 375, 425, [], null, null, "Ambulatório · Ramal 4953", null],
  ["Equipe Otorrinos", "Otorrinos", null, 390, 140, 330, [], null, null, "Ambulatório · Ramal 4953", null],
  ["Remoção de Cerume", "Otorrinos", null, 80, null, null, [], null, null, "Ambulatório · Ramal 4953", "Valor incluso no particular e no particular com desconto"],
  ["Matheus Rodrigues", "Pré Anestésico", null, 170, 160, 160, [], null, "Segunda", "Ambulatório", null],
  ["Henrique Pimentel", "Pré Anestésico", null, 170, 160, 160, [], null, "Terça", "3º Andar", null],
  ["Leatrice de Castro", "Proctologista", null, 350, 250, 300, [], 12, "Quarta", "2º Andar · Ramal 4983", null],
  ["Guilherme Moreira", "Urologista", null, 400, 225, 300, [], 15, "Seg/Qui", "3º Andar · Ramal 4990", null],
  ["Marcus de Oliveira", "Urologista", null, 400, 225, 330, [], 12, "Quinta", "3º Andar · Ramal 4990", "Consulta a partir de 12 anos; cirurgia a partir de 18 anos"],
];

const rows = MEDICOS.map(
  (
    [nome, especialidade, subespecialidade, valor_particular, valor_convenio, valor_desconto, convenios, idade_minima, dias, local, observacoes],
    i
  ) => ({
    nome,
    especialidade,
    grupo: especialidade,
    unidade: "Hospital",
    dias: dias ?? "",
    horarios: "",
    observacoes,
    sem_agenda: false,
    ativo: true,
    order_num: i + 1,
    valor_particular,
    valor_convenio,
    valor_desconto,
    convenios,
    idade_minima,
    local,
    subespecialidade,
  })
);

if (dryRun) {
  const brl = (v) =>
    v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const grupos = new Map();
  for (const r of rows) {
    if (!grupos.has(r.especialidade)) grupos.set(r.especialidade, []);
    grupos.get(r.especialidade).push(r);
  }
  console.log("=== DRY RUN — corpo_clinico (unidade: Hospital) ===");
  console.log(`Total de linhas que seriam inseridas: ${rows.length}\n`);
  for (const [especialidade, itens] of grupos) {
    console.log(`▸ ${especialidade} (${itens.length})`);
    for (const r of itens) {
      const parts = [
        `  #${r.order_num} ${r.nome}`,
        r.subespecialidade ? `[${r.subespecialidade}]` : null,
        `part=${brl(r.valor_particular)}`,
        `conv=${brl(r.valor_convenio)}`,
        `desc=${brl(r.valor_desconto)}`,
        r.convenios.length ? `convênios=${r.convenios.join(", ")}` : null,
        r.idade_minima != null ? `idade≥${r.idade_minima}` : null,
        r.dias ? `dias=${r.dias}` : null,
        r.local ? `local=${r.local}` : null,
        r.observacoes ? `obs=${r.observacoes}` : null,
      ].filter(Boolean);
      console.log(parts.join(" | "));
    }
    console.log("");
  }
  console.log("Nenhum dado foi gravado (--dry-run).");
  process.exit(0);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Idempotência: já populado se existe linha unidade='Hospital' com local não nulo
const { count, error: countErr } = await sb
  .from("corpo_clinico")
  .select("id", { count: "exact", head: true })
  .eq("unidade", "Hospital")
  .not("local", "is", null);

if (countErr) {
  console.error("Erro ao verificar linhas existentes:", countErr.message);
  process.exit(1);
}

if ((count ?? 0) > 0 && !forcar) {
  console.warn(
    `⚠ Já existem ${count} linha(s) de corpo clínico da unidade Hospital com local preenchido. ` +
      "Nada foi inserido (idempotente). Use --force para inserir mesmo assim."
  );
  process.exit(0);
}

const { data, error } = await sb.from("corpo_clinico").insert(rows).select("id");

if (error) {
  console.error("Erro ao inserir corpo clínico:", error.message);
  process.exit(1);
}

console.log(`✓ ${data?.length ?? rows.length} médico(s)/serviço(s) do Hospital inserido(s).`);
