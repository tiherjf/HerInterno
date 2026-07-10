import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

type Params = { params: { id: string } };

// Relatório de leitura de um comunicado: quem leu e quem ainda não leu.
// Restrito a quem pode editar notícias.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("noticias", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const [{ data: reads }, { data: staff }] = await Promise.all([
      svc.from("news_reads").select("user_id, read_at").eq("news_id", params.id),
      svc.from("profiles").select("id, full_name, sector").eq("active", true).order("full_name"),
    ]);

    const readMap = new Map((reads ?? []).map(r => [r.user_id, r.read_at]));
    const readers: { id: string; full_name: string; sector: string; read_at: string }[] = [];
    const pending: { id: string; full_name: string; sector: string }[] = [];

    for (const p of staff ?? []) {
      if (readMap.has(p.id)) {
        readers.push({ ...p, read_at: readMap.get(p.id) as string });
      } else {
        pending.push(p);
      }
    }

    return NextResponse.json({
      total: (staff ?? []).length,
      read_count: readers.length,
      readers,
      pending,
    });
  } catch (err) {
    return apiError(err);
  }
}
