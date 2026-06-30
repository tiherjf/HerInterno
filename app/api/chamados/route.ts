import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Determina a equipe do agente (ti, manutencao ou marketing)
function agentTeam(role: string): string | null {
  if (role === "admin") return null; // admin vê tudo
  if (role === "ti") return "ti";
  if (role === "manutencao") return "manutencao";
  if (role === "marketing") return "marketing";
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const view = req.nextUrl.searchParams.get("view") ?? "own";
    const status = req.nextUrl.searchParams.get("status") ?? "";
    const priority = req.nextUrl.searchParams.get("priority") ?? "";
    const category = req.nextUrl.searchParams.get("category") ?? "";
    const search = req.nextUrl.searchParams.get("q") ?? "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
    const dateFrom = req.nextUrl.searchParams.get("date_from") ?? "";
    const dateTo = req.nextUrl.searchParams.get("date_to") ?? "";
    const sector = req.nextUrl.searchParams.get("sector") ?? "";
    const responsible = req.nextUrl.searchParams.get("responsible") ?? "";
    const teamFilter = req.nextUrl.searchParams.get("team") ?? "";

    const isAgent = ["admin", "ti", "rh", "manutencao", "marketing"].includes(profile.role);
    const supabase = isAgent ? createServiceClient() : createClient();

    let query = supabase
      .from("tickets")
      .select(`
        id, number, title, priority, status, requester_name, requester_sector,
        created_at, updated_at, sla_deadline, first_response_at, resolved_at,
        rating, team,
        ticket_categories(id, name, color, sla_hours, team),
        assigned:profiles!assigned_to(id, full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isAgent || view === "own") {
      query = query.eq("requester_id", profile.id);
    } else if (view === "unassigned") {
      query = query
        .is("assigned_to", null)
        .neq("status", "closed")
        .neq("status", "cancelled");
    } else if (view === "my_assigned") {
      query = query.eq("assigned_to", profile.id);
    }

    // Filtro por equipe: ti vê só tickets de ti, manutencao vê só manutencao
    const team = agentTeam(profile.role);
    if (team && isAgent && view !== "own") {
      query = query.eq("team", team);
    }

    if (teamFilter) query = query.eq("team", teamFilter);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category_id", category);
    if (search) query = query.ilike("title", `%${search}%`);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
    if (sector) query = query.ilike("requester_sector", `%${sector}%`);
    if (responsible) query = query.eq("assigned_to", responsible);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tickets: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const { title, description, category_id, priority = "medium", team: requestedTeam } = await req.json();

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Título e descrição são obrigatórios" }, { status: 400 });
    }

    const supabase = createClient();

    const VALID_TEAMS = ["ti", "manutencao", "marketing"];
    let sla_deadline: string | null = null;
    let ticketTeam = VALID_TEAMS.includes(requestedTeam) ? requestedTeam : "ti";

    let resolvedPriority = priority;
    if (category_id) {
      const { data: cat } = await supabase
        .from("ticket_categories")
        .select("sla_hours, team, default_priority")
        .eq("id", category_id)
        .single();
      if (cat?.sla_hours) {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + cat.sla_hours);
        sla_deadline = deadline.toISOString();
      }
      if (cat?.team) ticketTeam = cat.team;
      // Aplica prioridade padrão da categoria se não foi explicitamente definida
      if (cat?.default_priority && priority === "medium") {
        resolvedPriority = cat.default_priority;
      }
    }

    const { data, error } = await supabase
      .from("tickets")
      .insert({
        title: title.trim(),
        description: description.trim(),
        category_id: category_id || null,
        priority: resolvedPriority,
        team: ticketTeam,
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
