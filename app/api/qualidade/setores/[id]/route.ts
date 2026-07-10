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
    const update: Record<string, unknown> = {};
    if ("name" in body) update.name = body.name;
    if ("color" in body) update.color = body.color;
    if ("description" in body) update.description = body.description;
    if ("active" in body) update.active = body.active;
    if ("order_num" in body) update.order_num = body.order_num;
    const { error } = await svc.from("quality_sectors").update(update).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
