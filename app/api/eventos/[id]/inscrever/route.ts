import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const svc = createServiceClient();

    const { data: ev } = await supabase
      .from("events")
      .select("max_slots, slots_used, registration_deadline, active")
      .eq("id", params.id)
      .single();

    if (!ev?.active) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

    if (ev.registration_deadline && new Date(ev.registration_deadline) < new Date()) {
      return NextResponse.json({ error: "Prazo de inscrição encerrado" }, { status: 400 });
    }

    const isFull = ev.slots_used >= ev.max_slots;

    if (isFull) {
      // Entrar na fila de espera
      const { error } = await supabase.from("event_waitlist").insert({
        event_id: params.id,
        user_id: profile.id,
      });
      if (error?.code === "23505") return NextResponse.json({ error: "Já na fila" }, { status: 409 });
      if (error) throw error;

      const { count } = await supabase.from("event_waitlist")
        .select("*", { count: "exact", head: true })
        .eq("event_id", params.id)
        .lte("joined_at", new Date().toISOString());

      return NextResponse.json({ ok: true, status: "waitlist", position: count ?? 1 });
    }

    // Inscrição normal
    const { error } = await supabase.from("event_registrations").insert({
      event_id: params.id,
      user_id: profile.id,
    });
    if (error?.code === "23505") return NextResponse.json({ error: "Já inscrito" }, { status: 409 });
    if (error) throw error;

    return NextResponse.json({ ok: true, status: "registered" });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createClient();
    const svc = createServiceClient();

    // Tentar cancelar inscrição
    const { error: regErr, count } = await supabase.from("event_registrations")
      .delete({ count: "exact" })
      .eq("event_id", params.id)
      .eq("user_id", profile.id);

    if (!regErr && (count ?? 0) > 0) {
      // Promover primeiro da fila de espera
      const { data: next } = await svc.from("event_waitlist")
        .select("user_id")
        .eq("event_id", params.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (next) {
        await svc.from("event_registrations").insert({
          event_id: params.id,
          user_id: next.user_id,
        });
        await svc.from("event_waitlist")
          .delete()
          .eq("event_id", params.id)
          .eq("user_id", next.user_id);
      }
      return NextResponse.json({ ok: true, status: "unregistered" });
    }

    // Tentar sair da fila de espera
    await supabase.from("event_waitlist")
      .delete()
      .eq("event_id", params.id)
      .eq("user_id", profile.id);

    return NextResponse.json({ ok: true, status: "left_waitlist" });
  } catch (err) {
    return apiError(err);
  }
}
