import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const imp = (f: string) => import(pathToFileURL(path.resolve(f)).href);
const { termoDaUrl } = await imp("lib/ui/query.ts");
const { fichaCelularValida } = await imp("lib/ui/selecao.ts");
const { limparConvenios, conveniosQueCasam } = await imp("lib/corpo-clinico/filtro.ts");
const { textoConvenios, temValor } = await imp("lib/procedimentos/valores.ts");

// ?q= repetido na URL chega como lista: usa o primeiro, nunca quebra
assert.equal(termoDaUrl("derma"), "derma");
assert.equal(termoDaUrl(["a", "b"]), "a");
assert.equal(termoDaUrl(undefined), "");

// Ficha do celular: fecha quando o item sai da lista (não reabre sozinha depois)
assert.equal(fichaCelularValida(["a", "b"], "b"), "b");
assert.equal(fichaCelularValida(["a"], "b"), null);
assert.equal(fichaCelularValida(["a"], null), null);

// Elementos nulos dentro de convenios (text[] do Postgres) não derrubam a tela
assert.deepEqual(limparConvenios([null, " UNIMED JF ", "", "AMIL"]), ["UNIMED JF", "AMIL"]);
assert.deepEqual(limparConvenios(null), []);
assert.deepEqual(conveniosQueCasam({ convenios: [null, "UNIMED JF"] }, "unimed"), ["UNIMED JF"]);
const P = { convenios: [null, "AMIL"], atende_particular: true, preco: null, parcelas_max: null, pacote_sessoes: null, pacote_preco: null, protocolo: null };
assert.deepEqual(textoConvenios(P), ["AMIL", "Particular"]);

// Parcelamento sem preço continua aparecendo (a tela antiga mostrava)
assert.equal(temValor({ ...P, parcelas_max: 3 }), true);
assert.equal(temValor(P), false);
assert.equal(temValor({ ...P, preco: 0 }), true);

console.log("revisao-etapa3 ok");
