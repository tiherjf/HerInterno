import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { avisoDeMensagem, podeVerMensagem } = await import(pathToFileURL(path.resolve("lib/chat-interno/aviso.ts")).href);

const row = {
  id: "m1", sender_id: "a", recipient_id: "b", content: "senha 123", created_at: "2026-11-13T12:00:00Z",
  read_at: null, attachment_path: "x/y.pdf", attachment_name: "y.pdf", attachment_size: 10, urgent: true,
  urgent_reason: "paciente", sender_name: "Ana",
};

// O aviso leva só o necessário para o cliente buscar a mensagem — nunca conteúdo
assert.deepEqual(avisoDeMensagem(row), {
  id: "m1", sender_id: "a", recipient_id: "b", created_at: "2026-11-13T12:00:00Z", urgent: true,
});
assert.equal(avisoDeMensagem({ ...row, urgent: undefined }).urgent, false);
assert.equal(avisoDeMensagem({ ...row, urgent: "true" }).urgent, false);
const json = JSON.stringify(avisoDeMensagem(row));
for (const proibido of ["senha", "y.pdf", "paciente", "Ana"]) assert.equal(json.includes(proibido), false, proibido);

// Só remetente e destinatário podem ver a mensagem
assert.equal(podeVerMensagem(row, "a"), true);
assert.equal(podeVerMensagem(row, "b"), true);
assert.equal(podeVerMensagem(row, "c"), false);
assert.equal(podeVerMensagem(row, ""), false);

console.log("chat-aviso: ok");
