import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyPatientToken, PATIENT_COOKIE } from "@/lib/auth/patient";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get(PATIENT_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const patient = await verifyPatientToken(token);
  if (!patient) return NextResponse.json({ error: "Token inválido" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: exam } = await supabase
    .from("exams")
    .select("id, exam_type, exam_date, description, patient_id")
    .eq("id", params.id)
    .eq("patient_id", patient.sub)
    .single();

  if (!exam) return NextResponse.json({ error: "Exame não encontrado" }, { status: 404 });

  return NextResponse.json(exam);
}
