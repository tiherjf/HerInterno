export const revalidate = 60;
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/staff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Newspaper,
  GraduationCap,
  Stethoscope,
  Activity,
  TrendingUp,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboard() {
  await requireAdmin();

  let usersCount = 0, newsCount = 0, trainingsCount = 0, patientsCount = 0;
  let recentLogs: { id: string; action: string; module: string; user_type: string; created_at: string }[] = [];

  try {
    const supabase = createClient();
    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("active", true),
      supabase.from("news").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("trainings").select("*", { count: "exact", head: true }).eq("active", true),
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    usersCount = r1.count || 0;
    newsCount = r2.count || 0;
    trainingsCount = r3.count || 0;
    patientsCount = r4.count || 0;
    recentLogs = r5.data || [];
  } catch {
    // Supabase não configurado
  }

  const stats = [
    { label: "Colaboradores Ativos", value: usersCount || 0, icon: Users, color: "blue" },
    { label: "Notícias Publicadas", value: newsCount || 0, icon: Newspaper, color: "green" },
    { label: "Treinamentos", value: trainingsCount || 0, icon: GraduationCap, color: "purple" },
    { label: "Pacientes Cadastrados", value: patientsCount || 0, icon: Stethoscope, color: "red" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    red: "bg-red-100 text-red-600",
    orange: "bg-orange-100 text-orange-600",
  };

  const moduleLabels: Record<string, string> = {
    assistente: "Assistente IA",
    pacientes: "Portal Paciente",
    intranet: "Intranet",
    treinamentos: "Treinamentos",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Painel Administrativo</h2>
        <p className="text-muted-foreground">Visão geral do sistema — Hospital Evandro Ribeiro</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[stat.color]}`}>
                  <Icon size={20} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Log de atividades recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={18} /> Atividades Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs && recentLogs.length > 0 ? (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        log.user_type === "patient" ? "bg-orange-400" : "bg-blue-400"
                      }`}
                    />
                    <div>
                      <span className="text-sm font-medium capitalize">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {moduleLabels[log.module] || log.module}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma atividade registrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Links rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/admin/usuarios", label: "Gerenciar Usuários", icon: Users },
          { href: "/admin/pacientes", label: "Gerenciar Pacientes", icon: Stethoscope },
          { href: "/admin/chatbot", label: "Base de Conhecimento", icon: TrendingUp },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-2 p-4 bg-white border rounded-xl hover:shadow-md transition-shadow text-center"
            >
              <Icon size={24} className="text-primary" />
              <span className="text-sm font-medium">{link.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
