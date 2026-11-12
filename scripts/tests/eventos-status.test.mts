import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { eventStatus, isUnlimited } = await import(
  pathToFileURL(path.resolve("lib/eventos/status.ts")).href
);

const now = new Date("2026-11-11T15:00:00Z");
const base = {
  event_date: "2026-11-14T17:00:00Z",
  registration_deadline: null as string | null,
  max_slots: 40 as number | null,
  slots_used: 10,
  is_registered: false,
  on_waitlist: false,
};

assert.equal(eventStatus(base, now), "open");
assert.equal(eventStatus({ ...base, is_registered: true }, now), "registered");
assert.equal(eventStatus({ ...base, on_waitlist: true }, now), "waitlisted");
assert.equal(eventStatus({ ...base, slots_used: 40 }, now), "full");
assert.equal(eventStatus({ ...base, slots_used: 45 }, now), "full");
assert.equal(eventStatus({ ...base, registration_deadline: "2026-11-10T00:00:00Z" }, now), "closed");
// prazo vencido vale mesmo lotado (não dá para entrar na fila)
assert.equal(eventStatus({ ...base, slots_used: 40, registration_deadline: "2026-11-10T00:00:00Z" }, now), "closed");
// inscrito continua "registered" mesmo com prazo vencido (pode ver/cancelar como hoje)
assert.equal(eventStatus({ ...base, is_registered: true, registration_deadline: "2026-11-10T00:00:00Z" }, now), "registered");
// sem limite (null) nunca lota; 0 vagas = lotado, igual à API de inscrição
assert.equal(eventStatus({ ...base, max_slots: null, slots_used: 99 }, now), "open");
assert.equal(eventStatus({ ...base, max_slots: 0, slots_used: 0 }, now), "full");
// evento passado
assert.equal(eventStatus({ ...base, event_date: "2026-11-10T17:00:00Z" }, now), "ended");
assert.equal(eventStatus({ ...base, event_date: "2026-11-10T17:00:00Z", is_registered: true }, now), "participated");

assert.equal(isUnlimited(null), true);
assert.equal(isUnlimited(0), false);
assert.equal(isUnlimited(40), false);

console.log("eventos-status ok");
