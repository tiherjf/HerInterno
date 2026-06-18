import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const body = await req.json();
    const { name, description, requires_document, allows_partial_day, active } = body;

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name.trim();
    if (description !== undefined) update.description = description?.trim() || null;
    if (requires_document !== undefined) update.requires_document = requires_document;
    if (allows_partial_day !== undefined) update.allows_partial_day = allows_partial_day;
    if (active !== undefined) update.active = active;

    const { error } = await supabase.from("justification_types").update(update).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
