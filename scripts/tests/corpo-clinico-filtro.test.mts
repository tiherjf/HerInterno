import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { filtrarProfissionais, conveniosQueCasam, agruparPorGrupo, iniciais } = await import(
  pathToFileURL(path.resolve("lib/corpo-clinico/filtro.ts")).href
);

const base = {
  especialidade: "", observacoes: null, sem_agenda: false, agenda: null,
  valor_particular: null, valor_convenio: null, valor_desconto: null,
  idade_minima: null, local: null, subespecialidade: null,
};
const A = { ...base, id: "a", nome: "Dra. Thais Moreira", grupo: "Dermatologia", especialidade: "Dermatologia", unidade: "Hospital", convenios: ["UNIMED JF", "PMMG"], dias: "Seg/Qua", horarios: "08:00 às 12:00" };
const B = { ...base, id: "b", nome: "Dr. Ricardo Campos", grupo: "Dermatologia", unidade: "Hospital", convenios: null, dias: "Seg", horarios: "14:00 às 18:00" };
const C = { ...base, id: "c", nome: "Dra. Ana Lima", grupo: "Pediatria", unidade: "Clínica da Criança", convenios: ["UNIMED INTERCÂMBIO"], dias: "Ter", horarios: "08:00 às 11:00" };
const D = { ...base, id: "d", nome: "Dr. Paulo Reis", grupo: "Cardiologia", unidade: "Hospital", convenios: ["AMIL"], dias: "Sex", horarios: "08:00 às 12:00" };
const E = { ...base, id: "e", nome: "Dr. Elias Nunes", grupo: "Cardiologia", unidade: "Hospital", convenios: [""], dias: "Qui", horarios: "08:00 às 12:00" };
const L = [A, B, C, D, E];
const F = { busca: "", convenio: "", unidade: null, grupo: null, hoje: false, turnos: [] };
const SEG = 1;
type P = { nome: string };
const nomes = (x: P[]) => x.map((p) => p.nome);

let r = filtrarProfissionais(L, { ...F, convenio: "unimed" }, SEG);
assert.deepEqual(nomes(r.principais), ["Dra. Thais Moreira", "Dra. Ana Lima"]);
assert.deepEqual(nomes(r.naoInformado), ["Dr. Ricardo Campos", "Dr. Elias Nunes"]);

r = filtrarProfissionais(L, { ...F, convenio: "intercambio" }, SEG); // sem acento
assert.deepEqual(nomes(r.principais), ["Dra. Ana Lima"]);

r = filtrarProfissionais(L, { ...F, busca: "unimed" }, SEG); // busca continua olhando convênios
assert.deepEqual(nomes(r.principais), ["Dra. Thais Moreira", "Dra. Ana Lima"]);
assert.deepEqual(r.naoInformado, []);

r = filtrarProfissionais(L, { ...F, convenio: "unimed", unidade: "Hospital", turnos: ["manha"] }, SEG);
assert.deepEqual([nomes(r.principais), nomes(r.naoInformado)], [["Dra. Thais Moreira"], ["Dr. Elias Nunes"]]); // B é tarde; E (sem convênio) atende de manhã

r = filtrarProfissionais(L, { ...F, hoje: true }, SEG);
assert.deepEqual(nomes(r.principais), ["Dra. Thais Moreira", "Dr. Ricardo Campos"]);

r = filtrarProfissionais(L, { ...F, grupo: "Cardiologia", convenio: "amil" }, SEG);
assert.deepEqual([nomes(r.principais), nomes(r.naoInformado)], [["Dr. Paulo Reis"], ["Dr. Elias Nunes"]]);

r = filtrarProfissionais(L, F, SEG); // sem filtro: tudo, na ordem de entrada
assert.deepEqual(nomes(r.principais), nomes(L));

assert.deepEqual(conveniosQueCasam(A, "unimed"), ["UNIMED JF"]);
assert.deepEqual(conveniosQueCasam(A, " "), []);
assert.deepEqual(conveniosQueCasam(B, "unimed"), []);
assert.deepEqual(agruparPorGrupo([A, C, B]).map((g: { grupo: string; itens: P[] }) => [g.grupo, g.itens.length]), [["Dermatologia", 2], ["Pediatria", 1]]);
assert.equal(iniciais("Dra. Thais Moreira"), "TM");
assert.equal(iniciais("Dr. Pedro"), "P");
assert.equal(iniciais("João da Silva"), "JS");
assert.equal(iniciais("  "), "");

console.log("corpo-clinico-filtro ok");
