import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const isRH = ["admin", "ti", "rh"].includes(profile.role);

    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month"); // YYYY-MM
    const userIdParam = url.searchParams.get("user_id");

    const now = new Date();
    const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Apenas RH pode ver calendário de outro usuário
    const targetUserId = isRH && userIdParam ? userIdParam : profile.id;

    const from = `${month}-01`;
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;

    const supabase = createServiceClient();

    // Justificativas do mês
    const { data: justifications } = await supabase
      .from("justifications")
      .select(`
        id, occurrence_date, status, is_full_day, start_time, end_time,
        justification_types!type_id(name)
      `)
      .eq("user_id", targetUserId)
      .gte("occurrence_date", from)
      .lte("occurrence_date", to)
      .order("occurrence_date");

    // Índice por data
    const byDate: Record<string, typeof justifications> = {};
    for (const j of justifications ?? []) {
      if (!byDate[j.occurrence_date]) byDate[j.occurrence_date] = [];
      byDate[j.occurrence_date]!.push(j);
    }

    // Mês fechado?
    const { data: fechamento } = await supabase
      .from("ponto_fechamentos")
      .select("id, closed_by_name, closed_at")
      .eq("reference_month", month)
      .maybeSingle();

    // Monta array de dias do mês
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      const dow = new Date(dateStr + "T12:00:00").getDay(); // 0=Dom, 6=Sab
      days.push({
        date: dateStr,
        day: d,
        weekend: dow === 0 || dow === 6,
        dow,
        justifications: (byDate[dateStr] ?? []).map(j => ({
          id: j.id,
          status: j.status,
          type_name: ((Array.isArray(j.justification_types) ? j.justification_types[0] : j.justification_types) as { name: string } | null)?.name ?? "—",
          is_full_day: j.is_full_day,
          start_time: j.start_time,
          end_time: j.end_time,
        })),
      });
    }

    return NextResponse.json({ month, days, fechamento: fechamento ?? null });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
