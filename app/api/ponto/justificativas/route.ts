import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const d = result.getDay();
    if (d !== 0 && d !== 6) added++;
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();
    const view = new URL(req.url).searchParams.get("view") || "own";
    const isRH = ["admin", "ti", "rh"].includes(profile.role);

    let query = supabase
      .from("justifications")
      .select(`
        id, occurrence_date, is_full_day, start_time, end_time,
        description, document_url, deadline, status,
        manager_observation, manager_reviewed_at,
        rh_observation, rh_reviewed_at, created_at,
        user_id,
        profiles!user_id(full_name, sector),
        justification_types!type_id(id, name, requires_document)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (view === "own") {
      query = query.eq("user_id", profile.id);
    } else if (view === "team") {
      if (!isRH && !profile.is_manager) {
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }
      if (isRH) {
        query = query.eq("status", "pending");
      } else {
        // Gestor vê apenas seus subordinados diretos (manager_id = profile.id)
        const { data: subordinates } = await supabase
          .from("profiles")
          .select("id")
          .eq("manager_id", profile.id)
          .eq("active", true);
        const ids = (subordinates || []).map((u: { id: string }) => u.id);
        if (ids.length === 0) return NextResponse.json({ justifications: [] });
        query = query.in("user_id", ids).eq("status", "pending");
      }
    } else if (view === "pending_rh") {
      if (!isRH) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      query = query.eq("status", "manager_approved");
    } else if (view === "all") {
      if (!isRH) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      const url = new URL(req.url);
      const status = url.searchParams.get("status");
      const typeId = url.searchParams.get("type_id");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const userId = url.searchParams.get("user_id");
      if (status) query = query.eq("status", status);
      if (typeId) query = query.eq("type_id", typeId);
      if (from) query = query.gte("occurrence_date", from);
      if (to) query = query.lte("occurrence_date", to);
      if (userId) query = query.eq("user_id", userId);
    } else {
      return NextResponse.json({ error: "view inválido" }, { status: 400 });
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ justifications: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();
    const body = await req.json();
    const { type_id, occurrence_date, is_full_day, start_time, end_time, description } = body;

    if (!type_id || !occurrence_date || !description?.trim()) {
      return NextResponse.json({ error: "Tipo, data e descrição são obrigatórios" }, { status: 400 });
    }

    const occDate = new Date(occurrence_date + "T00:00:00");
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (occDate > today) {
      return NextResponse.json({ error: "Data de ocorrência não pode ser futura" }, { status: 400 });
    }

    // Verifica se o mês está fechado
    const month = occurrence_date.slice(0, 7); // YYYY-MM
    const { data: fechamento } = await supabase
      .from("ponto_fechamentos")
      .select("id")
      .eq("reference_month", month)
      .maybeSingle();
    if (fechamento) {
      return NextResponse.json({ error: `O período ${month} está fechado pelo RH. Não é possível criar justificativas.` }, { status: 400 });
    }

    const deadline = addBusinessDays(occDate, 3);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (deadline < now) {
      return NextResponse.json({ error: "Prazo de 3 dias úteis para justificar já expirou" }, { status: 400 });
    }

    const { data, error } = await supabase.from("justifications").insert({
      user_id: profile.id,
      type_id,
      occurrence_date,
      is_full_day: is_full_day !== false,
      start_time: is_full_day !== false ? null : (start_time || null),
      end_time: is_full_day !== false ? null : (end_time || null),
      description: description.trim(),
      deadline: deadline.toISOString().split("T")[0],
      status: "pending",
    }).select().single();

    if (error) throw error;

    // Registra histórico
    await supabase.from("justification_history").insert({
      justification_id: data.id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      action: "created",
      previous_status: null,
      new_status: "pending",
    });

    return NextResponse.json({ ok: true, justification: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
