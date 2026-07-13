import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { agentTeam, AGENT_ROLES, CHAMADOS_TEAMS } from "@/lib/chamados/equipe";
import { validarCamposCategoria } from "@/lib/chamados/categorias";
import { erroColunaChamados } from "@/lib/chamados/migracao";

const AVISO_MIGRACAO_042 =
  "Execute a migração 042 no Supabase (042_chamados_categorias_ola.sql) para salvar OLA e prioridade padrão.";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const all = req.nextUrl.searchParams.get("all") === "true";
    const teamParam = req.nextUrl.searchParams.get("team") ?? "";
    const canManage = AGENT_ROLES.includes(profile.role);

    let query = supabase
      .from("ticket_categories")
      .select("*")
      .order("team")
      .order("name");

    // Gestores podem ver inativas ao solicitar ?all=true
    if (!all || !canManage) query = query.eq("active", true);

    // Agente não-admin só vê as categorias da sua equipe
    const ownTeam = agentTeam(profile.role);
    if (ownTeam) query = query.eq("team", ownTeam);

    // Filtro ?team= (para admin e solicitantes comuns; para agente não-admin
    // a equipe já foi forçada acima e o filtro extra apenas restringe)
    if ((CHAMADOS_TEAMS as readonly string[]).includes(teamParam)) {
      query = query.eq("team", teamParam);
    }

    const { data } = await query;
    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    console.error("[API]", err);
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const canManage = AGENT_ROLES.includes(profile.role);
    if (!canManage) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const { name, color, sla_hours, team } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }

    // Escopo por equipe: ti/manutencao/marketing só criam categorias da
    // própria fila (o team do body é ignorado); admin escolhe a equipe
    const ownTeam = agentTeam(profile.role);
    const resolvedTeam = ownTeam ?? team ?? "ti";
    if (!(CHAMADOS_TEAMS as readonly string[]).includes(resolvedTeam)) {
      return NextResponse.json({ error: "Equipe inválida" }, { status: 400 });
    }

    // Campos novos (migração 042): ola_hours e default_priority
    const validacao = validarCamposCategoria(body);
    if (validacao.error) {
      return NextResponse.json({ error: validacao.error }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      color: color ?? "#3b82f6",
      sla_hours: sla_hours ?? 24,
      team: resolvedTeam,
      ...validacao.fields,
    };

    const supabase = createServiceClient();
    let { data, error } = await supabase
      .from("ticket_categories")
      .insert(payload)
      .select()
      .single();

    // Pré-migração 042: ola_hours/default_priority inexistentes — salva sem eles
    let aviso: string | undefined;
    if (
      error &&
      erroColunaChamados(error, ["ola_hours", "default_priority"]) &&
      ("ola_hours" in payload || "default_priority" in payload)
    ) {
      const semNovas = { ...payload };
      delete semNovas.ola_hours;
      delete semNovas.default_priority;
      const retry = await supabase.from("ticket_categories").insert(semNovas).select().single();
      data = retry.data;
      error = retry.error;
      if (!error) aviso = AVISO_MIGRACAO_042;
    }

    if (error) throw error;
    return NextResponse.json(
      aviso ? { ok: true, category: data, aviso } : { ok: true, category: data },
      { status: 201 },
    );
  } catch (err) {
    return apiError(err);
  }
}
