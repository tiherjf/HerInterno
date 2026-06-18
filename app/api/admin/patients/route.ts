import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { cleanCPF } from "@/lib/utils";

async function isAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile && ["admin", "ti"].includes(profile.role);
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const search = req.nextUrl.searchParams.get("search");

  let query = supabase
    .from("patients")
    .select("id, cpf, full_name, birth_date, created_at")
    .order("full_name");

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,cpf.ilike.%${search}%`);
  }

  const { data: patients } = await query;
  return NextResponse.json({ patients: patients || [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { cpf, full_name, birth_date, password } = await req.json();
  const cleanedCPF = cleanCPF(cpf);

  if (!cleanedCPF || cleanedCPF.length !== 11 || !full_name || !password) {
    return NextResponse.json({ error: "Dados obrigatórios inválidos" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = createServiceClient();

  const { error } = await supabase.from("patients").insert({
    cpf: cleanedCPF,
    full_name,
    birth_date: birth_date || null,
    password_hash: passwordHash,
  });

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "CPF já cadastrado" : "Erro ao cadastrar paciente" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
