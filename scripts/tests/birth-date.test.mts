import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { parseBirthDate } = await import(pathToFileURL(path.resolve("lib/perfil/birth-date.ts")).href);
const now = new Date("2026-11-11T15:00:00Z");

// Campo não enviado: não mexe
assert.equal(parseBirthDate(undefined, now), undefined);
// Apagar a data
assert.equal(parseBirthDate(null, now), null);
assert.equal(parseBirthDate("", now), null);
// Válida
assert.equal(parseBirthDate("1990-11-11", now), "1990-11-11");
// Formato errado, data inexistente, futuro ou absurda → erro
for (const bad of ["11/11/1990", "1990-02-30", "2030-01-01", "1890-05-05", 19901111, "1990-1-1"]) {
  assert.throws(() => parseBirthDate(bad, now), /Data de nascimento inválida/, String(bad));
}
console.log("birth-date: ok");
