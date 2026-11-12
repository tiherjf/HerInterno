import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const imp = (f: string) => import(pathToFileURL(path.resolve(f)).href);
const { medicosDe, filtrarProcedimentos, agruparPorCategoria, medicosDaUnidade } = await imp("lib/procedimentos/filtro.ts");
const { parcela, economiaPacote, itensPreparo, textoConvenios } = await imp("lib/procedimentos/valores.ts");

const P = {
  id: "x", nome: "X", tipo: "procedimento", unidade: "Hospital", descricao: null, preparacao: null, ativo: true,
  order_num: 0, categoria: null, preco: null, unidade_medida: null, protocolo: null, profissional: null,
  convenios: null, atende_particular: null, parcelas_max: null, pacote_sessoes: null, pacote_preco: null,
  jejum_horas: null, requer_agendamento: null, duracao_min: null, documentos_necessarios: null,
  suspende_medicacao: null, medicos: null, dias: null, horarios: null,
};
const L = [
  { ...P, id: "1", nome: "Peeling facial", categoria: "Peeling", order_num: 1, medicos: ["Dra. Thais", "Dra. Jessica"] },
  { ...P, id: "2", nome: "Botox", categoria: "Toxina", order_num: 5, profissional: "Dr. Pedro" },
  { ...P, id: "3", nome: "Peeling corporal", categoria: "Peeling", order_num: 2, medicos: ["Dra. Thais"] },
  { ...P, id: "4", nome: "Curativo", categoria: null, order_num: 0 },
  { ...P, id: "5", nome: "Hemograma", tipo: "exame", unidade: "Clínica da Criança", categoria: "Exames", medicos: ["Dr. Zé"] },
];
type Proc = { nome: string };
const nomes = (x: Proc[]) => x.map((p) => p.nome);
const F = { busca: "", unidade: null, tipo: null, medico: null };

assert.deepEqual(medicosDe({ ...P, medicos: null, profissional: "Dra. Thais e Dra. Jessica" }), ["Dra. Thais", "Dra. Jessica"]);
assert.deepEqual(medicosDe({ ...P, medicos: ["A"], profissional: "B" }), ["A"]);
assert.deepEqual(medicosDe(P), []);

assert.deepEqual(nomes(filtrarProcedimentos(L, { ...F, busca: "PEELING" })), ["Peeling facial", "Peeling corporal"]);
assert.deepEqual(nomes(filtrarProcedimentos(L, { ...F, busca: "jessica" })), ["Peeling facial"]);
assert.deepEqual(nomes(filtrarProcedimentos(L, { ...F, busca: "pedro" })), ["Botox"]); // legado `profissional`
assert.deepEqual(filtrarProcedimentos(L, { ...F, unidade: "Hospital", tipo: "exame" }), []);
assert.deepEqual(nomes(filtrarProcedimentos(L, { ...F, unidade: null, tipo: "exame" })), ["Hemograma"]);
assert.deepEqual(nomes(filtrarProcedimentos(L, { ...F, medico: "Dra. Thais" })), ["Peeling facial", "Peeling corporal"]);

const g = agruparPorCategoria(L.slice(0, 4));
assert.deepEqual(g.map((x: { categoria: string | null; itens: Proc[] }) => [x.categoria, nomes(x.itens)]), [
  ["Peeling", ["Peeling facial", "Peeling corporal"]],
  ["Toxina", ["Botox"]],
  [null, ["Curativo"]],
]);
assert.deepEqual(medicosDaUnidade(L, "Hospital"), ["Dr. Pedro", "Dra. Jessica", "Dra. Thais"]);
assert.deepEqual(medicosDaUnidade(L, null), ["Dr. Pedro", "Dr. Zé", "Dra. Jessica", "Dra. Thais"]);

assert.equal(parcela({ ...P, preco: 450, parcelas_max: 3 }), 150);
assert.equal(parcela({ ...P, preco: null, parcelas_max: 3 }), null);
assert.equal(parcela({ ...P, preco: 450, parcelas_max: 0 }), null);
assert.equal(economiaPacote({ ...P, preco: 450, pacote_sessoes: 3, pacote_preco: 1200 }), 150);
assert.equal(economiaPacote({ ...P, preco: null, pacote_sessoes: 3, pacote_preco: 1200 }), 0);
assert.equal(economiaPacote({ ...P, preco: 100, pacote_sessoes: 3, pacote_preco: 1200 }), 0);
assert.deepEqual(itensPreparo({ ...P, jejum_horas: 0, requer_agendamento: true }), ["Sem jejum", "Requer agendamento"]);
assert.deepEqual(
  itensPreparo({ ...P, jejum_horas: 8, suspende_medicacao: "AAS", documentos_necessarios: "RG", preparacao: "Vir de roupa leve" }),
  ["Jejum 8h", "Suspender medicação: AAS", "Documentos: RG", "Vir de roupa leve"],
);
assert.deepEqual(itensPreparo(P), []);
assert.deepEqual(textoConvenios({ ...P, convenios: null, atende_particular: true }), ["Somente particular"]);
assert.deepEqual(textoConvenios({ ...P, convenios: ["AMIL"], atende_particular: true }), ["AMIL", "Particular"]);
assert.deepEqual(textoConvenios({ ...P, convenios: ["AMIL"], atende_particular: false }), ["AMIL"]);
assert.deepEqual(textoConvenios(P), []);

console.log("procedimentos-filtro ok");
