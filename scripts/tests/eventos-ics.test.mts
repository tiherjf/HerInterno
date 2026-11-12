import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { buildIcs } = await import(pathToFileURL(path.resolve("lib/eventos/ics.ts")).href);

const ics: string = buildIcs(
  {
    id: "e1",
    title: "NR-32, módulo 1; parte A",
    description: "Linha 1\nLinha 2",
    location: "Auditório",
    meeting_link: null,
    event_date: "2026-11-14T17:00:00Z",
  },
  "https://x/intranet/eventos/e1",
  new Date("2026-11-11T15:00:00Z")
);
assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
assert.ok(ics.includes("\r\nDTSTART:20261114T170000Z\r\n"));
assert.ok(ics.includes("\r\nDTEND:20261114T180000Z\r\n"));
assert.ok(ics.includes("\r\nDTSTAMP:20261111T150000Z\r\n"));
assert.ok(ics.includes("SUMMARY:NR-32\\, módulo 1\\; parte A"));
assert.ok(ics.includes("DESCRIPTION:Linha 1\\nLinha 2"));
assert.ok(ics.includes("LOCATION:Auditório"));
assert.ok(ics.includes("UID:e1@intranet-her"));
assert.ok(ics.includes("URL:https://x/intranet/eventos/e1"));
assert.ok(!/[^\r]\n/.test(ics), "toda quebra de linha deve ser CRLF");
assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));

// Evento online: sem local, o link da reunião vira o LOCATION e entra na descrição
const online: string = buildIcs(
  { id: "e2", title: "Palestra", description: null, location: null, meeting_link: "https://meet/x", event_date: "2026-11-14T17:00:00Z" },
  "https://x/intranet/eventos/e2",
  new Date("2026-11-11T15:00:00Z")
);
assert.ok(online.includes("LOCATION:https://meet/x"));
assert.ok(/DESCRIPTION:.*https:\/\/meet\/x/.test(online));
// Barra invertida também é escapada
const bs: string = buildIcs(
  { id: "e3", title: "a\\b", description: null, location: null, meeting_link: null, event_date: "2026-11-14T17:00:00Z" },
  "u",
  new Date("2026-11-11T15:00:00Z")
);
assert.ok(bs.includes("SUMMARY:a\\\\b"));

console.log("eventos-ics ok");
