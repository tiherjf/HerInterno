import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { FORM_PROC_VAZIO, formDeProcedimento, payloadProcedimento, validarFormProc } = await import(
  pathToFileURL(path.resolve("lib/procedimentos/form.ts")).href
);

const P = {
  id: "x", nome: "Peeling", tipo: "procedimento", unidade: "Hospital", descricao: null, preparacao: " ", ativo: true,
  order_num: 0, categoria: "Peeling", preco: 450, unidade_medida: "sessão", protocolo: null, profissional: null,
  convenios: ["A", "B"], atende_particular: null, parcelas_max: 3, pacote_sessoes: 3, pacote_preco: 1200,
  jejum_horas: null, requer_agendamento: null, duracao_min: 40, documentos_necessarios: null,
  suspende_medicacao: null, medicos: ["X"], dias: null, horarios: null,
};

const f = formDeProcedimento(P);
assert.equal(f.convenios, "A, B");
assert.equal(f.medicos, "X");
assert.equal(f.atende_particular, true); // null vira true, como antes
assert.equal(f.requer_agendamento, false);

const b = payloadProcedimento(f);
assert.deepEqual(
  [b.nome, b.tipo, b.unidade, b.convenios, b.medicos, b.descricao, b.preparacao, b.categoria, b.preco, b.parcelas_max, b.pacote_preco, b.duracao_min, b.dias],
  ["Peeling", "procedimento", "Hospital", "A, B", "X", null, null, "Peeling", 450, 3, 1200, 40, null],
);
assert.deepEqual(
  Object.keys(b).sort(),
  ["atende_particular", "categoria", "convenios", "descricao", "dias", "documentos_necessarios", "duracao_min", "horarios",
   "jejum_horas", "medicos", "nome", "pacote_preco", "pacote_sessoes", "parcelas_max", "preco", "preparacao", "profissional",
   "protocolo", "requer_agendamento", "suspende_medicacao", "tipo", "unidade", "unidade_medida"],
);

assert.equal(FORM_PROC_VAZIO.tipo, "exame");
assert.equal(FORM_PROC_VAZIO.unidade, "Hospital");
assert.equal(FORM_PROC_VAZIO.atende_particular, true);
assert.equal(validarFormProc({ ...FORM_PROC_VAZIO, nome: " " }), "Nome e unidade são obrigatórios.");
assert.equal(validarFormProc({ ...FORM_PROC_VAZIO, nome: "X" }), null);

console.log("procedimentos-form ok");
