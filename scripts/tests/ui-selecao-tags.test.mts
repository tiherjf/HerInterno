import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const imp = (f: string) => import(pathToFileURL(path.resolve(f)).href);
const { selecaoValida } = await imp("lib/ui/selecao.ts");
const { adicionarTags } = await imp("lib/ui/tags.ts");

assert.equal(selecaoValida(["a", "b"], "b"), "b");
assert.equal(selecaoValida(["a", "b"], "z"), "a");
assert.equal(selecaoValida([], "a"), null);
assert.equal(selecaoValida(["a"], null), "a");

assert.deepEqual(adicionarTags(["UNIMED JF"], " Amil, unimed jf ,, PMMG"), ["UNIMED JF", "Amil", "PMMG"]);
assert.deepEqual(adicionarTags([], "Saúde Caixa, SAUDE CAIXA"), ["Saúde Caixa"]);
assert.deepEqual(adicionarTags(["A"], "  "), ["A"]);

console.log("ui-selecao-tags ok");
