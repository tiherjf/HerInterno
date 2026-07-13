/**
 * Popula a tabela `procedimentos` com a tabela de preços da Dermatologia
 * (Dra. Thais e Dra. Jessica). Todos os itens: tipo="procedimento",
 * unidade="Hospital", ativo=true. order_num sequencial preservando a ordem.
 *
 * Requer a migração 043 aplicada (colunas categoria/preco/unidade_medida/
 * protocolo/profissional). Idempotente: se já houver itens desta equipe,
 * avisa e não insere — use `--force` para inserir mesmo assim.
 *
 * Uso: node scripts/seed-procedimentos-dermato.mjs [--force]
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

const PROFISSIONAL = "Dra. Thais e Dra. Jessica";
const forcar = process.argv.includes("--force");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// [categoria, nome, preco (reais), unidade_medida, protocolo]
const ITENS = [
  ["Peeling", "Peeling facial", 450, "sessão", "Protocolo 3 sessões: R$ 1.200,00"],
  ["Peeling", "Peeling corporal", 450, "sessão", "Protocolo 3 sessões: R$ 1.200,00"],
  ["Peeling", "Peeling médio", 700, "sessão", null],

  ["Microagulhamento robótico – AMIEA MED", "Face", 1000, "sessão", "Protocolo 3 sessões: R$ 2.800,00"],
  ["Microagulhamento robótico – AMIEA MED", "Cicatriz de acne", 1000, "sessão", "Protocolo 3 sessões: R$ 2.800,00"],
  ["Microagulhamento robótico – AMIEA MED", "Couro cabeludo", 650, "sessão", "Protocolo 3 sessões: R$ 1.800,00"],

  ["Microagulhamento robótico – AMIEA MED + PDRN", "Face", 1400, "sessão", "Protocolo 3 sessões: R$ 3.900,00"],
  ["Microagulhamento robótico – AMIEA MED + PDRN", "Face + Pescoço", 1800, "sessão", "Protocolo 3 sessões: R$ 4.900,00"],
  ["Microagulhamento robótico – AMIEA MED + PDRN", "Face + Pescoço + Colo", 2100, "sessão", "Protocolo 3 sessões: R$ 5.800,00"],
  ["Microagulhamento robótico – AMIEA MED + PDRN", "Estrias", 1300, "sessão", null],

  ["Mesoterapia e corporais", "Mesoterapia", 450, "sessão", "Protocolo 3 sessões: R$ 1.200,00"],
  ["Mesoterapia e corporais", "Lipo enzimática", 450, "ampola", "Protocolo 3 ampolas: R$ 1.200,00"],
  ["Mesoterapia e corporais", "Emptiers", 800, "sessão", "Protocolo 3 sessões: R$ 2.100,00"],

  ["Toxina botulínica (Botox)", "Terço superior (testa e olhos)", 1300, null, "Parcelado em até 6x"],
  ["Toxina botulínica (Botox)", "Terço superior (testa e olhos) — Homem", 1400, null, "Parcelado em até 6x"],
  ["Toxina botulínica (Botox)", "Face total", 1800, null, "Parcelado em até 6x"],
  ["Toxina botulínica (Botox)", "Hiperidrose", 2000, null, "Parcelado em até 6x"],
  ["Toxina botulínica (Botox)", "Enxaqueca", 2000, null, "Parcelado em até 6x"],

  ["Preenchimento (Ácido Hialurônico)", "1 seringa", 1700, null, "Parcelado em até 6x"],
  ["Preenchimento (Ácido Hialurônico)", "2 seringas", 2900, null, "Parcelado em até 6x"],
  ["Preenchimento (Ácido Hialurônico)", "3 seringas", 4100, null, "Parcelado em até 6x"],
  ["Preenchimento (Ácido Hialurônico)", "4 seringas", 5300, null, "Parcelado em até 6x"],

  ["Bioestimulador de colágeno", "Radiesse", 2300, "seringa/sessão", "Protocolo 3 sessões: 6x R$ 1.100,00 ou R$ 6.600,00"],
  ["Bioestimulador de colágeno", "Sculptra", 2500, "frasco/sessão", "Protocolo 3 sessões: 6x R$ 1.200,00 ou R$ 7.200,00"],

  ["Curetagem / Shaving / Cauterização química", "Até 5 lesões", 450, null, null],
  ["Curetagem / Shaving / Cauterização química", "Mais de 5 lesões", 560, null, null],

  ["Procedimentos cirúrgicos e outros", "Eletrocauterização (eletrocoagulação)", 560, null, null],
  ["Procedimentos cirúrgicos e outros", "Exérese de Siringoma / Acrocórdon", 560, null, null],
  ["Procedimentos cirúrgicos e outros", "Infiltração intralesional", 450, "sessão", "Protocolo 3 sessões: R$ 1.100,00"],
  ["Procedimentos cirúrgicos e outros", "Incisão e drenagem de abscesso", 450, null, null],
  ["Procedimentos cirúrgicos e outros", "Biópsia", 640, null, null],
  ["Procedimentos cirúrgicos e outros", "Cantoplastia ungueal", 1300, null, null],
  ["Procedimentos cirúrgicos e outros", "Exérese e sutura simples de pequena lesão", 990, null, null],
  ["Procedimentos cirúrgicos e outros", "Exérese de tumor ou cisto", 1300, null, null],
  ["Procedimentos cirúrgicos e outros", "Curativo", 200, null, null],
  ["Procedimentos cirúrgicos e outros", "Centro cirúrgico — anestesia local sem sedação (adicional)", 655, null, "Valor adicional ao procedimento"],
];

const rows = ITENS.map(([categoria, nome, preco, unidade_medida, protocolo], i) => ({
  nome,
  tipo: "procedimento",
  unidade: "Hospital",
  categoria,
  preco,
  unidade_medida,
  protocolo,
  profissional: PROFISSIONAL,
  ativo: true,
  order_num: i + 1,
}));

// Idempotência: verifica se a tabela desta equipe já foi populada
const { count, error: countErr } = await sb
  .from("procedimentos")
  .select("id", { count: "exact", head: true })
  .eq("unidade", "Hospital")
  .eq("profissional", PROFISSIONAL);

if (countErr) {
  console.error("Erro ao verificar itens existentes:", countErr.message);
  process.exit(1);
}

if ((count ?? 0) > 0 && !forcar) {
  console.warn(
    `⚠ Já existem ${count} item(ns) de "${PROFISSIONAL}" na unidade Hospital. ` +
    "Nada foi inserido (idempotente). Use --force para inserir mesmo assim."
  );
  process.exit(0);
}

const { data, error } = await sb.from("procedimentos").insert(rows).select("id");

if (error) {
  console.error("Erro ao inserir procedimentos:", error.message);
  process.exit(1);
}

console.log(`✓ ${data?.length ?? rows.length} procedimento(s) de dermatologia inserido(s).`);
