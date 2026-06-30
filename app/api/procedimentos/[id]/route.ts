import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };
const CAN_EDIT = ["admin", "ti", "marketing", "recepcao"];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!CAN_EDIT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["nome", "tipo", "unidade", "descricao", "preparacao", "ativo", "order_num"];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );
    updates.updated_at = new Date().toISOString();

    const supabase = createServiceClient();
    const { error } = await supabase.from("procedimentos").update(updates).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!CAN_EDIT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("procedimentos")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
