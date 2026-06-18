"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, FileText, AlertCircle } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Exam {
  id: string;
  exam_type: string;
  exam_date: string;
  description: string;
  video_filename: string;
}

export default function ExamePage({ params }: { params: { id: string } }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadExam() {
      const res = await fetch(`/api/exams/${params.id}`);
      if (!res.ok) {
        setError("Exame não encontrado ou acesso não autorizado.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setExam(data);
      setLoading(false);
    }
    loadExam();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="text-center py-16">
        <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
        <p className="text-xl text-gray-600">{error || "Exame não encontrado."}</p>
        <Link href="/pacientes" className="mt-4 inline-block">
          <Button variant="outline">Voltar para meus exames</Button>
        </Link>
      </div>
    );
  }

  const videoSrc = `/api/videos/${params.id}`;

  return (
    <div className="space-y-6">
      <Link href="/pacientes">
        <Button variant="ghost" size="sm" className="text-gray-600">
          <ArrowLeft size={16} /> Voltar para meus exames
        </Button>
      </Link>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {exam.exam_type || "Exame de Vídeo"}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-gray-500 text-sm">
              <Calendar size={14} />
              {exam.exam_date ? formatDate(exam.exam_date) : "Data não informada"}
            </div>
          </div>

          {exam.description && (
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-600">{exam.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player de vídeo */}
      <Card>
        <CardContent className="p-2">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              className="w-full h-full"
              controls
              controlsList="nodownload"
              preload="metadata"
              src={videoSrc}
            >
              <p className="text-white p-4">
                Seu navegador não suporta reprodução de vídeo. Por favor, atualize o navegador.
              </p>
            </video>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
        <p className="text-sm text-yellow-800">
          <strong>Atenção:</strong> Este exame é de uso exclusivo do paciente. A gravação,
          reprodução ou compartilhamento não autorizado é proibido. Em caso de dúvidas, consulte
          seu médico responsável.
        </p>
      </div>
    </div>
  );
}
