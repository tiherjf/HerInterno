import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPatientToken, PATIENT_COOKIE } from "@/lib/auth/patient";
import { createReadStream, statSync } from "fs";
import path from "path";

const VIDEO_BASE_PATH = process.env.VIDEO_STORAGE_PATH || "/mnt/exames";

export async function GET(
  req: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    // Validar JWT do paciente
    const token = req.cookies.get(PATIENT_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const patient = await verifyPatientToken(token);
    if (!patient) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Buscar exame e verificar propriedade
    const supabase = createServiceClient();
    const { data: exam, error } = await supabase
      .from("exams")
      .select("id, patient_id, video_filename, exam_type")
      .eq("id", params.examId)
      .single();

    if (error || !exam) {
      return NextResponse.json({ error: "Exame não encontrado" }, { status: 404 });
    }

    if (exam.patient_id !== patient.sub) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (!exam.video_filename) {
      return NextResponse.json({ error: "Vídeo não disponível" }, { status: 404 });
    }

    // Construir path seguro (sem traversal)
    const sanitizedFilename = path.basename(exam.video_filename);
    const filePath = path.join(VIDEO_BASE_PATH, sanitizedFilename);

    let fileStats;
    try {
      fileStats = statSync(filePath);
    } catch {
      return NextResponse.json({ error: "Arquivo não encontrado no servidor" }, { status: 404 });
    }

    const fileSize = fileStats.size;
    const rangeHeader = req.headers.get("range");

    // Log de acesso ao vídeo
    await supabase.from("activity_logs").insert({
      user_id: patient.sub,
      user_type: "patient",
      action: "video_access",
      module: "pacientes",
      metadata: { exam_id: params.examId },
    });

    if (rangeHeader) {
      // Suporte a Range requests para seek no player
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });

      return new Response(stream as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": "video/mp4",
          "Cache-Control": "no-store",
        },
      });
    } else {
      // Resposta completa
      const stream = createReadStream(filePath);
      return new Response(stream as any, {
        headers: {
          "Content-Length": fileSize.toString(),
          "Content-Type": "video/mp4",
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    console.error("Video streaming error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
