import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

// Colunas adicionadas pela migração 043 (preços/categorias). Ausentes antes da
// migração, geram erro 42703/PGRST204 — nesse caso reinserimos sem elas.
const COLUNAS_043 = ["categoria", "preco", "unidade_medida", "protocolo", "profissional"];
const AVISO_043 = "Execute a migração 043 no Supabase para salvar preço/categoria.";

// Colunas adicionadas pela migração 044 (convênios/pagamento/preparo/médicos).
const COLUNAS_044 = [
  "convenios", "atende_particular", "parcelas_max", "pacote_sessoes", "pacote_preco",
  "jejum_horas", "requer_agendamento", "duracao_min", "documentos_necessarios",
  "suspende_medicacao", "medicos",
];
const AVISO_044 = "Execute a migração 044 no Supabase para salvar os novos campos.";

// Colunas adicionadas pela migração 046 (dias/horários).
const COLUNAS_046 = ["dias", "horarios"];
const AVISO_046 = "Execute a migração 046 no Supabase para salvar dias/horários.";

// União das colunas extras (043 + 044 + 046) — retiradas em conjunto no fallback.
const COLUNAS_EXTRAS = [...COLUNAS_043, ...COLUNAS_044, ...COLUNAS_046];

/** Erro de coluna inexistente da migração 043 (não aplicada). */
function erroColuna043(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204") &&
    COLUNAS_043.some(c => msg.includes(c.toLowerCase()))
  );
}

/** Erro de coluna inexistente da migração 044 (não aplicada). */
function erroColuna044(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204") &&
    COLUNAS_044.some(c => msg.includes(c.toLowerCase()))
  );
}

/** Erro de coluna inexistente da migração 046 (não aplicada). */
function erroColuna046(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204") &&
    COLUNAS_046.some(c => msg.includes(c.toLowerCase()))
  );
}

/** Coage preço: número >= 0, ou null (aceita "" → null). Retorna NaN se inválido. */
function coercePreco(preco: unknown): number | null {
  if (preco === undefined || preco === null || preco === "") return null;
  const n = Number(preco);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

/** Coage inteiro: inteiro >= 0, ou null (aceita "" → null). Retorna NaN se inválido. */
function coerceInt(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) return NaN;
  return n;
}

/** Coage lista de textos: array (ou string separada por vírgula) de itens
 * não vazios e aparados. Vazio → null. */
function coerceStrArray(v: unknown): string[] | null {
  if (v === undefined || v === null || v === "") return null;
  let arr: unknown[];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string") arr = v.split(",");
  else return null;
  const out = arr.map(x => String(x).trim()).filter(Boolean);
  return out.length ? out : null;
}

/** Coage booleano; undefined quando não informado (deixa o default do banco). */
function coerceBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/** Coage texto: aparado, ou null quando vazio. */
function coerceText(v: unknown): string | null {
  if (typeof v !== "string") return v == null ? null : String(v);
  return v.trim() || null;
}

export async function GET() {
  try {
    const profile = await requireStaff();
    const canEdit = await canEditMenuItem("procedimentos", profile.role as StaffRole);
    const supabase = canEdit ? createServiceClient() : createClient();

    let query = supabase
      .from("procedimentos")
      .select("*")
      .order("unidade")
      .order("tipo")
      .order("order_num")
      .order("nome");

    if (!canEdit) {
      query = query.eq("ativo", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ procedimentos: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("procedimentos", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const {
      nome, tipo, unidade, descricao, preparacao,
      categoria, preco, unidade_medida, protocolo, profissional,
      convenios, atende_particular, parcelas_max, pacote_sessoes, pacote_preco,
      jejum_horas, requer_agendamento, duracao_min, documentos_necessarios,
      suspende_medicacao, medicos, dias, horarios,
    } = await req.json();
    if (!nome?.trim() || !unidade?.trim()) {
      return NextResponse.json({ error: "Nome e unidade são obrigatórios" }, { status: 400 });
    }

    const precoNum = coercePreco(preco);
    const pacotePrecoNum = coercePreco(pacote_preco);
    if (Number.isNaN(precoNum) || Number.isNaN(pacotePrecoNum)) {
      return NextResponse.json({ error: "Preço inválido — informe um valor maior ou igual a zero" }, { status: 400 });
    }

    const parcelasNum = coerceInt(parcelas_max);
    const sessoesNum = coerceInt(pacote_sessoes);
    const jejumNum = coerceInt(jejum_horas);
    const duracaoNum = coerceInt(duracao_min);
    if ([parcelasNum, sessoesNum, jejumNum, duracaoNum].some(n => Number.isNaN(n))) {
      return NextResponse.json({ error: "Valor inválido — informe um número inteiro maior ou igual a zero" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { count } = await supabase
      .from("procedimentos")
      .select("id", { count: "exact", head: true })
      .eq("unidade", unidade.trim())
      .eq("tipo", tipo ?? "exame");

    const registro: Record<string, unknown> = {
      nome: nome.trim(),
      tipo: tipo ?? "exame",
      unidade: unidade.trim(),
      descricao: coerceText(descricao),
      preparacao: coerceText(preparacao),
      categoria: coerceText(categoria),
      preco: precoNum,
      unidade_medida: coerceText(unidade_medida),
      protocolo: coerceText(protocolo),
      profissional: coerceText(profissional),
      convenios: coerceStrArray(convenios),
      parcelas_max: parcelasNum,
      pacote_sessoes: sessoesNum,
      pacote_preco: pacotePrecoNum,
      jejum_horas: jejumNum,
      duracao_min: duracaoNum,
      documentos_necessarios: coerceText(documentos_necessarios),
      suspende_medicacao: coerceText(suspende_medicacao),
      medicos: coerceStrArray(medicos),
      dias: coerceText(dias),
      horarios: coerceText(horarios),
      order_num: (count ?? 0) + 1,
      created_by: profile.id,
    };
    // Booleanos só entram quando informados (senão vale o default do banco)
    const atendeParticular = coerceBool(atende_particular);
    if (atendeParticular !== undefined) registro.atende_particular = atendeParticular;
    const requerAgendamento = coerceBool(requer_agendamento);
    if (requerAgendamento !== undefined) registro.requer_agendamento = requerAgendamento;

    let { data, error } = await supabase.from("procedimentos").insert(registro).select().single();
    let aviso: string | undefined;

    // Pré-migração 043/044/046: colunas extras inexistentes — reinsere sem elas
    if (error && (erroColuna043(error) || erroColuna044(error) || erroColuna046(error))) {
      const avisoOriginal = erroColuna046(error) ? AVISO_046 : erroColuna044(error) ? AVISO_044 : AVISO_043;
      const semNovas = { ...registro };
      for (const c of COLUNAS_EXTRAS) delete semNovas[c];
      const retry = await supabase.from("procedimentos").insert(semNovas).select().single();
      data = retry.data;
      error = retry.error;
      if (!error) aviso = avisoOriginal;
    }

    if (error) throw error;
    return NextResponse.json(
      aviso ? { ok: true, procedimento: data, aviso } : { ok: true, procedimento: data },
      { status: 201 },
    );
  } catch (err) {
    return apiError(err);
  }
}
