import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("justification_types")
      .select("*")
      .order("name");
    if (error) throw error;
    return NextResponse.json({ types: data || [] });
  } catch {
    return NextResponse.json({ types: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const body = await req.json();
    const { name, description, requires_document, allows_partial_day } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabase.from("justification_types").insert({
      name: name.trim(),
      description: description?.trim() || null,
      requires_document: requires_document || false,
      allows_partial_day: allows_partial_day !== false,
      active: true,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ ok: true, type: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
