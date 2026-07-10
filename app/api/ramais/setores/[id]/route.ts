import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("ramais", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.color !== undefined) updates.color = body.color;
    if (body.order_index !== undefined) updates.order_index = body.order_index;

    const svc = createServiceClient();
    const { error } = await svc.from("ramal_setores").update(updates).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("ramais", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { error } = await svc.from("ramal_setores").update({ active: false }).eq("id", params.id);
    if (error) throw error;
    // Desativa em cascata os ramais do setor (a UI promete que eles são removidos junto)
    const { error: itemsError } = await svc
      .from("ramais")
      .update({ active: false })
      .eq("setor_id", params.id);
    if (itemsError) throw itemsError;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
