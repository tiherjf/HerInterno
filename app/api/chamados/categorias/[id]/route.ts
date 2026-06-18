import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const updates = await req.json();
    const allowed = ["name", "color", "sla_hours", "active"];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    const supabase = createServiceClient();
    const { error } = await supabase.from("ticket_categories").update(filtered).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
