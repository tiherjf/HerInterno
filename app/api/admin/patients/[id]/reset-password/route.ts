import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "ti", "recepcao"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { password } = await req.json();
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "Senha muito curta" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const serviceClient = createServiceClient();

  const { error } = await serviceClient
    .from("patients")
    .update({ password_hash: passwordHash })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "Erro ao redefinir senha" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
