export const revalidate = 60;
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Clock, FileCheck, FileX, Hourglass, Plus, AlertCircle,
  TrendingUp, TrendingDown, Users, ChevronRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:          { label: "Aguardando Gestor", color: "bg-yellow-100 text-yellow-800", icon: Hourglass },
  manager_approved: { label: "Aguardando RH",     color: "bg-blue-100 text-blue-800",    icon: Hourglass },
  manager_rejected: { label: "Recusada (Gestor)", color: "bg-red-100 text-red-800",      icon: FileX },
  approved:         { label: "Aprovada",           color: "bg-green-100 text-green-800",  icon: FileCheck },
  rejected:         { label: "Recusada (RH)",      color: "bg-red-100 text-red-800",      icon: FileX },
};

function minutesToHHMM(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}

export default async function PontoDashboard() {
  const profile = await requireStaff();
  const isRH = ["admin", "ti", "rh"].includes(profile.role);
  const isGestor = profile.is_manager || isRH;

  let myJustifications: Record<string, unknown>[] = [];
  let pendingTeam = 0;
  let pendingRH = 0;
  let hourBank: { overtime_minutes: number; reference_month: string }[] = [];

  try {
    const supabase = createServiceClient();

    // Minhas justificativas recentes
    const { data: j } = await supabase
      .from("justifications")
      .select("id, occurrence_date, status, justification_types!type_id(name)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);
    myJustifications = (j || []) as Record<string, unknown>[];

    // Contagem para gestores
    if (isGestor) {
      // Gestor comum: conta apenas subordinados diretos (mesmo filtro da tela de aprovações)
      let subordinateIds: string[] | null = null;
      if (!isRH) {
        const { data: subordinates } = await supabase
          .from("profiles")
          .select("id")
          .eq("manager_id", profile.id)
          .eq("active", true);
        subordinateIds = (subordinates || []).map((u: { id: string }) => u.id);
      }
      if (isRH || (subordinateIds && subordinateIds.length > 0)) {
        let teamQuery = supabase
          .from("justifications")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        if (subordinateIds) teamQuery = teamQuery.in("user_id", subordinateIds);
        const { count: teamCount } = await teamQuery;
        pendingTeam = teamCount || 0;
      }
    }

    // Contagem para RH
    if (isRH) {
      const { count: rhCount } = await supabase
        .from("justifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "manager_approved");
      pendingRH = rhCount || 0;
    }

    // Banco de horas (últimos 3 meses)
    const { data: hb } = await supabase
      .from("hour_bank")
      .select("overtime_minutes, reference_month")
      .eq("user_id", profile.id)
      .order("reference_month", { ascending: false })
      .limit(3);
    hourBank = (hb || []) as { overtime_minutes: number; reference_month: string }[];
  } catch {
    // sem Supabase
  }

  const totalBalance = hourBank.reduce((acc, r) => acc + r.overtime_minutes, 0);
  const pendingCount = myJustifications.filter(j => j.status === "pending" || j.status === "manager_approved").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Controle de Ponto</h2>
          <p className="text-muted-foreground">Justificativas e banco de horas</p>
        </div>
        <Link href="/intranet/ponto/justificativas/nova">
          <Button>
            <Plus size={16} /> Nova Justificativa
          </Button>
        </Link>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Hourglass size={18} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalBalance >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                {totalBalance >= 0
                  ? <TrendingUp size={18} className="text-green-600" />
                  : <TrendingDown size={18} className="text-red-600" />
                }
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Banco de Horas</p>
                <p className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {totalBalance >= 0 ? "+" : "-"}{minutesToHHMM(totalBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isGestor && (
          <Link href="/intranet/ponto/aprovacoes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg relative">
                    <Users size={18} className="text-orange-600" />
                    {pendingTeam > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {pendingTeam}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aprovações</p>
                    <p className="text-2xl font-bold">{pendingTeam}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {isRH && (
          <Link href="/intranet/ponto/rh">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg relative">
                    <FileCheck size={18} className="text-purple-600" />
                    {pendingRH > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {pendingRH}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aguard. RH</p>
                    <p className="text-2xl font-bold">{pendingRH}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minhas justificativas recentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock size={16} /> Minhas Justificativas Recentes
            </CardTitle>
            <Link href="/intranet/ponto/justificativas" className="text-xs text-primary hover:underline">
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {myJustifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma justificativa enviada ainda.
              </p>
            ) : (
              myJustifications.map((j) => {
                const info = STATUS_INFO[j.status as string] || STATUS_INFO.pending;
                const Icon = info.icon;
                const typeName = (j.justification_types as { name?: string })?.name || "—";
                return (
                  <Link key={j.id as string} href={`/intranet/ponto/justificativas`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={14} className="shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{typeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {j.occurrence_date ? formatDate(j.occurrence_date as string) : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${info.color}`}>
                        {info.label}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
            <Link href="/intranet/ponto/justificativas/nova" className="block pt-1">
              <Button variant="outline" size="sm" className="w-full">
                <Plus size={14} /> Nova Justificativa
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Banco de horas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp size={16} /> Banco de Horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourBank.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Saldo não disponível.</p>
                <p className="text-xs mt-1">O RH insere os dados mensalmente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hourBank.map((hb) => {
                  const isPos = hb.overtime_minutes >= 0;
                  const month = new Date(hb.reference_month + "T00:00:00").toLocaleString("pt-BR", {
                    month: "long", year: "numeric"
                  });
                  return (
                    <div key={hb.reference_month} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <span className="text-sm capitalize">{month}</span>
                      <span className={`font-bold text-sm ${isPos ? "text-green-700" : "text-red-700"}`}>
                        {isPos ? "+" : "-"}{minutesToHHMM(hb.overtime_minutes)}
                      </span>
                    </div>
                  );
                })}
                <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                  totalBalance >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}>
                  <span className="font-semibold text-sm">Saldo Total</span>
                  <span className={`font-bold ${totalBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {totalBalance >= 0 ? "+" : "-"}{minutesToHHMM(totalBalance)}
                  </span>
                </div>
              </div>
            )}

            {isRH && (
              <Link href="/intranet/ponto/rh?tab=banco" className="block mt-3">
                <Button variant="outline" size="sm" className="w-full">
                  Gerenciar Banco de Horas <ChevronRight size={14} />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aviso de prazo */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Prazo:</strong> Justificativas devem ser enviadas em até <strong>3 dias úteis</strong> após
          a ocorrência. Após o prazo, não será possível justificar.
        </p>
      </div>
    </div>
  );
}
