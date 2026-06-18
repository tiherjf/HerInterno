import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/menu/types";

async function getAuthorizedUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .eq("active", true)
    .single();

  if (!profile || !["admin", "ti", "marketing"].includes(profile.role)) {
    return null;
  }
  return profile as { id: string; role: StaffRole };
}

export async function PUT(req: NextRequest) {
  const profile = await getAuthorizedUser();
  if (!profile) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { key, can_view, can_edit } = body as {
    key: string;
    can_view: StaffRole[];
    can_edit: StaffRole[];
  };

  if (!key || !Array.isArray(can_view) || !Array.isArray(can_edit)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Admin e TI sempre mantidos em can_view e can_edit
  const safeView = Array.from(new Set([...can_view, "admin", "ti"])) as StaffRole[];
  const safeEdit = Array.from(new Set([...can_edit, "admin", "ti"])) as StaffRole[];

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_permissions")
    .update({
      can_view: safeView,
      can_edit: safeEdit,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("key", key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
