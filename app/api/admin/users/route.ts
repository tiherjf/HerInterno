import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, sector, unit, phone_ext, active, is_manager, manager_id")
      .order("full_name");
    return NextResponse.json({ users: data || [] });
  } catch (err) {
    console.error("[API]", err);
    return NextResponse.json({ users: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { email, password, full_name, role, sector, unit, phone_ext, is_manager, manager_id } =
      await req.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      return NextResponse.json(
        { error: createError?.message || "Erro ao criar usuário" },
        { status: 400 }
      );
    }

    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: newUser.user.id,
      full_name,
      role,
      sector: sector || null,
      unit: unit || "Matriz",
      phone_ext: phone_ext || null,
      is_manager: is_manager === true,
      manager_id: manager_id || null,
      active: true,
    });

    if (profileError) {
      await serviceClient.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: "Erro ao criar perfil" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: newUser.user.id });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id, full_name, role, sector, unit, phone_ext, is_manager, manager_id } =
      await req.json();

    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    // RH só pode alterar manager_id e is_manager
    const isRHOnly = profile.role === "rh";
    const updateData = isRHOnly
      ? {
          is_manager: is_manager === true,
          manager_id: manager_id || null,
        }
      : {
          full_name,
          role,
          sector: sector || null,
          unit: unit || "Matriz",
          phone_ext: phone_ext || null,
          is_manager: is_manager === true,
          manager_id: manager_id || null,
        };

    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from("profiles")
      .update(updateData)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
