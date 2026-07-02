import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageEvents } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();

    const { data: ev, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !ev) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const [{ data: reg }, { data: wl }, { count: wlCount }] = await Promise.all([
      supabase.from("event_registrations").select("checked_in, checked_in_at")
        .eq("event_id", params.id).eq("user_id", profile.id).maybeSingle(),
      supabase.from("event_waitlist").select("joined_at")
        .eq("event_id", params.id).eq("user_id", profile.id).maybeSingle(),
      supabase.from("event_waitlist").select("*", { count: "exact", head: true })
        .eq("event_id", params.id),
    ]);

    return NextResponse.json({
      event: {
        ...ev,
        is_registered: !!reg,
        checked_in: reg?.checked_in ?? false,
        on_waitlist: !!wl,
        waitlist_count: wlCount ?? 0,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!canManageEvents(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title, description, location, event_date, registration_deadline,
      max_slots, cover_url, category, type, meeting_link, is_mandatory, active,
    } = body;

    const svc = createServiceClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() ?? null;
    if (location !== undefined) updates.location = location?.trim() ?? null;
    if (event_date !== undefined) updates.event_date = event_date;
    if (registration_deadline !== undefined) updates.registration_deadline = registration_deadline ?? null;
    if (max_slots !== undefined) updates.max_slots = max_slots;
    if (cover_url !== undefined) updates.cover_url = cover_url ?? null;
    if (category !== undefined) updates.category = category;
    if (type !== undefined) updates.type = type;
    if (meeting_link !== undefined) updates.meeting_link = meeting_link?.trim() ?? null;
    if (is_mandatory !== undefined) updates.is_mandatory = is_mandatory;
    if (active !== undefined) updates.active = active;

    const { error } = await svc.from("events").update(updates).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { error } = await svc.from("events").update({ active: false }).eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
