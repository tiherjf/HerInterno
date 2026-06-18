import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };
const IS_AGENT = ["admin", "ti", "manutencao"];

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!IS_AGENT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("ticket_checklist")
      .select("id, text, completed, completed_at, order_num, created_at, completer:profiles!completed_by(full_name)")
      .eq("ticket_id", params.id)
      .order("order_num")
      .order("created_at");
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!IS_AGENT.includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 });

    const supabase = createServiceClient();
    const { count } = await supabase
      .from("ticket_checklist")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", params.id);

    const { data, error } = await supabase
      .from("ticket_checklist")
      .insert({ ticket_id: params.id, text: text.trim(), order_num: (count ?? 0) + 1, created_by: profile.id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
