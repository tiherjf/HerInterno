import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { urgentePendente } = await import(pathToFileURL(path.resolve("lib/chat-interno/conversas.ts")).href);

const EU = "eu";
const urg = (id: string, hora: string, read_at: string | null) => ({
  id, sender_id: "x", recipient_id: EU, content: id, created_at: `2026-11-13T${hora}:00Z`, read_at,
  urgent: true, urgent_reason: "motivo",
});

// Urgente já lido (conversa reaberta, recarga da página): não volta a faixa
assert.equal(urgentePendente([urg("u1", "10:00", "2026-11-13T10:01:00Z")], EU), null);
// Urgente não lido continua gerando a faixa
assert.equal(urgentePendente([urg("u1", "10:00", null)], EU).id, "u1");
// O mais recente já lido, um anterior não lido: o lido encerra (a pessoa já viu a conversa depois)
assert.equal(urgentePendente([urg("u1", "10:00", null), urg("u2", "10:10", "2026-11-13T10:11:00Z")], EU), null);

console.log("revisao-chat-a: ok");
