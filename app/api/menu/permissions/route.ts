import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/menu/types";

async function getAuthorizedUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .eq("active", true)
    .single();

  if (!profile || !["admin", "ti", "marketing"].includes(profile.role)) return null;
  return profile as { id: string; role: StaffRole };
}

export async function PUT(req: NextRequest) {
  const profile = await getAuthorizedUser();
  if (!profile) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { items } = body as {
    items: Array<{ key: string; can_view: StaffRole[]; can_edit: StaffRole[]; active: boolean }>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();
  const errors: string[] = [];

  await Promise.all(
    items.map(async ({ key, can_view, can_edit, active }) => {
      if (!key) return;
      const safeView = Array.from(new Set([...can_view, "admin", "ti"])) as StaffRole[];
      const safeEdit = Array.from(new Set([...can_edit, "admin", "ti"])) as StaffRole[];

      const { error } = await svc
        .from("menu_permissions")
        .update({
          can_view: safeView,
          can_edit: safeEdit,
          active,
          updated_at: now,
          updated_by: profile.id,
        })
        .eq("key", key);

      if (error) errors.push(`${key}: ${error.message}`);
    })
  );

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated_at: now });
}
