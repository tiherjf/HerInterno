import { NextRequest, NextResponse } from "next/server";
import { requireStaff, canDeleteNews } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/auth/staff";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const canEdit = await canEditMenuItem("noticias", profile.role as StaffRole);
    const supabase = canEdit ? createServiceClient() : createClient();

    let query = supabase
      .from("news")
      .select(`
        id, title, summary, body, category, status,
        cover_url, author_id, published_at, scheduled_for,
        profiles!author_id(full_name)
      `)
      .eq("id", params.id);

    if (!canEdit) query = query.eq("status", "published");

    const { data, error } = await query.single();
    if (error || !data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const profiles = data.profiles as unknown as { full_name: string } | null;
    const news = {
      ...data,
      author_name: profiles?.full_name ?? null,
    };

    return NextResponse.json({ news });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!(await canEditMenuItem("noticias", profile.role as StaffRole))) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const svc = createServiceClient();
    const { data: existing } = await svc
      .from("news").select("author_id").eq("id", params.id).single();
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const isAdminOrTi = ["admin", "ti"].includes(profile.role);
    if (!isAdminOrTi && existing.author_id !== profile.id) {
      return NextResponse.json({ error: "Você só pode editar suas próprias notícias" }, { status: 403 });
    }

    const body = await req.json();
    const { title, summary, body: content, category, cover_url, status, scheduled_for } = body;

    if (!title?.trim() || !category) {
      return NextResponse.json({ error: "Título e categoria são obrigatórios" }, { status: 400 });
    }

    let published_at: string | null = null;
    let resolvedStatus = status ?? "draft";

    if (status === "scheduled" && scheduled_for) {
      resolvedStatus = "published";
      published_at = new Date(scheduled_for).toISOString();
    } else if (status === "published") {
      published_at = new Date().toISOString();
    }

    const { error } = await svc.from("news").update({
      title: title.trim(),
      summary: summary ?? "",
      body: content ?? "",
      category,
      cover_url: cover_url ?? null,
      status: resolvedStatus,
      published_at,
      scheduled_for: scheduled_for ? new Date(scheduled_for).toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    if (!canDeleteNews(profile.role as StaffRole)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const { error } = await svc.from("news").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
