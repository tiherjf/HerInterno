import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { greetingFor, formatLongDatePtBR, birthdaysOfMonth } = await import(
  pathToFileURL(path.resolve("lib/home/greeting.ts")).href
);

// Horário de Brasília, mesmo com o servidor em UTC
assert.equal(greetingFor(new Date("2026-11-11T02:30:00Z")), "Boa noite"); // 23h30 SP
assert.equal(greetingFor(new Date("2026-11-11T08:00:00Z")), "Bom dia");   // 05h SP
assert.equal(greetingFor(new Date("2026-11-11T15:00:00Z")), "Boa tarde"); // 12h SP
assert.equal(greetingFor(new Date("2026-11-11T21:00:00Z")), "Boa noite"); // 18h SP
assert.equal(greetingFor(new Date("2026-11-11T07:59:00Z")), "Boa noite"); // 04h59 SP

assert.equal(formatLongDatePtBR(new Date("2026-11-11T15:00:00Z")), "quarta-feira, 11 de novembro");

const people = [
  { id: "a", full_name: "Ana", avatar_url: null, birth_date: "1990-11-11" },
  { id: "b", full_name: "Bia", avatar_url: null, birth_date: "1985-11-03" },
  { id: "c", full_name: "Caio", avatar_url: null, birth_date: "1992-12-11" },
  { id: "d", full_name: "Dani", avatar_url: null, birth_date: null },
  { id: "e", full_name: "Edu", avatar_url: null, birth_date: "lixo" },
];
const res = birthdaysOfMonth(people, new Date("2026-11-11T15:00:00Z"));
assert.deepEqual(res.map((r: { id: string }) => r.id), ["b", "a"]);
assert.equal(res[1].isToday, true);
assert.equal(res[0].isToday, false);
assert.equal(res[0].day, 3);
// Nunca expõe o ano
assert.equal("birth_date" in res[0], false);
assert.deepEqual(birthdaysOfMonth([], new Date()), []);
// Virada de mês em SP: 01/12 00h30 SP = 03h30 UTC → mês de dezembro
assert.deepEqual(
  birthdaysOfMonth(people, new Date("2026-12-01T03:30:00Z")).map((r: { id: string }) => r.id),
  ["c"]
);
console.log("greeting: ok");
