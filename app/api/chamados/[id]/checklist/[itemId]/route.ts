import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string; itemId: string } };
const IS_AGENT = ["admin", "ti", "manutencao"];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!IS_AGENT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const body = await req.json();
    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};
    if (typeof body.completed === "boolean") {
      updates.completed = body.completed;
      updates.completed_by = body.completed ? profile.id : null;
      updates.completed_at = body.completed ? new Date().toISOString() : null;
    }
    if (body.text?.trim()) updates.text = body.text.trim();

    const { error } = await supabase
      .from("ticket_checklist")
      .update(updates)
      .eq("id", params.itemId)
      .eq("ticket_id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!IS_AGENT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("ticket_checklist")
      .delete()
      .eq("id", params.itemId)
      .eq("ticket_id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
