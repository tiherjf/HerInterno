import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const {
  resumirConversas, ordenarConversas, filtrarConversas, filtrarPessoas,
  agruparPorSetor, urgentePendente, alvoDoLink,
} = await import(pathToFileURL(path.resolve("lib/chat-interno/conversas.ts")).href);

const EU = "eu";
const msg = (id: string, de: string, para: string, hora: string, extra: Record<string, unknown> = {}) => ({
  id, sender_id: de, recipient_id: para, content: id, created_at: `2026-11-13T${hora}:00Z`, read_at: null, ...extra,
});

// ─── resumirConversas (linhas em ordem decrescente) ──────────
{
  const rows = [
    msg("x3", "x", EU, "12:00"),
    msg("y1", EU, "y", "11:30"),
    msg("x2", EU, "x", "11:00"),
    msg("x1", "x", EU, "10:00", { read_at: "2026-11-13T10:01:00Z" }),
  ];
  const r = resumirConversas(rows, EU);
  assert.equal(r.length, 2);
  const x = r.find((c: { with: string }) => c.with === "x");
  assert.equal(x.last_message.id, "x3");
  assert.equal(x.unread, 1); // só recebida sem read_at
  assert.equal(x.urgente, false);
  const y = r.find((c: { with: string }) => c.with === "y");
  assert.equal(y.unread, 0); // enviada por mim não conta
}
{
  // urgente: recebida não lida com urgent → true; já lida → false; sem coluna (040) → false
  assert.equal(resumirConversas([msg("a", "x", EU, "10:00", { urgent: true })], EU)[0].urgente, true);
  assert.equal(resumirConversas([msg("a", "x", EU, "10:00", { urgent: true, read_at: "2026-11-13T10:05:00Z" })], EU)[0].urgente, false);
  assert.equal(resumirConversas([msg("a", "x", EU, "10:00")], EU)[0].urgente, false);
  assert.equal(resumirConversas([msg("a", EU, "x", "10:00", { urgent: true })], EU)[0].urgente, false); // urgente enviado por mim
}

// ─── ordenarConversas ─────────────────────────────────────────
{
  const c = (w: string, hora: string, urgente = false) => ({ with: w, last_message: msg(w, w, EU, hora), unread: 0, urgente });
  const ord = ordenarConversas([c("b", "13:00"), c("a", "12:00", true), c("c", "14:00")]);
  assert.deepEqual(ord.map((x: { with: string }) => x.with), ["a", "c", "b"]);
}

// ─── Pessoas ──────────────────────────────────────────────────
const pessoa = (id: string, full_name: string, sector: string | null, phone_ext: string | null = null) =>
  ({ id, full_name, sector, role: "recepcao", phone_ext });
const dir = [
  pessoa(EU, "Eu Mesmo", "Recepção", "4000"),
  pessoa("a", "Ana Souza", "Recepção", "4821"),
  pessoa("b", "Bruno Reis", "Enfermagem", null),
  pessoa("c", "Cíntia Faria", null),
  pessoa("d", "Davi Lima", "  "),
];

{
  const nomes = (l: { full_name: string }[]) => l.map((p) => p.full_name);
  assert.deepEqual(nomes(filtrarPessoas(dir, "recepçao", EU)), ["Ana Souza"]);
  assert.deepEqual(nomes(filtrarPessoas(dir, "RECEPÇÃO", EU)), ["Ana Souza"]);
  assert.deepEqual(nomes(filtrarPessoas(dir, "4821", EU)), ["Ana Souza"]);
  assert.deepEqual(nomes(filtrarPessoas(dir, "48", EU)), ["Ana Souza"]);
  assert.deepEqual(nomes(filtrarPessoas(dir, "cintia", EU)), ["Cíntia Faria"]);
  assert.equal(filtrarPessoas(dir, "", EU).length, 4); // o próprio nunca aparece
  assert.equal(filtrarPessoas(dir, "  ", EU).length, 4);
}

{
  const online = new Set(["b", "d"]);
  const g = agruparPorSetor(filtrarPessoas(dir, "", EU), (id: string) => online.has(id));
  assert.deepEqual(g.map((x: { setor: string }) => x.setor), ["Enfermagem", "Recepção", "Sem setor"]);
  const sem = g.find((x: { setor: string }) => x.setor === "Sem setor");
  assert.deepEqual(sem.membros.map((p: { id: string }) => p.id), ["d", "c"]); // online antes de offline
  assert.equal(sem.online, 1);
}

// ─── filtrarConversas ────────────────────────────────────────
{
  const mapa = new Map(dir.map((p) => [p.id, p]));
  const c = (w: string) => ({ with: w, last_message: msg(w, w, EU, "10:00"), unread: 0, urgente: false });
  assert.deepEqual(filtrarConversas([c("a"), c("z"), c("b")], mapa, "").map((x: { with: string }) => x.with), ["a", "b"]);
  assert.deepEqual(filtrarConversas([c("a"), c("b")], mapa, "BRUNO").map((x: { with: string }) => x.with), ["b"]);
}

// ─── urgentePendente ─────────────────────────────────────────
{
  const u = (id: string, hora: string) => msg(id, "x", EU, hora, { urgent: true, urgent_reason: "motivo" });
  assert.equal(urgentePendente([u("u1", "10:00"), msg("m", EU, "x", "10:05")], EU), null);
  assert.equal(urgentePendente([msg("m", EU, "x", "09:00"), u("u1", "10:00"), u("u2", "10:10")], EU).id, "u2");
  assert.equal(urgentePendente([msg("n", "x", EU, "10:00")], EU), null);
  assert.equal(urgentePendente([], EU), null);
}

// ─── alvoDoLink ──────────────────────────────────────────────
{
  assert.equal(alvoDoLink(EU, dir, EU), null);
  assert.equal(alvoDoLink("zzz", dir, EU), null);
  assert.equal(alvoDoLink(undefined, dir, EU), null);
  assert.equal(alvoDoLink(["a", "b"], dir, EU).id, "a");
  assert.equal(alvoDoLink("b", dir, EU).full_name, "Bruno Reis");
}

console.log("chat-conversas: ok");
