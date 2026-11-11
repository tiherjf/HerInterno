import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const mod = await import(pathToFileURL(path.resolve("lib/busca/query.ts")).href);
const { normalizeSearchTerm, searchGroupsForMenu } = mod;

// Termos curtos ou vazios não consultam o banco
assert.equal(normalizeSearchTerm("  a "), null);
assert.equal(normalizeSearchTerm(null), null);
assert.equal(normalizeSearchTerm("   "), null);

// Caracteres que quebrariam o or() do PostgREST ou virariam curinga do ilike
assert.equal(normalizeSearchTerm("50%_off"), "50off");
assert.equal(normalizeSearchTerm("uti, (bloco)"), "uti bloco");
assert.equal(normalizeSearchTerm("  Raio   X "), "Raio X");

// Grupos seguem o menu do papel
assert.deepEqual(searchGroupsForMenu(["ramais", "chat"]), ["ramais"]);
assert.deepEqual(searchGroupsForMenu([]), []);

console.log("busca-query: ok");
