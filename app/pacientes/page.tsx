export const dynamic = "force-dynamic";
import { requirePatient } from "@/lib/auth/patient";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Video, Calendar, FileVideo, Info } from "lucide-react";

export default async function PacientesHome() {
  const patient = await requirePatient();

  let exams: { id: string; exam_type: string; exam_date: string; description: string; video_filename: string }[] = [];
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("exams")
      .select("id, exam_type, exam_date, description, video_filename")
      .eq("patient_id", patient.sub)
      .order("exam_date", { ascending: false });
    exams = data || [];
  } catch {
    // Supabase não configurado
  }

  return (
    <div className="space-y-8">
      {/* Boas-vindas */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
            <FileVideo size={28} className="text-[#1e40af]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Olá, {patient.name.split(" ")[0]}!</h2>
            <p className="text-gray-500">
              Aqui você pode visualizar seus exames de vídeo realizados no hospital.
            </p>
          </div>
        </div>
      </div>

      {/* Aviso de privacidade */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Seus exames são confidenciais e acessíveis somente a você. Por segurança, o acesso
          expira automaticamente após 12 horas.
        </p>
      </div>

      {/* Lista de exames */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Meus Exames ({exams.length})
        </h3>

        {exams.length > 0 ? (
          <div className="space-y-3">
            {exams.map((exam) => (
              <Link key={exam.id} href={`/pacientes/exame/${exam.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                      <Video size={24} className="text-[#1e40af]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-gray-800 text-lg">
                          {exam.exam_type || "Exame de Vídeo"}
                        </h4>
                        <span className="text-sm text-muted-foreground shrink-0 flex items-center gap-1">
                          <Calendar size={14} />
                          {exam.exam_date ? formatDate(exam.exam_date) : "—"}
                        </span>
                      </div>
                      {exam.description && (
                        <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">
                          {exam.description}
                        </p>
                      )}
                      <p className="text-primary text-sm font-medium mt-1">
                        Clique para assistir →
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FileVideo size={56} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xl text-gray-500 font-medium">Nenhum exame disponível</p>
            <p className="text-gray-400 mt-2 text-sm">
              Quando seus exames forem liberados pelo hospital, eles aparecerão aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
