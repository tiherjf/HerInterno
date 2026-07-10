import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("noticias", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const { title, summary, body: content, category, cover_url, status, scheduled_for } = body;

    if (!title?.trim() || !category) {
      return NextResponse.json({ error: "Título e categoria são obrigatórios" }, { status: 400 });
    }

    let published_at: string | null = null;
    let resolvedStatus = status ?? "draft";

    if (status === "scheduled" && scheduled_for) {
      // Notícia agendada fica com status published e published_at futuro;
      // a listagem só exibe published_at <= now
      resolvedStatus = "published";
      published_at = new Date(scheduled_for).toISOString();
    } else if (status === "published") {
      published_at = new Date().toISOString();
    }

    const svc = createServiceClient();
    const { data, error } = await svc.from("news").insert({
      title: title.trim(),
      summary: summary ?? "",
      body: content ?? "",
      category,
      cover_url: cover_url ?? null,
      status: resolvedStatus,
      author_id: profile.id,
      published_at,
      scheduled_for: scheduled_for ? new Date(scheduled_for).toISOString() : null,
    }).select("id").single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
