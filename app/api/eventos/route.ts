import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canManageEvents } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/auth/staff";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const { searchParams } = req.nextUrl;
    const view = searchParams.get("view") ?? "upcoming"; // upcoming | past | mine | all
    const category = searchParams.get("category") ?? "";
    const month = searchParams.get("month"); // YYYY-MM
    const now = new Date().toISOString();

    let query = supabase
      .from("events")
      .select(`
        id, title, description, location, event_date, registration_deadline,
        max_slots, slots_used, active, cover_url, category, type,
        meeting_link, is_mandatory, created_by, created_at
      `)
      .eq("active", true)
      .order("event_date", { ascending: view !== "past" });

    if (view === "upcoming") query = query.gte("event_date", now);
    else if (view === "past") query = query.lt("event_date", now);
    else if (view === "mine") {
      // handled client-side with registrations filter
    }
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString();
      const end = new Date(y, m, 1).toISOString();
      query = query.gte("event_date", start).lt("event_date", end);
    }
    if (category) query = query.eq("category", category);

    const { data: events, error } = await query.limit(100);
    if (error) throw error;

    // User's registrations + waitlist
    const [{ data: regs }, { data: waitlist }] = await Promise.all([
      supabase.from("event_registrations").select("event_id, checked_in, checked_in_at").eq("user_id", profile.id),
      supabase.from("event_waitlist").select("event_id, joined_at").eq("user_id", profile.id),
    ]);

    const regMap = new Map((regs ?? []).map(r => [r.event_id, r]));
    const waitMap = new Map((waitlist ?? []).map(w => [w.event_id, w]));

    const enriched = (events ?? []).map(ev => ({
      ...ev,
      is_registered: regMap.has(ev.id),
      checked_in: regMap.get(ev.id)?.checked_in ?? false,
      on_waitlist: waitMap.has(ev.id),
      waitlist_since: waitMap.get(ev.id)?.joined_at ?? null,
    }));

    return NextResponse.json({ events: enriched });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!canManageEvents(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title, description, location, event_date, registration_deadline,
      max_slots, cover_url, category, type, meeting_link, is_mandatory,
    } = body;

    if (!title?.trim() || !event_date) {
      return NextResponse.json({ error: "Título e data são obrigatórios" }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data, error } = await svc.from("events").insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      location: location?.trim() ?? null,
      event_date,
      registration_deadline: registration_deadline ?? null,
      max_slots: max_slots ?? 50,
      cover_url: cover_url ?? null,
      category: category ?? "outro",
      type: type ?? "presencial",
      meeting_link: meeting_link?.trim() ?? null,
      is_mandatory: is_mandatory ?? false,
      created_by: profile.id,
      active: true,
    }).select("id").single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
