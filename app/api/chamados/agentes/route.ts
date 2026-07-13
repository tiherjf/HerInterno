import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { CHAMADOS_TEAMS } from "@/lib/chamados/equipe";

// GET /api/chamados/agentes?team=<ti|manutencao|marketing>
// Lista os técnicos ativos da equipe informada (role === team), para que o
// solicitante possa, opcionalmente, direcionar o chamado a um técnico.
// Qualquer staff ativo pode consultar (solicitantes precisam disso).
export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const team = req.nextUrl.searchParams.get("team") ?? "";
    if (!(CHAMADOS_TEAMS as readonly string[]).includes(team)) {
      return NextResponse.json({ error: "Equipe inválida" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", team)
      .eq("active", true)
      .order("full_name");

    if (error) throw error;

    return NextResponse.json({ agentes: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}
