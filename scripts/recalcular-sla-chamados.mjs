/**
 * Correção pontual: recalcula o sla_deadline dos chamados ABERTOS
 * (status open/in_progress) em HORAS ÚTEIS (seg–sex 08:00–18:00, pulando
 * feriados de ponto_feriados), pois chamados antigos foram calculados em
 * horas corridas.
 *
 * Algoritmo portado de lib/chamados/sla.ts (computeSlaDeadlineCore) e
 * escolha do SLA espelhando o POST de app/api/chamados/route.ts
 * (alteracao_sla_hours quando team marketing + mkt_is_alteracao).
 *
 * Uso: node scripts/recalcular-sla-chamados.mjs
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("Arquivo .env.local não encontrado.");
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---- Horas úteis (portado de lib/chamados/sla.ts) --------------------------

const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;

function isBusinessDay(date, holidays) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false; // domingo / sábado
  const iso = date.toISOString().split("T")[0];
  return !holidays.has(iso);
}

function computeSlaDeadlineCore(start, slaHours, holidays) {
  let remainingMs = slaHours * 3_600_000;
  const cursor = new Date(start);

  for (let i = 0; i < 3700; i++) {
    if (!isBusinessDay(cursor, holidays) || cursor.getHours() >= BUSINESS_END_HOUR) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }
    if (cursor.getHours() < BUSINESS_START_HOUR) {
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    }

    const endOfWindow = new Date(cursor);
    endOfWindow.setHours(BUSINESS_END_HOUR, 0, 0, 0);
    const availableMs = endOfWindow.getTime() - cursor.getTime();

    if (remainingMs <= availableMs) {
      return new Date(cursor.getTime() + remainingMs);
    }

    remainingMs -= availableMs;
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  }

  return cursor; // fallback — não deve acontecer com SLAs razoáveis
}

// ---- Execução ---------------------------------------------------------------

const { data: tickets, error: tErr } = await sb
  .from("tickets")
  .select("id, number, team, status, created_at, sla_deadline, category_id, mkt_is_alteracao")
  .in("status", ["open", "in_progress"])
  .not("category_id", "is", null);

if (tErr) {
  console.error("Erro ao buscar chamados:", tErr.message);
  process.exit(1);
}
if (!tickets || tickets.length === 0) {
  console.log("Nenhum chamado aberto com categoria encontrado. Nada a fazer.");
  process.exit(0);
}

// Categorias (sla_hours / alteracao_sla_hours / team)
const categoryIds = [...new Set(tickets.map((t) => t.category_id))];
const { data: categorias, error: cErr } = await sb
  .from("ticket_categories")
  .select("id, sla_hours, alteracao_sla_hours, team")
  .in("id", categoryIds);

if (cErr) {
  console.error("Erro ao buscar categorias:", cErr.message);
  process.exit(1);
}
const catById = new Map((categorias ?? []).map((c) => [c.id, c]));

// Feriados dos anos relevantes (do chamado mais antigo até o ano que vem)
const anos = tickets.map((t) => new Date(t.created_at).getFullYear());
const anoMin = Math.min(...anos);
const anoMax = new Date().getFullYear() + 1;
const { data: feriadosRows, error: fErr } = await sb
  .from("ponto_feriados")
  .select("date")
  .gte("date", `${anoMin}-01-01`)
  .lte("date", `${anoMax}-12-31`);

if (fErr) {
  console.error("Erro ao buscar feriados:", fErr.message);
  process.exit(1);
}
const feriados = new Set((feriadosRows ?? []).map((f) => f.date));
console.log(`Chamados abertos com categoria: ${tickets.length} · feriados ${anoMin}–${anoMax}: ${feriados.size}\n`);

let atualizados = 0;
let inalterados = 0;
let semSla = 0;
let falhas = 0;

for (const t of tickets) {
  const cat = catById.get(t.category_id);
  if (!cat) {
    semSla++;
    console.log(`#${t.number}: categoria ${t.category_id} não encontrada — pulado`);
    continue;
  }

  // Espelha app/api/chamados/route.ts (POST): time efetivo vem da categoria;
  // MKT usa SLA de alteração quando aplicável
  const team = cat.team || t.team;
  const slaHours =
    team === "marketing" && t.mkt_is_alteracao === true && cat.alteracao_sla_hours
      ? cat.alteracao_sla_hours
      : cat.sla_hours;

  if (!slaHours) {
    semSla++;
    console.log(`#${t.number}: categoria sem sla_hours — pulado`);
    continue;
  }

  const novoDeadline = computeSlaDeadlineCore(new Date(t.created_at), slaHours, feriados);
  const novoIso = novoDeadline.toISOString();
  const antigoIso = t.sla_deadline ? new Date(t.sla_deadline).toISOString() : null;

  if (antigoIso === novoIso) {
    inalterados++;
    console.log(`#${t.number}: ${antigoIso} (já correto)`);
    continue;
  }

  const { error: uErr } = await sb
    .from("tickets")
    .update({ sla_deadline: novoIso })
    .eq("id", t.id);

  if (uErr) {
    falhas++;
    console.log(`#${t.number}: ERRO ao atualizar — ${uErr.message}`);
    continue;
  }

  atualizados++;
  console.log(`#${t.number} (${team}, ${slaHours}h úteis): ${antigoIso ?? "(sem prazo)"} → ${novoIso}`);
}

console.log(
  `\nTotais: ${atualizados} atualizado(s), ${inalterados} inalterado(s), ${semSla} sem SLA/categoria, ${falhas} falha(s).`
);
if (falhas > 0) process.exit(1);
