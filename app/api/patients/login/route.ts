import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { signPatientToken, PATIENT_COOKIE } from "@/lib/auth/patient";
import bcrypt from "bcryptjs";
import { cleanCPF } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { cpf, password } = await req.json();

    if (!cpf || !password) {
      return NextResponse.json({ error: "CPF e senha são obrigatórios" }, { status: 400 });
    }

    const cleanedCPF = cleanCPF(cpf);
    if (cleanedCPF.length !== 11) {
      return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: patient, error } = await supabase
      .from("patients")
      .select("id, cpf, full_name, password_hash")
      .eq("cpf", cleanedCPF)
      .single();

    if (error || !patient) {
      return NextResponse.json({ error: "CPF ou senha incorretos" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, patient.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "CPF ou senha incorretos" }, { status: 401 });
    }

    const token = await signPatientToken({
      sub: patient.id,
      cpf: patient.cpf,
      name: patient.full_name,
    });

    // Log de acesso
    await supabase.from("activity_logs").insert({
      user_id: patient.id,
      user_type: "patient",
      action: "login",
      module: "pacientes",
      metadata: { cpf: cleanedCPF.slice(-4) },
    });

    const response = NextResponse.json({ ok: true, name: patient.full_name });
    response.cookies.set(PATIENT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12, // 12 horas
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Patient login error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
