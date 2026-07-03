import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();

    if (body.type === "ishikawa") {
      const allowed = ["title","metodo","mao_de_obra","maquina","material","meio_ambiente","medicao","sector","nc_id"];
      const update: Record<string, unknown> = {};
      for (const k of allowed) { if (k in body) update[k] = body[k] ?? null; }
      const { error } = await svc.from("quality_ishikawa").update(update).eq("id", params.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const allowed = ["title","analysis_date","next_date","status","participants","agenda","decisions","observations","sector"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) { if (k in body) update[k] = body[k] ?? null; }
    const { error } = await svc.from("quality_critical_analyses").update(update).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) { return apiError(err); }
}
