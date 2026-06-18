import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const all = req.nextUrl.searchParams.get("all") === "true";
    const canManage = ["admin", "ti", "manutencao"].includes(profile.role);

    let query = supabase
      .from("ticket_categories")
      .select("*")
      .order("team")
      .order("name");

    // Gestores podem ver inativas ao solicitar ?all=true
    if (!all || !canManage) query = query.eq("active", true);

    // Agentes só veem suas próprias categorias
    if (profile.role === "ti") query = query.eq("team", "ti");
    else if (profile.role === "manutencao") query = query.eq("team", "manutencao");

    const { data } = await query;
    return NextResponse.json({ categories: data ?? [] });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const canManage = ["admin", "ti", "manutencao"].includes(profile.role);
    if (!canManage) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { name, color, sla_hours, team, default_priority } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }

    // Cada equipe só cria categorias da sua própria fila
    let resolvedTeam = team ?? "ti";
    if (profile.role === "manutencao") resolvedTeam = "manutencao";
    else if (profile.role === "ti") resolvedTeam = "ti";

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ticket_categories")
      .insert({
        name: name.trim(),
        color: color ?? "#3b82f6",
        sla_hours: sla_hours ?? 24,
        team: resolvedTeam,
        default_priority: default_priority || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, category: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
