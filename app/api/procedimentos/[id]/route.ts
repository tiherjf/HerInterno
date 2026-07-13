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
    ];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    // Coage preço: número >= 0 ou null (aceita "" → null)
    if ("preco" in updates) {
      const p = updates.preco;
      if (p === null || p === "" || p === undefined) {
        updates.preco = null;
      } else {
        const n = Number(p);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Preço inválido — informe um valor maior ou igual a zero" }, { status: 400 });
        }
        updates.preco = n;
      }
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();
    let { error } = await supabase.from("procedimentos").update(updates).eq("id", params.id);
    let aviso: string | undefined;

    // Pré-migração 043: colunas de preço/categoria inexistentes — reenvia sem elas
    if (error && erroColuna043(error) && COLUNAS_043.some(c => c in updates)) {
      const semNovas = { ...updates };
      for (const c of COLUNAS_043) delete semNovas[c];
      const retry = await supabase.from("procedimentos").update(semNovas).eq("id", params.id);
      error = retry.error;
      if (!error) aviso = AVISO_043;
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
