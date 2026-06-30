export const revalidate = 60;
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Newspaper, Calendar, GraduationCap, Phone } from "lucide-react";
import { NewsFeed } from "@/components/home/NewsFeed";

export default async function IntranetHome() {
  const profile = await requireStaff();

  let events: { id: string; title: string; event_date: string; location: string; slots_used: number; max_slots: number }[] = [];
  let pendingTrainings: { id: string; title: string; workload_hours: number }[] = [];

  try {
    const supabase = createClient();

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, event_date, location, slots_used, max_slots")
      .eq("active", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(3);
    events = eventsData || [];

    const { data: completedTrainings } = await supabase
      .from("training_completions")
      .select("training_id")
      .eq("user_id", profile.id);

    const completedIds = completedTrainings?.map((c: { training_id: string }) => c.training_id) || [];

    const { data: pendingData } = await supabase
      .from("trainings")
      .select("id, title, workload_hours")
      .eq("active", true)
      .not("id", "in", completedIds.length > 0 ? `(${completedIds.join(",")})` : "(null)")
      .limit(3);
    pendingTrainings = pendingData || [];
  } catch {
    // Supabase não configurado — dados ficam vazios
  }

  return (
    <div className="space-y-6">
      {/* Boas-vindas */}
      <div className="brand-gradient rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{backgroundImage: "radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)"}}
        />
        <div className="relative">
          <p className="text-blue-200 text-sm mb-1">Hospital Evandro Ribeiro · Juiz de Fora, MG</p>
          <h2 className="text-2xl font-bold">
            Olá, {profile.full_name.split(" ")[0]}
          </h2>
          <p className="text-blue-100 mt-1 text-sm">
            Bem-vindo à intranet. Use o menu lateral para navegar.
          </p>
        </div>
      </div>

      {/* Acesso rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: "/intranet/noticias",     icon: Newspaper,     color: "bg-blue-100 text-blue-600",    label: "Notícias",          value: "Ver" },
          { href: "/intranet/eventos",      icon: Calendar,      color: "bg-green-100 text-green-600",  label: "Próximos eventos",   value: String(events?.length || 0) },
          { href: "/intranet/treinamentos", icon: GraduationCap, color: "bg-purple-100 text-purple-600",label: "Treinamentos",       value: String(pendingTrainings?.length || 0) },
          { href: "/intranet/ramais",       icon: Phone,         color: "bg-orange-100 text-orange-600",label: "Ramais",             value: "Ver" },
        ].map(({ href, icon: Icon, color, label, value }) => (
          <Link key={href} href={href}>
            <Card className="card-hover cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`p-2.5 rounded-xl ${color}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold text-xl leading-tight">{value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed de notícias */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Últimas Notícias</h3>
            <Link href="/intranet/noticias" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <NewsFeed />
        </div>

        {/* Sidebar direita */}
        <div className="space-y-4">
          {/* Próximos eventos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar size={16} className="text-green-600" /> Próximos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events && events.length > 0 ? (
                events.map((ev) => (
                  <Link key={ev.id} href={`/intranet/eventos`}>
                    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <p className="font-medium text-sm">{ev.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(ev.event_date)}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">
                          {ev.slots_used}/{ev.max_slots} inscritos
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum evento próximo.</p>
              )}
              <Link href="/intranet/eventos" className="text-xs text-primary hover:underline block">
                Ver todos os eventos →
              </Link>
            </CardContent>
          </Card>

          {/* Treinamentos pendentes */}
          {pendingTrainings && pendingTrainings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap size={16} className="text-purple-600" /> Treinamentos Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingTrainings.map((tr) => (
                  <Link key={tr.id} href={`/intranet/treinamentos/${tr.id}`}>
                    <div className="p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                      <p className="font-medium text-sm">{tr.title}</p>
                      <p className="text-xs text-muted-foreground">{tr.workload_hours}h</p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
