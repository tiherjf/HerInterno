import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { filtrarRamais, temNumero } = await import(pathToFileURL(path.resolve("lib/ramais/filtro.ts")).href);

const ramal = (id: string, setor_id: string, numero: string, descricao: string, favorito = false) =>
  ({ id, setor_id, numero, descricao, order_index: 0, favorito });
const s = [
  { id: "s1", name: "Térreo", icon: "", color: "blue", order_index: 0,
    ramais: [ramal("r1", "s1", "4912", "Recepção Térreo", true), ramal("r2", "s1", "N/A", "Portaria")] },
  { id: "s2", name: "1º Andar", icon: "", color: "blue", order_index: 1,
    ramais: [ramal("r3", "s2", "4936", "TI (Alexandre)")] },
];
type S = { name: string; ramais: { numero: string }[] };
const ids = (r: S[]) => r.flatMap((x) => x.ramais.map((y) => y.numero));

// Pelo nome do setor, sem acento
assert.deepEqual(ids(filtrarRamais(s, { busca: "terreo", setorId: null, apenasFavoritos: false })), ["4912", "N/A"]);
assert.deepEqual(ids(filtrarRamais(s, { busca: "RECEPÇÃO", setorId: null, apenasFavoritos: false })), ["4912"]);
assert.deepEqual(ids(filtrarRamais(s, { busca: "recepcao", setorId: null, apenasFavoritos: false })), ["4912"]);
assert.deepEqual(ids(filtrarRamais(s, { busca: "49", setorId: null, apenasFavoritos: true })), ["4912"]);
assert.deepEqual(filtrarRamais(s, { busca: "", setorId: "s2", apenasFavoritos: false }).map((x: S) => x.name), ["1º Andar"]);
assert.deepEqual(filtrarRamais(s, { busca: "zzz", setorId: null, apenasFavoritos: false }), []);
assert.deepEqual(ids(filtrarRamais(s, { busca: "  ", setorId: null, apenasFavoritos: false })), ["4912", "N/A", "4936"]);

assert.equal(temNumero("N/A"), false);
assert.equal(temNumero(" "), false);
assert.equal(temNumero(""), false);
assert.equal(temNumero("4912"), true);

console.log("ramais-filtro ok");
