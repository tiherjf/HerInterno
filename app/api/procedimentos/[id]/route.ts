import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

type Params = { params: { id: string } };

// Colunas adicionadas pela migração 043 (preços/categorias).
const COLUNAS_043 = ["categoria", "preco", "unidade_medida", "protocolo", "profissional"];
const AVISO_043 = "Execute a migração 043 no Supabase para salvar preço/categoria.";

// Colunas adicionadas pela migração 044 (convênios/pagamento/preparo/médicos).
const COLUNAS_044 = [
  "convenios", "atende_particular", "parcelas_max", "pacote_sessoes", "pacote_preco",
  "jejum_horas", "requer_agendamento", "duracao_min", "documentos_necessarios",
  "suspende_medicacao", "medicos",
];
const AVISO_044 = "Execute a migração 044 no Supabase para salvar os novos campos.";

// União das colunas extras (043 + 044) — retiradas em conjunto no fallback.
const COLUNAS_EXTRAS = [...COLUNAS_043, ...COLUNAS_044];

// Campos numéricos (preço) e inteiros aceitos, para validação/coerção.
const CAMPOS_PRECO = ["preco", "pacote_preco"];
const CAMPOS_INT = ["parcelas_max", "pacote_sessoes", "jejum_horas", "duracao_min"];
const CAMPOS_ARRAY = ["convenios", "medicos"];
const CAMPOS_BOOL = ["atende_particular", "requer_agendamento"];
const CAMPOS_TEXTO = [
  "descricao", "preparacao", "categoria", "unidade_medida", "protocolo",
  "profissional", "documentos_necessarios", "suspende_medicacao",
];

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

/** Coage booleano; undefined quando não informado. */
function coerceBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("procedimentos", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = [
      "nome", "tipo", "unidade", "descricao", "preparacao", "ativo", "order_num",
      "categoria", "preco", "unidade_medida", "protocolo", "profissional",
      ...COLUNAS_044,
    ];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    // Coage preço/valores monetários: número >= 0 ou null (aceita "" → null)
    for (const campo of CAMPOS_PRECO) {
      if (!(campo in updates)) continue;
      const p = updates[campo];
      if (p === null || p === "" || p === undefined) {
        updates[campo] = null;
      } else {
        const n = Number(p);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Preço inválido — informe um valor maior ou igual a zero" }, { status: 400 });
        }
        updates[campo] = n;
      }
    }

    // Coage inteiros >= 0 ou null
    for (const campo of CAMPOS_INT) {
      if (!(campo in updates)) continue;
      const v = updates[campo];
      if (v === null || v === "" || v === undefined) {
        updates[campo] = null;
      } else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) {
          return NextResponse.json({ error: "Valor inválido — informe um número inteiro maior ou igual a zero" }, { status: 400 });
        }
        updates[campo] = n;
      }
    }

    // Coage listas de texto (convênios/médicos)
    for (const campo of CAMPOS_ARRAY) {
      if (campo in updates) updates[campo] = coerceStrArray(updates[campo]);
    }

    // Coage booleanos (remove quando inválido para não sobrescrever com lixo)
    for (const campo of CAMPOS_BOOL) {
      if (!(campo in updates)) continue;
      const b = coerceBool(updates[campo]);
      if (b === undefined) delete updates[campo];
      else updates[campo] = b;
    }

    // Coage textos: aparados → null quando vazios
    for (const campo of CAMPOS_TEXTO) {
      if (campo in updates && typeof updates[campo] === "string") {
        updates[campo] = (updates[campo] as string).trim() || null;
      }
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();
    let { error } = await supabase.from("procedimentos").update(updates).eq("id", params.id);
    let aviso: string | undefined;

    // Pré-migração 043/044: colunas extras inexistentes — reenvia sem elas
    if (
      error &&
      (erroColuna043(error) || erroColuna044(error)) &&
      COLUNAS_EXTRAS.some(c => c in updates)
    ) {
      const avisoOriginal = erroColuna044(error) ? AVISO_044 : AVISO_043;
      const semNovas = { ...updates };
      for (const c of COLUNAS_EXTRAS) delete semNovas[c];
      const retry = await supabase.from("procedimentos").update(semNovas).eq("id", params.id);
      error = retry.error;
      if (!error) aviso = avisoOriginal;
    }

    if (error) throw error;
    return NextResponse.json(aviso ? { ok: true, aviso } : { ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("procedimentos", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("procedimentos")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
