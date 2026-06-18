import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

const CAN_MANAGE = ["admin", "ti", "marketing", "recepcao"];
type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!CAN_MANAGE.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["nome", "especialidade", "grupo", "dias", "horarios", "observacoes", "sem_agenda", "ativo", "order_num"];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("corpo_clinico")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!CAN_MANAGE.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    // Soft delete
    const { error } = await supabase
      .from("corpo_clinico")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
