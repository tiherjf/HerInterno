import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { agentTeam, AGENT_ROLES } from "@/lib/chamados/equipe";
import { validarCamposCategoria } from "@/lib/chamados/categorias";
import { erroColunaChamados } from "@/lib/chamados/migracao";

type Params = { params: { id: string } };

const AVISO_MIGRACAO_042 =
  "Execute a migração 042 no Supabase (042_chamados_categorias_ola.sql) para salvar OLA e prioridade padrão.";

/**
 * Escopo por equipe: admin gerencia todas as categorias; ti/manutencao/marketing
 * só gerenciam categorias da própria equipe (carrega o team da categoria antes).
 * Retorna uma resposta de erro ou null se autorizado.
 */
async function verificarEquipe(
  supabase: ReturnType<typeof createServiceClient>,
  role: string,
  categoryId: string,
): Promise<NextResponse | null> {
  if (role === "admin") return null;

  const { data: cat } = await supabase
    .from("ticket_categories")
    .select("team")
    .eq("id", categoryId)
    .maybeSingle();

  if (!cat) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
  }
  if (cat.team && cat.team !== agentTeam(role)) {
    return NextResponse.json({ error: "Sem permissão para esta categoria" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!AGENT_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const negado = await verificarEquipe(supabase, profile.role, params.id);
    if (negado) return negado;

    const updates = await req.json();
    const allowed = ["name", "color", "sla_hours", "active"];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    // Campos novos (migração 042): ola_hours e default_priority — validados
    const validacao = validarCamposCategoria(updates);
    if (validacao.error) {
      return NextResponse.json({ error: validacao.error }, { status: 400 });
    }
    Object.assign(filtered, validacao.fields);

    let { error } = await supabase
      .from("ticket_categories")
      .update(filtered)
      .eq("id", params.id);

    // Pré-migração 042: ola_hours/default_priority inexistentes — salva sem eles
    let aviso: string | undefined;
    if (
      error &&
      erroColunaChamados(error, ["ola_hours", "default_priority"]) &&
      ("ola_hours" in filtered || "default_priority" in filtered)
    ) {
      const semNovas = { ...filtered };
      delete semNovas.ola_hours;
      delete semNovas.default_priority;
      if (Object.keys(semNovas).length > 0) {
        const retry = await supabase.from("ticket_categories").update(semNovas).eq("id", params.id);
        error = retry.error;
      } else {
        error = null;
      }
      if (!error) aviso = AVISO_MIGRACAO_042;
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
    if (!AGENT_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const negado = await verificarEquipe(supabase, profile.role, params.id);
    if (negado) return negado;

    // Soft delete — não remove dados históricos de chamados
    const { error } = await supabase
      .from("ticket_categories")
      .update({ active: false })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
