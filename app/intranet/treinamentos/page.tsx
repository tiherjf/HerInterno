export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { canEditMenuItem } from "@/lib/menu/server";
import type { StaffRole } from "@/lib/menu/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GraduationCap, Plus, Clock, CheckCircle, Lock } from "lucide-react";

export default async function TreinamentosPage() {
  const profile = await requireStaff();
  const canManage = await canEditMenuItem("treinamentos", profile.role as StaffRole);

  let trainings: { id: string; title: string; description: string; workload_hours: number; passing_score: number }[] = [];
  let completionMap = new Map<string, { training_id: string; score: number; completed_at: string; certificate_url: string }>();

  try {
    const supabase = createClient();

    const { data: trainingsData } = await supabase
      .from("trainings")
      .select("id, title, description, workload_hours, passing_score")
      .eq("active", true)
      .order("created_at", { ascending: false });

    const { data: completions } = await supabase
      .from("training_completions")
      .select("training_id, score, completed_at, certificate_url")
      .eq("user_id", profile.id);

    trainings = trainingsData || [];
    completionMap = new Map((completions || []).map((c: { training_id: string; score: number; completed_at: string; certificate_url: string }) => [c.training_id, c]));
  } catch {
    // Supabase não configurado
  }

  const completed = trainings.filter((t) => completionMap.has(t.id));
  const pending = trainings.filter((t) => !completionMap.has(t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Treinamentos</h2>
          <p className="text-muted-foreground">
            {completed.length} concluído(s) · {pending.length} pendente(s)
          </p>
        </div>
        {canManage && (
          <Link href="/admin/treinamentos/novo">
            <Button>
              <Plus size={16} /> Novo Treinamento
            </Button>
          </Link>
        )}
      </div>

      {/* Pendentes */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Pendentes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((t) => (
              <Link key={t.id} href={`/intranet/treinamentos/${t.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <GraduationCap className="text-purple-600" size={20} />
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                        Pendente
                      </span>
                    </div>
                    <h4 className="font-semibold mb-1 line-clamp-2">{t.title}</h4>
                    {t.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {t.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {t.workload_hours}h
                      </span>
                      <span>Mínimo: {t.passing_score}%</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Concluídos */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Concluídos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((t) => {
              const completion = completionMap.get(t.id)!;
              return (
                <Card key={t.id} className="border-green-200 bg-green-50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="text-green-600" size={20} />
                      </div>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                        Concluído
                      </span>
                    </div>
                    <h4 className="font-semibold mb-1">{t.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span>Nota: {completion.score}%</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {t.workload_hours}h
                      </span>
                    </div>
                    {completion.certificate_url && (
                      <a
                        href={completion.certificate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Baixar Certificado →
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {trainings.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">Nenhum treinamento disponível.</p>
        </div>
      )}
    </div>
  );
}
