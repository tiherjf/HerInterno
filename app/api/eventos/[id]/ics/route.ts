import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { buildIcs } from "@/lib/eventos/ics";

type Params = { params: { id: string } };

/** "Adicionar à minha agenda": devolve o evento como arquivo .ics. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const svc = createServiceClient();
    const { data: ev } = await svc
      .from("events")
      .select("id, title, description, location, meeting_link, event_date")
      .eq("id", params.id)
      .eq("active", true)
      .maybeSingle();

    if (!ev) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const url = `${req.nextUrl.origin}/intranet/eventos/${ev.id}`;
    return new NextResponse(buildIcs(ev, url, new Date()), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="evento.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
