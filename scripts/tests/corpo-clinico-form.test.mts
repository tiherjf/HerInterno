import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { FORM_CC_VAZIO, formDeProfissional, validarFormCC, payloadProfissional } = await import(
  pathToFileURL(path.resolve("lib/corpo-clinico/form.ts")).href
);

const P = {
  id: "p1", nome: "Dra. Thais", especialidade: "Dermatologia", grupo: "Dermatologia", unidade: "Hospital",
  dias: "—", horarios: "—", observacoes: null, sem_agenda: false, agenda: null,
  valor_particular: 350, valor_convenio: null, valor_desconto: null, convenios: ["UNIMED JF"],
  idade_minima: null, local: null, subespecialidade: null,
};

// Cadastro antigo (texto livre) salvo sem mexer na agenda: mantém dias/horários e não manda agenda
const antigo = { ...P, agenda: null, dias: "Seg/Qua", horarios: "08:00 às 12:00" };
let body = payloadProfissional(formDeProfissional(antigo), antigo);
assert.equal(body.dias, "Seg/Qua");
assert.equal(body.horarios, "08:00 às 12:00");
assert.ok(!("agenda" in body));
assert.equal(body.valor_particular, 350);
assert.deepEqual(body.convenios, ["UNIMED JF"]);
assert.equal(body.observacoes, null);
assert.equal(body.local, null);

// "—" vira campo vazio no formulário
assert.equal(formDeProfissional(P).dias, "");

// Agenda estruturada: uma faixa por dia (a primeira)
const comAgenda = { ...P, agenda: [{ dia: 1, inicio: "08:00", fim: "12:00" }, { dia: 1, inicio: "14:00", fim: "18:00" }] };
const f = formDeProfissional(comAgenda);
assert.deepEqual(f.agenda, [{ dia: 1, inicio: "08:00", fim: "12:00" }]);
body = payloadProfissional(f, comAgenda);
assert.deepEqual(body.agenda, [{ dia: 1, inicio: "08:00", fim: "12:00" }]);
assert.ok(!("dias" in body));

// Tirou toda a agenda de quem tinha: limpa a coluna e volta aos textos "—"
body = payloadProfissional({ ...f, agenda: [] }, comAgenda);
assert.equal(body.agenda, null);
assert.equal(body.dias, "—");
assert.equal(body.horarios, "—");

// Novo com grupo novo e sem agenda liberada
body = payloadProfissional(
  { ...FORM_CC_VAZIO, nome: " X ", especialidade: "Y", grupo: "__novo__", grupo_novo: " Novo ", sem_agenda: true, convenios: [" A ", ""] },
  undefined,
);
assert.deepEqual(
  [body.nome, body.grupo, body.dias, body.horarios, body.convenios, body.unidade, body.sem_agenda],
  ["X", "Novo", "—", "—", ["A"], "Clínica da Criança", true],
);

assert.equal(FORM_CC_VAZIO.unidade, "Clínica da Criança");
assert.equal(validarFormCC({ ...FORM_CC_VAZIO, nome: "X" }), "Nome, especialidade e grupo são obrigatórios.");
assert.equal(validarFormCC({ ...FORM_CC_VAZIO, nome: "X", especialidade: "Y", grupo: "__novo__", grupo_novo: " " }), "Nome, especialidade e grupo são obrigatórios.");
assert.equal(
  validarFormCC({ ...FORM_CC_VAZIO, nome: "X", especialidade: "Y", grupo: "G", agenda: [{ dia: 1, inicio: "12:00", fim: "08:00" }] }),
  "Agenda: o horário de início deve ser antes do fim em todos os dias.",
);
// Agenda inválida não importa quando "ainda não liberou horário"
assert.equal(validarFormCC({ ...FORM_CC_VAZIO, nome: "X", especialidade: "Y", grupo: "G", sem_agenda: true, agenda: [{ dia: 1, inicio: "12:00", fim: "08:00" }] }), null);
assert.equal(validarFormCC({ ...FORM_CC_VAZIO, nome: "X", especialidade: "Y", grupo: "G" }), null);

console.log("corpo-clinico-form ok");
