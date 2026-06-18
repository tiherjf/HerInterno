import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";

export async function GET() {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, sector")
      .eq("active", true)
      .order("full_name");
    return NextResponse.json({ users: data || [] });
  } catch {
    return NextResponse.json({ users: [] });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "ti"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { email, password, full_name, role, sector, unit, phone_ext } = await req.json();

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Criar usuário no Supabase Auth
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

  // Criar perfil
  const { error: profileError } = await serviceClient.from("profiles").insert({
    id: newUser.user.id,
    full_name,
    role,
    sector: sector || null,
    unit: unit || "Matriz",
    phone_ext: phone_ext || null,
    active: true,
  });

  if (profileError) {
    // Reverter criação do usuário
    await serviceClient.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: "Erro ao criar perfil" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: newUser.user.id });
}
