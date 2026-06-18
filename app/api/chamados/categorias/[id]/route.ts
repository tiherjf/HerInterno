import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const canManage = ["admin", "ti", "manutencao"].includes(profile.role);
    if (!canManage) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Verifica se a categoria pertence à equipe do usuário (exceto admin)
    if (profile.role !== "admin") {
      const { data: cat } = await supabase
        .from("ticket_categories")
        .select("team")
        .eq("id", params.id)
        .single();

      const expectedTeam = profile.role === "manutencao" ? "manutencao" : "ti";
      if (cat?.team && cat.team !== expectedTeam) {
        return NextResponse.json({ error: "Sem permissão para esta categoria" }, { status: 403 });
      }
    }

    const updates = await req.json();
    const allowed = ["name", "color", "sla_hours", "active"];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );

    const { error } = await supabase
      .from("ticket_categories")
      .update(filtered)
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
