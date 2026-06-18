import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

const IS_AGENT = ["admin", "ti", "manutencao"];

export async function GET() {
  try {
    const profile = await requireStaff();
    if (!IS_AGENT.includes(profile.role)) {
      return NextResponse.json({ templates: [] });
    }
    const supabase = createServiceClient();
    let query = supabase.from("ticket_templates").select("id, name, content, team").order("name");
    // Cada equipe vê apenas seus templates + admin vê todos
    if (profile.role === "ti") query = query.eq("team", "ti");
    else if (profile.role === "manutencao") query = query.eq("team", "manutencao");
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ templates: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!IS_AGENT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const { name, content, team } = await req.json();
    if (!name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Nome e conteúdo são obrigatórios" }, { status: 400 });
    }
    let resolvedTeam = team ?? "ti";
    if (profile.role === "ti") resolvedTeam = "ti";
    if (profile.role === "manutencao") resolvedTeam = "manutencao";

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ticket_templates")
      .insert({ name: name.trim(), content: content.trim(), team: resolvedTeam, created_by: profile.id })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, template: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
