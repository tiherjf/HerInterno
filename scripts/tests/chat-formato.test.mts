import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const {
  foraDoExpediente, formatarDia, formatarHora, chaveDia, formatarBytes, ehImagem, juntarMensagens, iniciais,
} = await import(pathToFileURL(path.resolve("lib/chat-interno/formato.ts")).href);

// Expediente 07h–19h em horário de Brasília (UTC-3)
assert.equal(foraDoExpediente(new Date("2026-11-13T09:59:00Z")), true);  // 06:59
assert.equal(foraDoExpediente(new Date("2026-11-13T10:00:00Z")), false); // 07:00
assert.equal(foraDoExpediente(new Date("2026-11-13T21:59:00Z")), false); // 18:59
assert.equal(foraDoExpediente(new Date("2026-11-13T22:00:00Z")), true);  // 19:00

// Hora e dia em Brasília
assert.equal(formatarHora("2026-11-13T15:07:00Z"), "12:07");
const agora = new Date("2026-11-13T15:00:00Z");
assert.equal(formatarDia("2026-11-13T12:00:00Z", agora), "Hoje");
assert.equal(formatarDia("2026-11-13T02:00:00Z", agora), "Ontem"); // 23:00 do dia 12 em SP
assert.equal(formatarDia("2026-11-10T12:00:00Z", agora), "10/11/2026");
assert.equal(chaveDia("2026-11-13T02:00:00Z"), "2026-11-12");

assert.equal(formatarBytes(0), "");
assert.equal(formatarBytes(null), "");
assert.equal(formatarBytes(500), "500 B");
assert.equal(formatarBytes(1536), "2 KB");
assert.equal(formatarBytes(2.5 * 1024 * 1024), "2.5 MB");

assert.equal(ehImagem("foto.JPG"), true);
assert.equal(ehImagem("doc.pdf"), false);
assert.equal(ehImagem(null), false);

const m = (id: string, t: string) => ({ id, created_at: t });
assert.deepEqual(
  juntarMensagens([m("b", "2026-11-13T10:00:00Z")], [m("a", "2026-11-13T09:00:00Z"), m("b", "2026-11-13T10:00:00Z")]).map((x: { id: string }) => x.id),
  ["a", "b"],
);

assert.equal(iniciais("Ana Maria Souza"), "AS");
assert.equal(iniciais("Bruno"), "B");
assert.equal(iniciais("  "), "");

console.log("chat-formato: ok");
