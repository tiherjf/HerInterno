import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const isRH = ["admin", "ti", "rh"].includes(profile.role);
    const canManagerApprove = isRH || profile.is_manager;

    const { ids, action, observation } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Lista de IDs obrigatória" }, { status: 400 });
    }
    if (!["manager_approve", "manager_reject", "rh_approve", "rh_reject"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
    if ((action === "manager_reject" || action === "rh_reject") && !observation?.trim()) {
      return NextResponse.json({ error: "Observação obrigatória para recusa" }, { status: 400 });
    }
    if ((action === "manager_approve" || action === "manager_reject") && !canManagerApprove) {
      return NextResponse.json({ error: "Sem permissão de gestor" }, { status: 403 });
    }
    if ((action === "rh_approve" || action === "rh_reject") && !isRH) {
      return NextResponse.json({ error: "Sem permissão de RH" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const requiredStatus = action.startsWith("manager") ? "pending" : "manager_approved";
    const statusMap: Record<string, string> = { manager_approve: "manager_approved", manager_reject: "manager_rejected", rh_approve: "approved", rh_reject: "rejected" };
    const newStatus = statusMap[action]!;

    // busca todos de uma vez para validar status atual
    const { data: rows } = await supabase
      .from("justifications")
      .select("id, status")
      .in("id", ids);

    const valid = (rows ?? []).filter(r => r.status === requiredStatus).map(r => r.id);
    const skipped = ids.length - valid.length;

    if (valid.length === 0) {
      return NextResponse.json({ error: "Nenhum item estava no status adequado para esta ação", skipped }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};
    if (action.startsWith("manager")) {
      Object.assign(updateFields, { status: newStatus, manager_id: profile.id, manager_observation: observation?.trim() || null, manager_reviewed_at: now });
    } else {
      Object.assign(updateFields, { status: newStatus, rh_id: profile.id, rh_observation: observation?.trim() || null, rh_reviewed_at: now });
    }

    const { error } = await supabase.from("justifications").update(updateFields).in("id", valid);
    if (error) throw error;

    // Registra histórico em lote
    const historyRows = valid.map(id => ({
      justification_id: id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      action,
      previous_status: requiredStatus,
      new_status: newStatus,
      observation: observation?.trim() || null,
    }));
    await supabase.from("justification_history").insert(historyRows);

    return NextResponse.json({ ok: true, processed: valid.length, skipped });
  } catch (err) {
    return apiError(err);
  }
}
