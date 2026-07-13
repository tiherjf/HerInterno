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

/** Erro de coluna inexistente (migração 043 não aplicada). */
function erroColuna043(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  const msg = (e.message ?? "").toLowerCase();
  return (
    (e.code === "42703" || e.code === "PGRST204") &&
    COLUNAS_043.some(c => msg.includes(c.toLowerCase()))
  );
}

/** Coage preço: número >= 0, ou null (aceita "" → null). Retorna NaN se inválido. */
function coercePreco(preco: unknown): number | null {
  if (preco === undefined || preco === null || preco === "") return null;
  const n = Number(preco);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
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
    } = await req.json();
    if (!nome?.trim() || !unidade?.trim()) {
      return NextResponse.json({ error: "Nome e unidade são obrigatórios" }, { status: 400 });
    }

    const precoNum = coercePreco(preco);
    if (Number.isNaN(precoNum)) {
      return NextResponse.json({ error: "Preço inválido — informe um valor maior ou igual a zero" }, { status: 400 });
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
      descricao: descricao?.trim() || null,
      preparacao: preparacao?.trim() || null,
      categoria: categoria?.trim() || null,
      preco: precoNum,
      unidade_medida: unidade_medida?.trim() || null,
      protocolo: protocolo?.trim() || null,
      profissional: profissional?.trim() || null,
      order_num: (count ?? 0) + 1,
      created_by: profile.id,
    };

    let { data, error } = await supabase.from("procedimentos").insert(registro).select().single();
    let aviso: string | undefined;

    // Pré-migração 043: colunas de preço/categoria inexistentes — reinsere sem elas
    if (error && erroColuna043(error)) {
      const semNovas = { ...registro };
      for (const c of COLUNAS_043) delete semNovas[c];
      const retry = await supabase.from("procedimentos").insert(semNovas).select().single();
      data = retry.data;
      error = retry.error;
      if (!error) aviso = AVISO_043;
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
