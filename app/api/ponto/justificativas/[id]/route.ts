import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("justifications")
      .select(`
        *, profiles!user_id(full_name, sector),
        justification_types!type_id(name, requires_document)
      `)
      .eq("id", params.id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const isRH = ["admin", "ti", "rh"].includes(profile.role);
    if (data.user_id !== profile.id && !isRH && !profile.is_manager) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    // Histórico de alterações
    const { data: history } = await supabase
      .from("justification_history")
      .select("id, actor_name, action, previous_status, new_status, observation, created_at")
      .eq("justification_id", params.id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ justification: data, history: history ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const supabase = createServiceClient();
    const { action, observation } = await req.json();

    const { data: current } = await supabase
      .from("justifications")
      .select("id, status, user_id")
      .eq("id", params.id)
      .single();

    if (!current) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const isRH = ["admin", "ti", "rh"].includes(profile.role);
    const canManagerApprove = isRH || profile.is_manager;
    const now = new Date().toISOString();

    let update: Record<string, unknown> = { updated_at: now };
    let newStatus = "";

    if (action === "manager_approve" || action === "manager_reject") {
      if (current.status !== "pending") {
        return NextResponse.json({ error: "Apenas justificativas pendentes podem ser aprovadas pelo gestor" }, { status: 400 });
      }
      if (!canManagerApprove) {
        return NextResponse.json({ error: "Sem permissão para aprovação de gestor" }, { status: 403 });
      }
      newStatus = action === "manager_approve" ? "manager_approved" : "manager_rejected";
      update = {
        ...update,
        status: newStatus,
        manager_id: profile.id,
        manager_observation: observation || null,
        manager_reviewed_at: now,
      };
    } else if (action === "rh_approve" || action === "rh_reject") {
      if (current.status !== "manager_approved") {
        return NextResponse.json({ error: "Apenas justificativas aprovadas pelo gestor podem ser revisadas pelo RH" }, { status: 400 });
      }
      if (!isRH) {
        return NextResponse.json({ error: "Sem permissão para aprovação de RH" }, { status: 403 });
      }
      newStatus = action === "rh_approve" ? "approved" : "rejected";
      update = {
        ...update,
        status: newStatus,
        rh_id: profile.id,
        rh_observation: observation || null,
        rh_reviewed_at: now,
      };
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const { error } = await supabase.from("justifications").update(update).eq("id", params.id);
    if (error) throw error;

    // Registra histórico
    await supabase.from("justification_history").insert({
      justification_id: params.id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      action,
      previous_status: current.status,
      new_status: newStatus,
      observation: observation?.trim() || null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
