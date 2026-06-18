"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, XCircle, Trophy, Download, Loader2, Play } from "lucide-react";
import Link from "next/link";

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

interface Training {
  id: string;
  title: string;
  description: string;
  video_url: string;
  material_url: string;
  workload_hours: number;
  passing_score: number;
}

export default function TreinamentoPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = createClient();

  const [training, setTraining] = useState<Training | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [phase, setPhase] = useState<"video" | "quiz" | "result">("video");
  const [videoWatched, setVideoWatched] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile) setUserName(profile.full_name);

      const { data: tr } = await supabase
        .from("trainings")
        .select("*")
        .eq("id", params.id)
        .single();
      if (tr) setTraining(tr);

      const { data: qs } = await supabase
        .from("training_questions")
        .select("*")
        .eq("training_id", params.id);
      if (qs) setQuestions(qs);

      const { data: completion } = await supabase
        .from("training_completions")
        .select("*")
        .eq("training_id", params.id)
        .eq("user_id", user.id)
        .single();

      if (completion) {
        setAlreadyCompleted(true);
        setResult({ score: completion.score, passed: true });
        setCertificateUrl(completion.certificate_url || "");
        setPhase("result");
      }

      setLoading(false);
    }
    load();
  }, [params.id, supabase]);

  async function submitQuiz() {
    if (!training || !userId) return;
    setSubmitting(true);

    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correct_index) correct++;
    }
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 100;
    const passed = score >= training.passing_score;

    setResult({ score, passed });

    if (passed) {
      // Gerar certificado
      const res = await fetch(`/api/certificates/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, score }),
      });
      const data = await res.json();

      await supabase.from("training_completions").upsert({
        training_id: params.id,
        user_id: userId,
        score,
        completed_at: new Date().toISOString(),
        certificate_url: data.url || "",
      });
      setCertificateUrl(data.url || "");
    }

    setPhase("result");
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!training) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Treinamento não encontrado.</p>
        <Link href="/intranet/treinamentos">
          <Button variant="outline" className="mt-4">Voltar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/intranet/treinamentos">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} /> Voltar
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{training.title}</h2>
          <p className="text-muted-foreground text-sm">
            {training.workload_hours}h · Mínimo para aprovação: {training.passing_score}%
          </p>
        </div>
      </div>

      {/* Fase: Vídeo */}
      {phase === "video" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-lg">
              <div className="aspect-video bg-black">
                <video
                  src={training.video_url}
                  controls
                  controlsList="nodownload"
                  onEnded={() => setVideoWatched(true)}
                  className="w-full h-full"
                />
              </div>
            </CardContent>
          </Card>

          {training.description && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Sobre este treinamento</h3>
                <p className="text-sm text-muted-foreground">{training.description}</p>
              </CardContent>
            </Card>
          )}

          {training.material_url && (
            <a href={training.material_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">
                <Download size={16} /> Baixar Material de Apoio
              </Button>
            </a>
          )}

          {questions.length > 0 && (
            <Button
              className="w-full"
              disabled={!videoWatched}
              onClick={() => setPhase("quiz")}
            >
              {videoWatched ? "Fazer Avaliação" : "Assista ao vídeo até o final para liberar a avaliação"}
            </Button>
          )}
          {questions.length === 0 && videoWatched && (
            <Button className="w-full" onClick={() => submitQuiz()}>
              Concluir Treinamento
            </Button>
          )}
        </div>
      )}

      {/* Fase: Quiz */}
      {phase === "quiz" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Avaliação — {questions.length} questões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="space-y-3">
                  <p className="font-medium">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt: string, oi: number) => (
                      <label
                        key={oi}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          answers[q.id] === oi
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={oi}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                          className="text-primary"
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <Button
                className="w-full"
                disabled={Object.keys(answers).length < questions.length || submitting}
                onClick={submitQuiz}
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Processando...</>
                ) : (
                  "Enviar Respostas"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fase: Resultado */}
      {phase === "result" && result && (
        <Card className={result.passed ? "border-green-200" : "border-red-200"}>
          <CardContent className="p-8 text-center space-y-4">
            {result.passed ? (
              <>
                <CheckCircle size={64} className="mx-auto text-green-500" />
                <h3 className="text-2xl font-bold text-green-700">Parabéns! Aprovado!</h3>
                <p className="text-lg">Você obteve {result.score}% de acertos.</p>
                {certificateUrl ? (
                  <a href={certificateUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="mt-2">
                      <Download size={16} /> Baixar Certificado
                    </Button>
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Gerando certificado...</p>
                )}
              </>
            ) : (
              <>
                <XCircle size={64} className="mx-auto text-red-400" />
                <h3 className="text-2xl font-bold text-red-700">Não Aprovado</h3>
                <p className="text-lg">
                  Você obteve {result.score}%. Mínimo: {training.passing_score}%.
                </p>
                <Button onClick={() => { setPhase("video"); setAnswers({}); setResult(null); }}>
                  Tentar Novamente
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
