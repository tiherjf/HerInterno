import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const VIDEO_BASE_PATH = process.env.VIDEO_STORAGE_PATH || "/mnt/exames";

async function isAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, userId: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, id")
    .eq("id", user.id)
    .single();

  return {
    ok: profile ? ["admin", "ti", "recepcao"].includes(profile.role) : false,
    userId: user.id,
  };
}

export async function GET(req: NextRequest) {
  const { ok } = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const search = req.nextUrl.searchParams.get("search");
  const patientId = req.nextUrl.searchParams.get("patient");
  const supabase = createServiceClient();

  let query = supabase
    .from("exams")
    .select("*, patients!patient_id(full_name, cpf)")
    .order("created_at", { ascending: false });

  if (patientId) query = query.eq("patient_id", patientId);

  const { data: exams } = await query;
  const formatted = (exams || []).map((e) => ({
    ...e,
    patient_name: (e as any).patients?.full_name,
  }));

  if (search) {
    const filtered = formatted.filter(
      (e) =>
        e.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.exam_type?.toLowerCase().includes(search.toLowerCase())
    );
    return NextResponse.json({ exams: filtered });
  }

  return NextResponse.json({ exams: formatted });
}

export async function POST(req: NextRequest) {
  const { ok, userId } = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const formData = await req.formData();
  const patient_cpf = formData.get("patient_cpf") as string;
  const exam_type = formData.get("exam_type") as string;
  const exam_date = formData.get("exam_date") as string;
  const description = formData.get("description") as string;
  const videoFile = formData.get("video") as File | null;

  const supabase = createServiceClient();

  // Buscar paciente pelo CPF
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("cpf", patient_cpf)
    .single();

  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado. Cadastre o paciente primeiro." }, { status: 404 });
  }

  let videoFilename: string | null = null;

  if (videoFile && videoFile.size > 0) {
    // Salvar vídeo no servidor local
    try {
      await mkdir(VIDEO_BASE_PATH, { recursive: true });
      const ext = videoFile.name.split(".").pop() || "mp4";
      const filename = `${patient.id}_${Date.now()}.${ext}`;
      const filePath = path.join(VIDEO_BASE_PATH, filename);
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      await writeFile(filePath, buffer);
      videoFilename = filename;
    } catch (err) {
      console.error("Error saving video:", err);
      return NextResponse.json({ error: "Erro ao salvar vídeo no servidor" }, { status: 500 });
    }
  }

  const { error } = await supabase.from("exams").insert({
    patient_id: patient.id,
    exam_type: exam_type || null,
    exam_date: exam_date || null,
    description: description || null,
    video_filename: videoFilename,
    created_by: userId,
  });

  if (error) {
    return NextResponse.json({ error: "Erro ao cadastrar exame" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
