import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageEvents } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!canManageEvents(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const format = req.nextUrl.searchParams.get("format");
    const svc = createServiceClient();

    const [{ data: registrations }, { data: waitlist }] = await Promise.all([
      svc.from("event_registrations")
        .select("user_id, registered_at, checked_in, checked_in_at, profiles!user_id(full_name, sector, role)")
        .eq("event_id", params.id)
        .order("registered_at"),
      svc.from("event_waitlist")
        .select("user_id, joined_at, profiles!user_id(full_name, sector)")
        .eq("event_id", params.id)
        .order("joined_at"),
    ]);

    if (format === "csv") {
      const rows = [
        ["Nome", "Setor", "Inscrito em", "Check-in"],
        ...(registrations ?? []).map((r: any) => [
          r.profiles?.full_name ?? "",
          r.profiles?.sector ?? "",
          new Date(r.registered_at).toLocaleString("pt-BR"),
          r.checked_in ? "Sim" : "Não",
        ]),
      ].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

      return new NextResponse("﻿" + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="participantes.csv"`,
        },
      });
    }

    return NextResponse.json({
      registrations: (registrations ?? []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? "",
        sector: r.profiles?.sector ?? "",
        role: r.profiles?.role ?? "",
        registered_at: r.registered_at,
        checked_in: r.checked_in,
        checked_in_at: r.checked_in_at,
      })),
      waitlist: (waitlist ?? []).map((w: any) => ({
        user_id: w.user_id,
        full_name: w.profiles?.full_name ?? "",
        sector: w.profiles?.sector ?? "",
        joined_at: w.joined_at,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}

// Check-in toggle
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!canManageEvents(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { user_id, checked_in } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });

    const svc = createServiceClient();
    const { error } = await svc.from("event_registrations")
      .update({
        checked_in,
        checked_in_at: checked_in ? new Date().toISOString() : null,
      })
      .eq("event_id", params.id)
      .eq("user_id", user_id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
