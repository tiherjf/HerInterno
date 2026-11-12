import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { relativeDaysLabel, groupByMonth } = await import(
  pathToFileURL(path.resolve("lib/eventos/dates.ts")).href
);

const now = new Date("2026-11-11T15:00:00Z"); // 12h SP
assert.equal(relativeDaysLabel("2026-11-12T01:30:00Z", now), "hoje"); // 22h30 SP do dia 11
assert.equal(relativeDaysLabel("2026-11-12T03:30:00Z", now), "amanhã"); // 00h30 SP do dia 12
assert.equal(relativeDaysLabel("2026-11-14T17:00:00Z", now), "em 3 dias");
assert.equal(relativeDaysLabel("2026-12-11T17:00:00Z", now), "em 30 dias");
assert.equal(relativeDaysLabel("2026-12-12T17:00:00Z", now), null);
assert.equal(relativeDaysLabel("2026-11-10T17:00:00Z", now), null);

const g = groupByMonth([
  { event_date: "2026-11-14T17:00:00Z" },
  { event_date: "2026-11-21T13:00:00Z" },
  { event_date: "2026-12-18T22:00:00Z" },
  { event_date: "2027-01-05T13:00:00Z" },
]);
assert.deepEqual(
  g.map((x: { key: string; label: string; items: unknown[] }) => [x.key, x.label, x.items.length]),
  [["2026-11", "novembro", 2], ["2026-12", "dezembro", 1], ["2027-01", "janeiro de 2027", 1]]
);
assert.equal(groupByMonth([{ event_date: "2026-12-01T02:00:00Z" }])[0].key, "2026-11"); // 23h SP de 30/11
assert.deepEqual(groupByMonth([]), []);

console.log("eventos-dates ok");
