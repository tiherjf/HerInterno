import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(_: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();

    await svc
      .from("quality_document_reads")
      .upsert({ document_id: params.id, user_id: profile.id }, { onConflict: "document_id,user_id" });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh", "qualidade"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();

    const { data } = await svc
      .from("quality_document_reads")
      .select("user_id, read_at, profiles!user_id(full_name, sector)")
      .eq("document_id", params.id)
      .order("read_at", { ascending: false });

    return NextResponse.json({ reads: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}
