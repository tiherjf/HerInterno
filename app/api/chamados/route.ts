import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET — lista tickets
// ?view=own (default) | all | unassigned | my_assigned
export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const isAgent = ["admin", "ti", "rh"].includes(profile.role);
    const view = req.nextUrl.searchParams.get("view") ?? "own";
    const status = req.nextUrl.searchParams.get("status") ?? "";
    const priority = req.nextUrl.searchParams.get("priority") ?? "";
    const category = req.nextUrl.searchParams.get("category") ?? "";
    const search = req.nextUrl.searchParams.get("q") ?? "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");

    const supabase = isAgent ? createServiceClient() : createClient();

    let query = supabase
      .from("tickets")
      .select(`
        id, number, title, priority, status, requester_name, requester_sector,
        created_at, updated_at, sla_deadline, first_response_at, resolved_at,
        rating,
        ticket_categories(id, name, color, sla_hours),
        assigned:profiles!assigned_to(id, full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isAgent || view === "own") {
      query = query.eq("requester_id", profile.id);
    } else if (view === "unassigned") {
      query = query.is("assigned_to", null).neq("status", "closed").neq("status", "cancelled");
    } else if (view === "my_assigned") {
      query = query.eq("assigned_to", profile.id);
    }

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category_id", category);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tickets: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — abre novo chamado
export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const { title, description, category_id, priority = "medium" } = await req.json();

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Título e descrição são obrigatórios" }, { status: 400 });
    }

    const supabase = createClient();

    // busca SLA da categoria para calcular prazo
    let sla_deadline: string | null = null;
    if (category_id) {
      const { data: cat } = await supabase
        .from("ticket_categories")
        .select("sla_hours")
        .eq("id", category_id)
        .single();
      if (cat?.sla_hours) {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + cat.sla_hours);
        sla_deadline = deadline.toISOString();
      }
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        title: title.trim(),
        description: description.trim(),
        category_id: category_id || null,
        priority,
        requester_id: profile.id,
        requester_name: profile.full_name,
        requester_sector: profile.sector || null,
        sla_deadline,
      })
      .select("id, number")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, id: data.id, number: data.number }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
